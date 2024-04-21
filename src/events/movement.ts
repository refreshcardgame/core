import { pull } from "lodash-es";
import type {
  RCGCard,
  RCGCardPosition,
  RCGRelativeCardPosition,
} from "../card.ts";
import { RCGEvent, wrapEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";

export class RCGMovementEvent extends RCGEvent {
  buffer: RCGCard[] = [];
  from = new Map<RCGCard, RCGCardPosition | undefined>();
  to: Map<RCGRelativeCardPosition, RCGCard[]>;

  constructor(
    game: RCGGame,
    to: Map<RCGRelativeCardPosition, RCGCard[]>,
    controller?: RCGCard,
  ) {
    super(game, "movement", controller);
    this.to = to;
  }

  override register(): RCGSemiGenerator<RCGProcess> {
    for (const [, cards] of this.to) {
      for (const card of cards) {
        const { position } = card;
        this.from.set(card, position);
      }
    }

    return true;
  }

  override resolve(): RCGSemiGenerator<RCGProcess> {
    let result = false;

    for (const [toPosition, cards] of this.to) {
      for (const card of cards) {
        const fromPosition = this.from.get(card);

        if (fromPosition) {
          const { zone: fromZone } = fromPosition;

          if (card.position === fromPosition)
            switch (fromZone) {
              case "buffer":
              case "field":
              case "fragment":
                pull(this.game.state[fromZone], card.id);
                break;

              case "deck":
              case "extraDeck":
              case "hand":
              case "recycleBin": {
                const player = this.game.getPlayer(fromPosition.player);
                if (player) pull(player[fromZone], card.id);
                break;
              }
            }
          else continue;
        }

        result = true;
      }

      const { index, zone } = toPosition;

      switch (zone) {
        case "buffer":
        case "fragment":
          for (const card of cards) {
            if (card.position?.zone !== zone) card.position = { zone };
          }

          if (typeof index === "number")
            this.game.state[zone].splice(
              index,
              0,
              ...cards.map(({ id }) => id),
            );
          else this.game.state[zone].push(...cards.map(({ id }) => id));
          if (zone === "buffer") this.buffer.push(...cards);
          break;

        case "field":
          for (const card of cards) {
            if (card.position?.zone === zone) {
              card.position.direction = toPosition.direction;
              card.position.x = toPosition.x;
              card.position.y = toPosition.y;
            } else
              card.position = {
                direction: toPosition.direction,
                x: toPosition.x,
                y: toPosition.y,
                zone,
              };
          }

          if (typeof index === "number")
            this.game.state.field.splice(
              index,
              0,
              ...cards.map(({ id }) => id),
            );
          else this.game.state.field.push(...cards.map(({ id }) => id));
          break;

        case "deck":
        case "extraDeck":
        case "hand":
        case "recycleBin": {
          const player = this.game.getPlayer(toPosition.player);
          if (!player) break;

          for (const card of cards) {
            if (
              card.position?.zone !== zone ||
              card.position.player !== player.name
            )
              card.position = { player: player.name, zone };
          }

          if (typeof index === "number")
            player[zone].splice(index, 0, ...cards.map(({ id }) => id));
          else player[zone].push(...cards.map(({ id }) => id));
          break;
        }
      }
    }

    const buffer = this.buffer;
    if (buffer.length)
      this.parent?.afterEvent.push(function* (event) {
        return yield* wrapEvent(
          event.game.delete(
            buffer.filter((card) => card.position?.zone === "buffer"),
          ),
        );
      });
    return result;
  }
}
