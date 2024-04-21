import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";

export class RCGInitialEvent extends RCGEvent {
  constructor(game: RCGGame) {
    super(game, "initialization");
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    for (;;) {
      yield* this.game.round();
    }
  }
}
