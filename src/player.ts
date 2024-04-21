import { pull } from "lodash-es";
import {
  UndirectedEdge,
  UndirectedGraph,
  UndirectedVertex,
} from "undirected-graph-typed";
import { RCGCard, type RCGCardID, type RCGExclusiveCardZone } from "./card.ts";
import { wrapEvent } from "./event.ts";
import { RCGBattleEvent } from "./events/battle.ts";
import { RCGUsageEffectEvent } from "./events/effect.ts";
import { RCGMovementEvent } from "./events/movement.ts";
import {
  RCGEndPhaseEvent,
  RCGMainPhaseEvent,
  RCGStartPhaseEvent,
} from "./events/phase.ts";
import type { RCGRevelationEvent } from "./events/revelation.ts";
import { RCGTurnEvent } from "./events/turn.ts";
import type { RCGGame } from "./game.ts";
import type { RCGProcess } from "./generator.ts";
import type { RCGByte } from "./types/byte.js";
import type {
  RCGAxis,
  RCGCoordinate,
  RCGDirection,
  RCGOrientation,
} from "./types/orientation.js";
import type {
  RCGRawResponses,
  RCGRequest,
  RCGRequests,
  RCGResponse,
} from "./types/request.js";

export type RCGPlayerName = string;

export interface RCGPlayerData {
  characters: RCGCardID[];
  extraDeck: RCGCardID[];
  deck: RCGCardID[];
  hand: RCGCardID[];
  integrity: number;
  name: RCGPlayerName;
  recycleBin: RCGCardID[];
  type: "player";
}

export class RCGPlayer {
  characters: RCGCardID[] = [];
  deck: RCGCardID[] = [];
  extraDeck: RCGCardID[] = [];
  game: RCGGame;
  hand: RCGCardID[] = [];
  integrity = 16;
  name: string;
  recycleBin: RCGCardID[] = [];

  constructor(game: RCGGame, name: RCGPlayerName) {
    this.game = game;
    this.name = name;
  }

  addCard(card: RCGCard, zone: RCGExclusiveCardZone): this {
    this.game.addCard(card);
    this[zone].push(card.id);
    return this;
  }

  battle(
    attacker: RCGCard,
    defender: RCGCard,
    axis: RCGAxis,
  ): RCGBattleEvent | undefined {
    if (!this.characters.includes(attacker.id)) return;
    const attackerVertex = new UndirectedVertex(attacker.id, attacker);
    const defenderVertex = new UndirectedVertex(defender.id, defender);
    const edge = new UndirectedEdge(
      attackerVertex.key,
      defenderVertex.key,
      void 0,
      axis,
    );
    const attacks = new UndirectedGraph<RCGCard, RCGAxis>();
    attacks.addVertex(attackerVertex);
    attacks.addVertex(defenderVertex);
    attacks.addEdge(edge);
    return new RCGBattleEvent(this.game, attacks, attacker);
  }

  *consume(consumer: RCGCard, bytes: RCGByte[]): RCGProcess {
    if (!this.characters.includes(consumer.id)) return false;
    for (const byte of bytes) {
      const { cards } = yield* this.request({
        cards: {
          maximum: 1,
          minimum: 1,
          options: this.getHand().filter(({ colors }) => {
            switch (byte) {
              case "generic":
                return true;
              case "void":
                return !colors.length;
              default:
                return colors.includes(byte);
            }
          }),
        },
      });
      if (!cards.length) return false;
      if (
        byte !== "generic" &&
        !(yield* wrapEvent(this.reveal(consumer, cards)))
      )
        return false;
      if (!(yield* wrapEvent(this.enqueue(consumer, cards)))) return false;
    }

    return true;
  }

  delete(deleter: RCGCard, cards: RCGCard[]): RCGMovementEvent | undefined {
    if (this.characters.includes(deleter.id))
      return this.game.delete(cards, deleter);
  }

  discard(discarder: RCGCard, cards: RCGCard[]): RCGMovementEvent | undefined {
    if (this.characters.includes(discarder.id))
      return this.game.discard(cards, discarder);
  }

  download(
    downloader: RCGCard,
    cards: RCGCard[],
  ): RCGMovementEvent | undefined {
    if (this.characters.includes(downloader.id))
      return this.game.download(cards, downloader);
  }

  draw(drawer: RCGCard, count: number): RCGMovementEvent | undefined {
    if (this.characters.includes(drawer.id))
      return this.game.draw(new Map([[this, count]]), drawer);
  }

  endPhase(): RCGEndPhaseEvent {
    return new RCGEndPhaseEvent(this.game, this);
  }

  enqueue(enqueuer: RCGCard, cards: RCGCard[]): RCGMovementEvent | undefined {
    if (this.characters.includes(enqueuer.id))
      return this.game.enqueue(cards, enqueuer);
  }

  getCharacters(): RCGCard[] {
    return this.game.getCards(this.characters);
  }

  getDeck(): RCGCard[] {
    return this.game.getCards(this.deck);
  }

  getExtraDeck(): RCGCard[] {
    return this.game.getCards(this.extraDeck);
  }

  getHand(filter?: (card: RCGCard) => boolean): RCGCard[] {
    return this.game.getCards(this.hand, filter);
  }

  getMainCharacter(): RCGCard | undefined {
    const mainCharacterID = this.characters[0];
    if (typeof mainCharacterID === "number")
      return this.game.getCard(mainCharacterID);
  }

  getMovableCoordinates(mover: RCGCard): RCGCoordinate[] {
    const { id, position } = mover;
    if (!this.characters.includes(id) || position?.zone !== "field") return [];
    const range = mover.getRange();
    const { x, y } = position;
    const coordinates: RCGCoordinate[] = [];

    for (let dx = -range; dx <= range; dx++) {
      const dyRange = range - Math.abs(dx);

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

  getMovableOrientations(mover: RCGCard): RCGOrientation[] {
    const { id, position } = mover;
    if (!this.characters.includes(id) || position?.zone !== "field") return [];
    const { direction: currentDirection, x, y } = position;
    return pull<RCGDirection>(
      ["north", "east", "south", "west"],
      currentDirection,
    )
      .map((direction) => ({ direction, x, y }))
      .concat(
        this.getMovableCoordinates(mover).flatMap((coordinate) => [
          { ...coordinate, direction: "north" },
          { ...coordinate, direction: "east" },
          { ...coordinate, direction: "south" },
          { ...coordinate, direction: "west" },
        ]),
      );
  }

  getNextPlayer(): RCGPlayer | undefined {
    const index = this.game.state.players.indexOf(this);
    if (index !== -1)
      return this.game.state.players[
        // Use modulo to wrap around the array
        (index + 1) % this.game.state.players.length
      ];
  }

  getPreviousPlayer(): RCGPlayer | undefined {
    const index = this.game.state.players.indexOf(this);
    if (index !== -1)
      return this.game.state.players[
        // Use modulo to wrap around the array
        (index - 1 + this.game.state.players.length) %
          this.game.state.players.length
      ];
  }

  getRecycleBin(): RCGCard[] {
    return this.game.getCards(this.recycleBin);
  }

  mainPhase(): RCGMainPhaseEvent {
    return new RCGMainPhaseEvent(this.game, this);
  }

  move(
    mover: RCGCard,
    orientation: RCGOrientation,
  ): RCGMovementEvent | undefined {
    if (this.characters.includes(mover.id))
      return new RCGMovementEvent(
        this.game,
        new Map([[{ ...orientation, zone: "field" }, [mover]]]),
        mover,
      );
  }

  *request<TRequest extends RCGRequest<unknown>>(
    request: TRequest,
  ): Generator<
    RCGRequests<TRequest>,
    RCGResponse<TRequest>,
    RCGRawResponses | undefined
  > {
    for (;;) {
      const responses = yield* this.game.request(new Map([[this, request]]));
      const response = responses.get(this);
      if (response) return response;
    }
  }

  reveal(revealer: RCGCard, cards: RCGCard[]): RCGRevelationEvent | undefined {
    if (this.characters.includes(revealer.id))
      return this.game.reveal(cards, revealer);
  }

  stage(stager: RCGCard, cards: RCGCard[]): RCGMovementEvent | undefined {
    if (this.characters.includes(stager.id))
      return this.game.stage(cards, stager);
  }

  startPhase(): RCGStartPhaseEvent {
    return new RCGStartPhaseEvent(this.game, this);
  }

  toJSON(): RCGPlayerData {
    const { characters, extraDeck, deck, hand, integrity, name, recycleBin } =
      this;
    return {
      characters,
      extraDeck,
      deck,
      hand,
      integrity,
      name,
      recycleBin,
      type: "player",
    };
  }

  turn(): RCGTurnEvent {
    return new RCGTurnEvent(this.game, this);
  }

  use(user: RCGCard, card: RCGCard): RCGUsageEffectEvent | undefined {
    if (this.characters.includes(user.id))
      return new RCGUsageEffectEvent(this.game, user, card);
  }
}
