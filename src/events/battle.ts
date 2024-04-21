import type { UndirectedGraph } from "undirected-graph-typed";
import type { RCGCard, RCGCardPosition } from "../card.ts";
import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";
import type { RCGAxis } from "../types/orientation.js";
import {
  RCGIntegrityEvent,
  type RCGIntegrityModification,
} from "./integrity.ts";

export class RCGBattleEvent extends RCGEvent {
  positions = new Map<RCGCard, RCGCardPosition>();
  attacks: UndirectedGraph<RCGCard, RCGAxis>;

  constructor(
    game: RCGGame,
    attacks: UndirectedGraph<RCGCard, RCGAxis>,
    controller?: RCGCard,
  ) {
    super(game, "battle", controller);
    this.attacks = attacks;
  }

  override register(): RCGSemiGenerator<RCGProcess> {
    for (const [, character] of this.attacks) {
      if (!character) continue;
      const { position } = character;
      if (position?.zone === "field") this.positions.set(character, position);
    }

    return !!this.positions.size;
  }

  override *resolve(): RCGSemiGenerator<RCGProcess> {
    const modifications = new Map<RCGCard, RCGIntegrityModification[]>();

    for (const [attackerVertexKey, attacker] of this.attacks) {
      if (!attacker) continue;
      const { position: attackerPosition } = attacker;
      if (
        !attackerPosition ||
        attackerPosition !== this.positions.get(attacker)
      )
        continue;

      for (const defenderVertex of this.attacks.getNeighbors(
        attackerVertexKey,
      )) {
        const { value: defender } = defenderVertex;
        if (!defender) continue;
        const { position: defenderPosition } = defender;
        if (
          !defenderPosition ||
          defenderPosition !== this.positions.get(defender) ||
          !attacker.isInRange(defender)
        )
          continue;
        const axis = this.attacks.getEdge(
          attackerVertexKey,
          defenderVertex,
        )?.value;
        if (!axis) continue;
        const [{ attack }, { defense }] = attacker.getBattleStats(
          defender,
          axis,
        );
        const attackerDamage = defense - attack;

        if (attackerDamage > 0) {
          const attackerModifications = modifications.get(attacker);
          if (attackerModifications) {
            const modification = attackerModifications.find(
              ({ source, type }) => source === defender && type === "damage",
            );
            if (modification) modification.amount -= attackerDamage;
            else
              attackerModifications.push({
                amount: -attackerDamage,
                source: defender,
                type: "damage",
              });
          } else
            modifications.set(attacker, [
              {
                amount: -attackerDamage,
                source: defender,
                type: "damage",
              },
            ]);
        }

        const defenderDamage = attack - defense;

        if (defenderDamage > 0) {
          const defenderModifications = modifications.get(defender);
          if (defenderModifications) {
            const modification = defenderModifications.find(
              ({ source, type }) => source === attacker && type === "damage",
            );
            if (modification) modification.amount -= defenderDamage;
            else
              defenderModifications.push({
                amount: -defenderDamage,
                source: attacker,
                type: "damage",
              });
          } else
            modifications.set(defender, [
              {
                amount: -defenderDamage,
                source: attacker,
                type: "damage",
              },
            ]);
        }
      }
    }

    return (
      !!modifications.size &&
      (yield* new RCGIntegrityEvent(this.game, modifications, this.controller))
    );
  }
}
