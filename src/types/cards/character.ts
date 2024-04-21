import type { RCGCard } from "../../card.ts";
import type { RCGBattleEvent } from "../../events/battle.ts";
import type { RCGCardEvent } from "../../events/card.ts";
import type { RCGUsageEffectEvent } from "../../events/effect.ts";
import type { RCGIntegrityEvent } from "../../events/integrity.ts";
import type { RCGRevealEvent } from "../../events/reveal.ts";
import type { RCGProcess } from "../../generator.ts";
import type { RCGByte } from "../byte.ts";
import type { RCGAxis, RCGCoordinate, RCGOrientation } from "../orientation.ts";
import type {
  RCGRawResponses,
  RCGRequest,
  RCGRequests,
  RCGResponse,
} from "../request.ts";
import type { RCGProgramCard } from "./program.ts";
import type { RCGRawCardData } from "./raw.ts";

export interface RCGBattleStat {
  attack: number;
  defense: number;
}

export interface RCGCharacterCardData
  extends RCGRawCardData, Partial<RCGBattleStat> {
  range?: number;
  speed?: number;
}

export interface RCGCharacterCard extends RCGProgramCard, RCGCharacterCardData {
  battle(defender: RCGCharacterCard, axis: RCGAxis): RCGBattleEvent | undefined;

  consume(bytes: RCGByte[]): RCGProcess;

  damage(
    amount: number,
    source?: RCGCharacterCard,
    controller?: RCGCharacterCard,
  ): RCGIntegrityEvent | undefined;

  deleteCards(cards: RCGCard[]): RCGCardEvent | undefined;

  discard(cards: RCGCard[]): RCGCardEvent | undefined;

  download(cards: RCGCard[]): RCGCardEvent | undefined;

  draw(count: number): RCGCardEvent | undefined;

  enqueue(cards: RCGCard[]): RCGCardEvent | undefined;

  getAttackerBattleStat(
    defender: RCGCharacterCard,
    axis: RCGAxis,
  ): RCGBattleStat;

  getBattleStats(
    defender: RCGCharacterCard,
    axis: RCGAxis,
  ): [RCGBattleStat, RCGBattleStat];

  getDefenderBattleStat(
    defender: RCGCharacterCard,
    axis: RCGAxis,
  ): RCGBattleStat;

  getMovableCoordinates(): RCGCoordinate[];

  getMovableOrientations(): RCGOrientation[];

  getRange(): number;

  getSpeed(): number;

  isInRange(card: RCGProgramCard): boolean;

  move(orientation: RCGOrientation): RCGCardEvent | undefined;

  request<TRequest extends RCGRequest<unknown>>(
    request: TRequest,
  ):
    | Generator<
        RCGRequests<TRequest>,
        RCGResponse<TRequest>,
        RCGRawResponses | undefined
      >
    | undefined;

  reveal(cards: RCGCard[]): RCGRevealEvent | undefined;

  stage(cards: RCGCard[]): RCGCardEvent | undefined;

  use(card: RCGCard): RCGUsageEffectEvent | undefined;
}
