import { RCGEvent, wrapEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";
import type { RCGPlayer } from "../player.ts";

export class RCGTurnEvent extends RCGEvent {
  constructor(game: RCGGame, controller?: RCGPlayer) {
    super(game, "turn", controller);
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    yield* wrapEvent(this.getPlayer()?.startPhase());
    yield* wrapEvent(this.getPlayer()?.mainPhase());
    yield* wrapEvent(this.getPlayer()?.endPhase());
    return true;
  }
}
