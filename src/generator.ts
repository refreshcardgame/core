import type {
  RCGRawResponses,
  RCGRequest,
  RCGRequests,
} from "./types/request.js";

export type RCGSemiGenerator<TGenerator extends Generator> =
  TGenerator extends Generator<infer TYield, infer TReturn, infer TNext>
    ? TReturn | Generator<TYield, TReturn, TNext>
    : never;

export type RCGProcess = Generator<
  RCGRequests<RCGRequest<unknown>>,
  boolean,
  RCGRawResponses | undefined
>;

export function isGenerator(value: unknown): value is Generator {
  return (
    !!value &&
    typeof value === "object" &&
    "next" in value &&
    typeof value.next === "function" &&
    "return" in value &&
    typeof value.return === "function" &&
    "throw" in value &&
    typeof value.throw === "function"
  );
}

export function* wrapSemi<TYield, TReturn, TNext>(
  generator: RCGSemiGenerator<Generator<TYield, TReturn, TNext>>,
): Generator<TYield, TReturn, TNext> {
  return isGenerator(generator) ? yield* generator : generator;
}
