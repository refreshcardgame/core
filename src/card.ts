import { pull } from "lodash-es";
import {
  UndirectedEdge,
  UndirectedGraph,
  UndirectedVertex,
} from "undirected-graph-typed";
import type { RCGColor } from "./color.ts";
import { RCGBattleEvent } from "./events/battle.ts";
import { RCGCardEvent } from "./events/card.ts";
import { RCGUsageEffectEvent } from "./events/effect.ts";
import type { RCGIntegrityEvent } from "./events/integrity.ts";
import type { RCGRevealEvent } from "./events/reveal.ts";
import { RCGGame, type RCGCardDefinition } from "./game.ts";
import type { RCGProcess } from "./generator.ts";
import { wrap } from "./generator.ts";
import type { RCGPlayer, RCGPlayerName } from "./player.ts";
import type { RCGByte } from "./types/byte.ts";
import type {
  RCGBattleStat,
  RCGCharacterCard,
  RCGCharacterCardData,
} from "./types/cards/character.ts";
import type { RCGProgramCard } from "./types/cards/program.ts";
import type { RCGEffect, RCGEffectName } from "./types/effect.ts";
import type {
  RCGAxis,
  RCGCoordinate,
  RCGDirection,
  RCGOrientation,
  RCGRelativeDirection,
} from "./types/orientation.ts";
import type {
  RCGRawResponses,
  RCGRequest,
  RCGRequests,
  RCGResponse,
} from "./types/request.ts";

export type RCGCardID = number;

export type RCGCardName = string;

export interface RCGCardData extends RCGCharacterCardData {
  colors?: RCGColor[];
  owner?: RCGPlayerName;
  skills?: RCGEffectName[];
  types?: string[];
  usage?: RCGEffectName;
  virtual?: boolean;
}

export interface RCG1DSharedCardPosition {
  zone: "buffer" | "fragment";
}

export interface RCG2DSharedCardPosition extends RCGOrientation {
  zone: "field";
}

export type RCGExclusiveCardZone = "deck" | "extraDeck" | "hand" | "recycleBin";

export interface RCGExclusiveCardPosition {
  player: RCGPlayerName;
  zone: RCGExclusiveCardZone;
}

export type RCGCardPosition =
  | RCG1DSharedCardPosition
  | RCG2DSharedCardPosition
  | RCGExclusiveCardPosition;

export type RCGRelativeCardPosition = (
  | RCG1DSharedCardPosition
  | RCG2DSharedCardPosition
  | RCGExclusiveCardPosition
) & { index?: number };

let idCounter = 0;

export class RCGCard implements RCGCharacterCard {
  attack?: number;
  colors: RCGColor[] = [];
  controller?: RCGPlayerName;
  defense?: number;
  game: RCGGame;
  id: RCGCardID = idCounter++;
  name: RCGCardName;
  owner?: RCGPlayerName;
  position?: RCGCardPosition;
  range?: number;
  skills: RCGEffectName[] = [];
  speed?: number;
  type = "card" as const;
  types: string[] = [];
  usage?: RCGEffectName;
  virtual?: boolean;

  constructor(game: RCGGame, name: RCGCardName) {
    this.game = game;
    this.name = name;
  }

  // Raw

  getController(): RCGPlayer | undefined {
    return this.game.getPlayer(this.controller);
  }

  getUsage(): RCGEffect | undefined {
    if (this.usage) return this.game.effects.get(this.usage);
  }

  initialize(): this {
    const cardDefinition = this.game.cardDefinitions.get(this.name);
    if (!cardDefinition) return this;

    for (const key in cardDefinition) {
      const value = structuredClone(
        cardDefinition[key as keyof RCGCardDefinition],
      );
      const property = this[key as keyof RCGCardDefinition];
      if (!Array.isArray(property))
        (this[key as keyof RCGCardDefinition] as unknown) = value;
      else if (Array.isArray(value)) {
        property.length = 0;
        (property as unknown[]).push(...value);
      }
    }

    return this;
  }

  isCharacter(): this is RCGCharacterCard {
    return this.types.includes("character");
  }

  setPosition(to: RCGRelativeCardPosition): this {
    switch (this.position?.zone) {
      case "buffer":
      case "field":
      case "fragment":
        pull(this.game.state[this.position.zone], this.id);
        break;

      case "deck":
      case "extraDeck":
      case "hand":
      case "recycleBin": {
        const player = this.game.getPlayer(this.position.player);
        if (player) pull(player[this.position.zone], this.id);
        break;
      }
    }

    const { index, zone } = to;

    switch (zone) {
      case "buffer":
      case "fragment":
        if (this.position?.zone !== zone) this.position = { zone };
        if (typeof index === "number")
          this.game.state[zone].splice(index, 0, this.id);
        else this.game.state[zone].push(this.id);
        break;

      case "field":
        if (this.position?.zone === zone) {
          this.position.direction = to.direction;
          this.position.x = to.x;
          this.position.y = to.y;
        } else
          this.position = {
            direction: to.direction,
            x: to.x,
            y: to.y,
            zone,
          };

        if (typeof index === "number")
          this.game.state[zone].splice(index, 0, this.id);
        else this.game.state[zone].push(this.id);
        break;

      case "deck":
      case "extraDeck":
      case "hand":
      case "recycleBin": {
        const name = to.player;
        const player = this.game.getPlayer(name);
        if (!player) break;
        if (this.position?.zone !== zone || this.position.player !== name)
          this.position = { player: name, zone };
        if (typeof index === "number") player[zone].splice(index, 0, this.id);
        else player[zone].push(this.id);
        break;
      }
    }

    return this;
  }

  toJSON(): RCGCardData {
    const { id, name, type } = this;
    const data: RCGCardData = { id, name, type };

    for (const key in this) {
      if (key === "game" || key === "id" || key === "name") continue;
      const value = this[key];
      if (typeof value !== "undefined")
        (data[key as keyof RCGCardData] as unknown) = value;
    }

    return data;
  }

  // Program

  getDistanceTo({ position }: RCGCard): number {
    if (!this.position || !position) return NaN;
    const { zone: fromZone } = this.position;
    const { zone: toZone } = position;
    if (fromZone !== "field" || toZone !== "field") return NaN;
    const { x: fromX, y: fromY } = this.position;
    const { x: toX, y: toY } = position;
    // Taxicab distance
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }

  getRelativeDirectionTo({
    position,
  }: RCGProgramCard): RCGRelativeDirection | undefined {
    if (!this.position || !position) return;
    const { zone: fromZone } = this.position;
    const { zone: toZone } = position;
    if (fromZone !== "field" || toZone !== "field") return;
    const { x: fromX, y: fromY } = this.position;
    const { direction, x: toX, y: toY } = position;
    const xDifference = toX - fromX;
    const yDifference = toY - fromY;
    const absoluteXDifference = Math.abs(xDifference);
    const absoluteYDifference = Math.abs(yDifference);
    if (absoluteXDifference === absoluteYDifference) return;

    switch (direction) {
      case "north":
        if (absoluteXDifference > absoluteYDifference)
          return xDifference > 0 ? "left" : "right";
        else if (yDifference > 0) return "front";
        else if (yDifference < 0) return "back";
        break;

      case "east":
        if (absoluteXDifference > absoluteYDifference)
          return xDifference > 0 ? "back" : "front";
        else if (yDifference > 0) return "left";
        else if (yDifference < 0) return "right";
        break;

      case "south":
        if (absoluteXDifference > absoluteYDifference)
          return xDifference > 0 ? "right" : "left";
        else if (yDifference > 0) return "back";
        else if (yDifference < 0) return "front";
        break;

      case "west":
        if (absoluteXDifference > absoluteYDifference)
          return xDifference > 0 ? "front" : "back";
        else if (yDifference > 0) return "right";
        else if (yDifference < 0) return "left";
        break;
    }
  }

  // Character

  battle(
    defender: RCGCharacterCard,
    axis: RCGAxis,
  ): RCGBattleEvent | undefined {
    if (!this.isCharacter()) return;
    const attackerVertex = new UndirectedVertex(this.id, this);
    const defenderVertex = new UndirectedVertex(defender.id, defender);
    const edge = new UndirectedEdge(
      attackerVertex.key,
      defenderVertex.key,
      void 0,
      axis,
    );
    const attacks = new UndirectedGraph<RCGCharacterCard, RCGAxis>();
    attacks.addVertex(attackerVertex);
    attacks.addVertex(defenderVertex);
    attacks.addEdge(edge);
    return new RCGBattleEvent(this.game, attacks, this);
  }

  *consume(bytes: RCGByte[]): RCGProcess {
    if (!this.isCharacter()) return false;

    for (const byte of bytes) {
      const generator = this.request({
        cards: {
          maximum: 1,
          minimum: 1,
          options:
            this.getController()?.getHand(({ colors }) => {
              switch (byte) {
                case "generic":
                  return true;
                case "void":
                  return !colors.length;
                default:
                  return colors.includes(byte);
              }
            }) ?? [],
        },
      });
      if (!generator) return false;
      const { cards } = yield* generator;
      if (byte !== "generic" && !(yield* wrap(this.reveal(cards))))
        return false;
      if (!(yield* wrap(this.enqueue(cards)))) return false;
    }

    return true;
  }

  damage(
    amount: number,
    source?: RCGCharacterCard,
    controller?: RCGCharacterCard,
  ): RCGIntegrityEvent | undefined {
    if (this.isCharacter())
      return this.game.damage(this, amount, source, controller);
  }

  deleteCards(cards: RCGCard[]): RCGCardEvent | undefined {
    if (this.isCharacter()) return this.game.deleteCards(cards, this);
  }

  discard(cards: RCGCard[]): RCGCardEvent | undefined {
    if (this.isCharacter()) return this.game.discard(cards, this);
  }

  download(cards: RCGCard[]): RCGCardEvent | undefined {
    if (this.isCharacter()) return this.game.download(cards, this);
  }

  draw(count: number): RCGCardEvent | undefined {
    if (!this.isCharacter()) return;
    const controller = this.getController();
    if (controller) return this.game.draw(new Map([[controller, count]]), this);
  }

  enqueue(cards: RCGCard[]): RCGCardEvent | undefined {
    if (this.isCharacter()) return this.game.enqueue(cards, this);
  }

  getAttackerBattleStat(
    { position: defenderPosition }: RCGCharacterCard,
    axis: RCGAxis,
  ): RCGBattleStat {
    const { position } = this;

    if (position?.zone === "field" && defenderPosition?.zone === "field")
      if (axis === "y") {
        switch (position.direction) {
          case "north":
            if (defenderPosition.y - position.y >= 0) break;
            return { attack: this.attack ?? 1, defense: 0 };
          case "south":
            if (defenderPosition.y - position.y <= 0) break;
            return { attack: this.attack ?? 1, defense: 0 };
          case "east":
          case "west":
            return { attack: 0, defense: this.defense ?? 1 };
        }
      } else {
        switch (position.direction) {
          case "north":
          case "south":
            return { attack: 0, defense: this.defense ?? 1 };
          case "east":
            if (defenderPosition.x - position.x <= 0) break;
            return { attack: this.attack ?? 1, defense: 0 };
          case "west":
            if (defenderPosition.x - position.x >= 0) break;
            return { attack: this.attack ?? 1, defense: 0 };
        }
      }

    return { attack: 0, defense: 0 };
  }

  getBattleStats(
    defender: RCGCard,
    axis: RCGAxis,
  ): [RCGBattleStat, RCGBattleStat] {
    return [
      this.getAttackerBattleStat(defender, axis),
      this.getDefenderBattleStat(defender, axis),
    ];
  }

  getDefenderBattleStat(defender: RCGCard, axis: RCGAxis): RCGBattleStat {
    return defender.getAttackerBattleStat(this, axis);
  }

  getMovableCoordinates(): RCGCoordinate[] {
    if (!this.isCharacter()) return [];
    const { position } = this;
    if (position?.zone !== "field") return [];
    const speed = this.getSpeed();
    const { x, y } = position;
    const coordinates: RCGCoordinate[] = [];

    for (let dx = -speed; dx <= speed; dx++) {
      const dyRange = speed - Math.abs(dx);

      for (let dy = -dyRange; dy <= dyRange; dy++) {
        const xCoordinate = x + dx;
        const yCoordinate = y + dy;
        const coordinate = { x: xCoordinate, y: yCoordinate };
        if (
          this.game.state.grid.isInside(coordinate) &&
          !this.game
            .getCards(this.game.state.field)
            .some(
              ({ position: otherPosition }) =>
                otherPosition?.zone === "field" &&
                otherPosition.x === xCoordinate &&
                otherPosition.y === yCoordinate,
            )
        )
          coordinates.push(coordinate);
      }
    }

    return coordinates;
  }

  getMovableOrientations(): RCGOrientation[] {
    if (!this.isCharacter()) return [];
    const { position } = this;
    if (position?.zone !== "field") return [];
    const { direction: currentDirection, x, y } = position;
    return pull<RCGDirection>(
      ["north", "east", "south", "west"],
      currentDirection,
    )
      .map((direction) => ({ direction, x, y }))
      .concat(
        this.getMovableCoordinates().flatMap((coordinate) => [
          { ...coordinate, direction: "north" },
          { ...coordinate, direction: "east" },
          { ...coordinate, direction: "south" },
          { ...coordinate, direction: "west" },
        ]),
      );
  }

  getRange(): number {
    return this.range ?? 1;
  }

  getSpeed(): number {
    return this.speed ?? 1;
  }

  isInRange(card: RCGCard): boolean {
    return this.getDistanceTo(card) <= this.getRange();
  }

  move(orientation: RCGOrientation): RCGCardEvent | undefined {
    if (this.isCharacter())
      return new RCGCardEvent(
        this.game,
        new Map([[{ ...orientation, zone: "field" }, [this]]]),
        this,
      );
  }

  request<TRequest extends RCGRequest<unknown>>(
    request: TRequest,
  ):
    | Generator<
        RCGRequests<TRequest>,
        RCGResponse<TRequest>,
        RCGRawResponses | undefined
      >
    | undefined {
    if (this.isCharacter()) return this.getController()?.request(request);
  }

  reveal(cards: RCGCard[]): RCGRevealEvent | undefined {
    if (this.isCharacter()) return this.game.reveal(cards, this);
  }

  stage(cards: RCGCard[]): RCGCardEvent | undefined {
    if (this.isCharacter()) return this.game.stage(cards, this);
  }

  use(card: RCGCard): RCGUsageEffectEvent | undefined {
    if (this.isCharacter())
      return new RCGUsageEffectEvent(this.game, this, card);
  }
}
