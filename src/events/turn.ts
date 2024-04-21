import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";
import { wrap } from "../generator.ts";
import type { RCGPlayer } from "../player.ts";

export class RCGTurnEvent extends RCGEvent {
  constructor(game: RCGGame, controller?: RCGPlayer) {
    super(game, "turn", controller);
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    yield* wrap(this.getPlayer()?.startPhase());
    yield* wrap(this.getPlayer()?.mainPhase());
    yield* wrap(this.getPlayer()?.endPhase());
    return true;
  }
}
