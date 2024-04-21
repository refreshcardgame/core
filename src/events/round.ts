import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";

export class RCGRoundEvent extends RCGEvent {
  constructor(game: RCGGame) {
    super(game, "round");
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    for (const player of this.game.state.players.slice()) {
      yield* player.turn();
    }

    return true;
  }
}
