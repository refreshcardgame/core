import type { RCGCard, RCGCardPosition } from "../card.ts";
import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";

export class RCGRevelationEvent extends RCGEvent {
  cards: RCGCard[];
  pendingCards = new Map<RCGCard, RCGCardPosition | undefined>();
  revealedCards: RCGCard[] = [];

  constructor(game: RCGGame, cards: RCGCard[], controller?: RCGCard) {
    super(game, "revelation", controller);
    this.cards = cards;
  }

  override register(): RCGSemiGenerator<RCGProcess> {
    for (const card of this.cards) {
      this.pendingCards.set(card, card.position);
    }

    return true;
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    for (const [card, position] of this.pendingCards) {
      if (card.position === position) this.revealedCards.push(card);
    }

    yield* this.game.request(
      new Map(
        this.game.state.players.map((player) => [
          player,
          {
            revelations: {
              default: [],
              maximum: 0,
              minimum: 0,
              options: this.revealedCards,
            },
          },
        ]),
      ),
    );
    return !!this.revealedCards.length;
  }
}
