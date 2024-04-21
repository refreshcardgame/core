import { toShifted } from "../array.ts";
import { RCGEvent, wrapEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";
import type { RCGPlayer } from "../player.ts";

export class RCGPhaseEvent extends RCGEvent {
  constructor(game: RCGGame, name: string, controller?: RCGPlayer) {
    super(game, `${name}Phase`, controller);
  }
}

export class RCGStartPhaseEvent extends RCGPhaseEvent {
  constructor(game: RCGGame, controller?: RCGPlayer) {
    super(game, "start", controller);
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    yield* wrapEvent(
      this.game.draw(
        new Map(this.game.state.players.map((player) => [player, 2])),
      ),
    );
    return true;
  }
}

export class RCGMainPhaseEvent extends RCGPhaseEvent {
  constructor(game: RCGGame, controller?: RCGPlayer) {
    super(game, "main", controller);
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    yield* this.trigger(["main"]);
    return true;
  }
}

export class RCGEndPhaseEvent extends RCGPhaseEvent {
  constructor(game: RCGGame, controller?: RCGPlayer) {
    super(game, "end", controller);
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    const turnPointer = this.game.getTurnPointer();
    if (!turnPointer) return true;
    const responses = yield* this.game.request(
      new Map(
        toShifted(this.game.state.players, turnPointer)
          .filter(({ hand, integrity }) => hand.length > integrity)
          .map((player) => [
            player,
            {
              cards: {
                maximum: 1,
                minimum: 1,
                options: this.game.getCards(player.hand),
              },
            },
          ]),
      ),
    );
    yield* wrapEvent(
      this.game.discard(
        responses
          .values()
          .flatMap(({ cards }) => cards)
          .toArray(),
      ),
    );
    return true;
  }
}
