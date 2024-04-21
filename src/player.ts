import { RCGCard, type RCGCardID, type RCGExclusiveCardZone } from "./card.ts";
import {
  RCGEndPhaseEvent,
  RCGMainPhaseEvent,
  RCGStartPhaseEvent,
} from "./events/phase.ts";
import { RCGTurnEvent } from "./events/turn.ts";
import type { RCGGame } from "./game.ts";
import type { RCGCharacterCard } from "./types/cards/character.ts";
import type {
  RCGRawResponses,
  RCGRequest,
  RCGRequests,
  RCGResponse,
} from "./types/request.ts";

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
  type = "player" as const;

  constructor(game: RCGGame, name: RCGPlayerName) {
    this.game = game;
    this.name = name;
  }

  addCard(card: RCGCard, zone: RCGExclusiveCardZone): this {
    this.game.addCard(card);
    this[zone].push(card.id);
    return this;
  }

  addCards(cards: RCGCard[], zone: RCGExclusiveCardZone): this {
    for (const card of cards) {
      this.addCard(card, zone);
    }

    return this;
  }

  addCharacter(card: RCGCard): this {
    this.game.addCard(card);
    this.characters.push(card.id);
    return this;
  }

  endPhase(): RCGEndPhaseEvent {
    return new RCGEndPhaseEvent(this.game, this);
  }

  getCharacters(): RCGCharacterCard[] {
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

  getMainCharacter(): RCGCharacterCard | undefined {
    const mainCharacterID = this.characters[0];
    if (typeof mainCharacterID === "number")
      return this.game.getCard(mainCharacterID);
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

  startPhase(): RCGStartPhaseEvent {
    return new RCGStartPhaseEvent(this.game, this);
  }

  toJSON(): RCGPlayerData {
    const {
      characters,
      extraDeck,
      deck,
      hand,
      integrity,
      name,
      recycleBin,
      type,
    } = this;
    return {
      characters,
      extraDeck,
      deck,
      hand,
      integrity,
      name,
      recycleBin,
      type,
    };
  }

  turn(): RCGTurnEvent {
    return new RCGTurnEvent(this.game, this);
  }
}
