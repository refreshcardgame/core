import { without } from "lodash-es";
import type { RCGCard } from "./card.ts";
import type { RCGEvent } from "./event.ts";
import type { RCGPlayer } from "./player.ts";
import type { RCGCharacterCard } from "./types/cards/character.ts";
import type { RCGAxis, RCGOrientation } from "./types/orientation.ts";

type RCGBattleCommand = [
  RCGCharacterCard,
  "battle",
  [RCGCharacterCard, RCGAxis],
];
type RCGMoveCommand = [RCGCharacterCard, "move", [RCGOrientation]];
export type RCGUseCommand = [RCGCharacterCard, "use", [RCGCard]];
type RCGCommand = RCGBattleCommand | RCGMoveCommand | RCGUseCommand;

export function getAvailableCommands(
  { children, game, triggering }: RCGEvent,
  player: RCGPlayer,
): RCGCommand[] {
  const commands: RCGCommand[] = [];

  for (const character of player.getCharacters()) {
    if (
      triggering.includes("main") &&
      !children.some(
        (child) =>
          child.name === "battle" &&
          child.getController()?.position === character.position,
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
            commands.push([character, "battle", [defender, "x"]]);
          const { attack: yAttack } = character.getAttackerBattleStat(
            defender,
            "y",
          );
          if (yAttack > 0)
            commands.push([character, "battle", [defender, "y"]]);
        }
      }

    if (
      triggering.includes("main") &&
      !children.some(
        (child) =>
          child.name === "movement" &&
          child.getController()?.position === character.position,
      )
    )
      commands.push(
        ...character
          .getMovableOrientations()
          .map<RCGMoveCommand>((orientation) => [
            character,
            "move",
            [orientation],
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
          .map((card): RCGUseCommand => [character, "use", [card]]),
      );
  }

  return commands;
}
