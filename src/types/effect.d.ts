import type { RCGCard } from "../card.ts";
import type { RCGCard } from "../cards/character.ts";
import type { RCGScope, RCGTiming } from "../event.ts";
import type { RCGEffectEvent } from "../events/effect.ts";
import type { RCGGame } from "../game.ts";
import type { RCGProcess, RCGSemiGenerator } from "../generator.ts";
import type { RCGTarget } from "../target.ts";
import type { RCGByte } from "./byte.js";

export type RCGEffectCondition = (
  game: RCGGame,
  controller: RCGCard,
  source?: RCGCard,
) => boolean;

export type RCGEffectLimit = number;

export type RCGEffectName = string;

export interface RCGEffect {
  bytes?: RCGByte[];
  condition?: RCGEffectCondition;
  input?(event: RCGEffectEvent): RCGSemiGenerator<RCGProcess>;
  limits?: Record<RCGScope, RCGEffectLimit>;
  name: RCGEffectName;
  output?(event: RCGEffectEvent): RCGSemiGenerator<RCGProcess>;
  targets?: RCGTarget[];
  triggers?: RCGTiming[];
}
