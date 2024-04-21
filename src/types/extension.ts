import type { RCGGame } from "../game.ts";
import type { RCGStringWithPrefix, RCGVersion } from "../string.ts";

export interface RCGExtension {
  dependencies?: RCGStringWithPrefix[];
  dispose?(game: RCGGame): void | Promise<void>;
  initialize?(game: RCGGame): void | Promise<void>;
  name: RCGStringWithPrefix;
  version: RCGVersion;
}
