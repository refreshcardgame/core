import type { RCGCard, RCGCardPosition } from "../card.ts";
import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";

export interface RCGIntegrityModification {
  amount: number;
  source?: RCGCard;
  type: "damage" | "loss" | "recovery";
}

export class RCGIntegrityEvent extends RCGEvent {
  modifications: Map<RCGCard, RCGIntegrityModification[]>;
  positions = new Map<RCGCard, RCGCardPosition>();

  constructor(
    game: RCGGame,
    modifications: Map<RCGCard, RCGIntegrityModification[]>,
    controller?: RCGCard,
  ) {
    super(game, "integrity", controller);
    this.modifications = modifications;
  }

  override register(): RCGSemiGenerator<RCGProcess> {
    for (const [character] of this.modifications) {
      const { position } = character;
      if (position?.zone === "field") this.positions.set(character, position);
    }

    return !!this.positions.size;
  }

  override resolve(): RCGSemiGenerator<RCGProcess> {
    let result = false;

    for (const [character, modifications] of this.modifications) {
      const { controller, position } = character;
      if (position !== this.positions.get(character) || !controller) continue;
      const player = this.game.getPlayer(controller);
      if (!player) continue;

      for (const { amount } of modifications) {
        player.integrity += amount;
        result = true;
      }
    }

    return result;
  }
}
