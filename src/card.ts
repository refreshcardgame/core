import { pull } from "lodash-es";
import { RCGGame, type RCGCardDefinition } from "./game.ts";
import type { RCGPlayerName } from "./player.ts";
import type { RCGColor } from "./types/color.js";
import type { RCGEffect, RCGEffectName } from "./types/effect.js";
import type {
  RCGAxis,
  RCGOrientation,
  RCGRelativeDirection,
} from "./types/orientation.js";

export type RCGCardID = number;

export type RCGCardName = string;

interface RCGBattleStat {
  attack: number;
  defense: number;
}

interface RCGCharacterData extends Partial<RCGBattleStat> {
  range?: number;
}

export interface RCGCardData extends RCGCharacterData {
  colors?: RCGColor[];
  controller?: RCGPlayerName;
  id: RCGCardID;
  name: RCGCardName;
  owner?: RCGPlayerName;
  skills?: RCGEffectName[];
  type: "card";
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

export class RCGCard implements RCGCharacterData {
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
  types: string[] = [];
  usage?: RCGEffectName;
  virtual?: boolean;

  constructor(game: RCGGame, name: RCGCardName) {
    this.game = game;
    this.name = name;
  }

  getAttackerBattleStat(
    { position: defenderPosition }: RCGCard,
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

  getRange(): number {
    return this.range ?? 1;
  }

  getRelativeDirectionTo({
    position,
  }: RCGCard): RCGRelativeDirection | undefined {
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

  isCharacter(): boolean {
    return this.types.includes("character");
  }

  isInRange(card: RCGCard): boolean {
    return this.getDistanceTo(card) <= this.getRange();
  }

  move(to: RCGRelativeCardPosition): this {
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
    const data: RCGCardData = { id: this.id, name: this.name, type: "card" };

    for (const key in this) {
      if (key === "game" || key === "id" || key === "name") continue;
      const value = this[key];
      if (typeof value !== "undefined")
        (data[key as keyof RCGCardData] as unknown) = value;
    }

    return data;
  }
}
