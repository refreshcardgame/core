import type { RCGCardID } from "./card.ts";
import { RCGCard } from "./card.ts";
import type { RCGGrid } from "./grid.ts";
import type { RCGPlayer } from "./player.ts";

interface RCGStateData {
  buffer: RCGCardID[];
  cards: Record<RCGCardID, RCGCard>;
  field: RCGCardID[];
  fragment: RCGCardID[];
  players: RCGPlayer[];
  grid: RCGGrid;
  seed: number;
}

export class RCGState {
  buffer: RCGCardID[] = [];
  cards = new Map<RCGCardID, RCGCard>();
  field: RCGCardID[] = [];
  fragment: RCGCardID[] = [];
  grid: RCGGrid;
  players: RCGPlayer[] = [];
  seed: number;

  constructor(grid: RCGGrid, seed: number) {
    this.grid = grid;
    this.seed = seed;
  }

  toJSON(): RCGStateData {
    const { buffer, cards, field, fragment, players, grid, seed } = this;
    return {
      buffer,
      cards: Object.fromEntries(cards),
      field,
      fragment,
      players,
      grid,
      seed,
    };
  }
}
