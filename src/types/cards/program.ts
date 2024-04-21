import type { RCGRelativeDirection } from "../orientation.ts";
import type { RCGRawCard } from "./raw.ts";

export interface RCGProgramCard extends RCGRawCard {
  getDistanceTo({ position }: RCGProgramCard): number;

  getRelativeDirectionTo({
    position,
  }: RCGProgramCard): RCGRelativeDirection | undefined;
}
