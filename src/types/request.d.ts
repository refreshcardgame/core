import type { RCGPlayer } from "../player.ts";
import type { RCGRange } from "./range.js";

export interface RCGRequestField<T> extends RCGRange {
  defaultOptions?: number[];
  options: T[];
}

export type RCGRequest<T> = Record<string, RCGRequestField<T>>;

export type RCGRequests<TRequest extends RCGRequest<unknown>> = Map<
  RCGPlayer,
  TRequest
>;

export type RCGRawResponse = Record<string, number[]>;

export type RCGResponse<TRequest extends RCGRequest<unknown>> = {
  [TKey in keyof TRequest]: TRequest[TKey] extends RCGRequestField<infer T>
    ? T[]
    : never;
};

export type RCGRawResponses = Map<RCGPlayer, RCGRawResponse>;

export type RCGResponses<TRequest extends RCGRequest<unknown>> = Map<
  RCGPlayer,
  RCGResponse<TRequest>
>;
