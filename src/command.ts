import { without } from "lodash-es";
import type { RCGCard } from "./card.ts";
import type { RCGEvent } from "./event.ts";
import type { RCGPlayer } from "./player.ts";
import type { RCGAxis, RCGOrientation } from "./types/orientation.js";

interface RCGBattleCommandArgument {
  axis: RCGAxis;
  defender: RCGCard;
}

type RCGBattleCommand = [RCGCard, "battle", RCGBattleCommandArgument];
type RCGMovementCommand = [RCGCard, "movement", RCGOrientation];
type RCGUsageCommand = [RCGCard, "usage", RCGCard];
type RCGCommand = RCGBattleCommand | RCGMovementCommand | RCGUsageCommand;

export function getAvailableCommands(
  { children, game, triggering }: RCGEvent,
  player: RCGPlayer,
): RCGCommand[] {
  const commands: RCGCommand[] = [];

  for (const character of player.getCharacters()) {
    if (
      triggering.includes("main") &&
      !children.some(
        ({ controller, name }) =>
          name === "battle" && controller?.position === character.position,
      )
    )
      for (const otherPlayer of without(game.state.players, player)) {
        for (const defender of otherPlayer.getCharacters()) {
          if (!character.isInRange(defender)) continue;
          const { attack: xAttack } = character.getAttackerBattleStat(
            defender,
            "x",
          );
          if (xAttack > 0)
            commands.push([character, "battle", { axis: "x", defender }]);
          const { attack: yAttack } = character.getAttackerBattleStat(
            defender,
            "y",
          );
          if (yAttack > 0)
            commands.push([character, "battle", { axis: "y", defender }]);
        }
      }

    if (
      triggering.includes("main") &&
      !children.some(
        ({ controller, name }) =>
          name === "movement" && controller?.position === character.position,
      )
    )
      commands.push(
        ...player
          .getMovableOrientations(character)
          .map<RCGMovementCommand>((orientation) => [
            character,
            "movement",
            orientation,
          ]),
      );

    if (
      !triggering.includes("main") ||
      game.getActivationCount(character, "main") < 1
    )
      commands.push(
        ...player
          .getHand((card) => {
            const { usage } = card;
            if (!usage) return false;
            const effect = game.effects.get(usage);
            if (!effect?.bytes) return false;
            const limits = game.getEffectLimits(effect);

            for (const scope in limits) {
              if (
                game.getActivationCount(character, scope, effect) >=
                (limits[scope] ?? Infinity)
              )
                return false;
            }

            return (
              !!effect.triggers?.some(triggering.includes, triggering) &&
              (!effect.condition || effect.condition(game, character, card))
            );
          })
          .map((card): RCGUsageCommand => [character, "usage", card]),
      );
  }

  return commands;
}
