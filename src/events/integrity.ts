import type { RCGCardPosition } from "../card.ts";
import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";
import type { RCGCharacterCard } from "../types/cards/character.ts";

export interface RCGIntegrityModification {
  amount: number;
  source?: RCGCharacterCard;
  type: "damage" | "loss" | "recovery";
}

export class RCGIntegrityEvent extends RCGEvent {
  modifications: Map<RCGCharacterCard, RCGIntegrityModification[]>;
  positions = new Map<RCGCharacterCard, RCGCardPosition>();

  constructor(
    game: RCGGame,
    modifications: Map<RCGCharacterCard, RCGIntegrityModification[]>,
    controller?: RCGCharacterCard,
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
      const { position } = character;
      if (position !== this.positions.get(character)) continue;
      const player = character.getController();
      if (!player) continue;

      for (const { amount } of modifications) {
        player.integrity += amount;
        result = true;
      }
    }

    return result;
  }
}
