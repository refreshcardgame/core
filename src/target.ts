import type { RCGCard } from "./card.ts";
import type { RCGGame } from "./game.ts";
import type { RCGRange } from "./types/range.js";

export type RCGTargetPredicate = (
  game: RCGGame,
  controller: RCGCard,
  target: RCGCard,
  selections: RCGCard[][],
  source?: RCGCard,
) => boolean;

export interface RCGTarget extends RCGRange {
  predicate: RCGTargetPredicate;
}

export const isCharacter: RCGTargetPredicate = (_game, _controller, target) =>
  target.position?.zone === "field" && target.isCharacter();

export const isDamageableProgram: RCGTargetPredicate = isCharacter;

export const isOtherCharacter: RCGTargetPredicate = (
  game,
  controller,
  target,
  selections,
  source,
) =>
  isCharacter(game, controller, target, selections, source) &&
  target !== controller;
