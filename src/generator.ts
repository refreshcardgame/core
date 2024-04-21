import type { RCGEvent } from "./event.ts";
import type {
  RCGRawResponses,
  RCGRequest,
  RCGRequests,
} from "./types/request.ts";

export type RCGProcess = Generator<
  RCGRequests<RCGRequest<unknown>>,
  boolean,
  RCGRawResponses | undefined
>;

export type RCGSemiGenerator<TGenerator extends Generator> =
  TGenerator extends Generator<infer TYield, infer TReturn, infer TNext>
    ? TReturn | Generator<TYield, TReturn, TNext>
    : never;

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

export function* wrap(
  generator?: RCGEvent | RCGSemiGenerator<RCGProcess>,
): RCGProcess {
  if (isGenerator(generator)) return yield* generator;
  if (typeof generator === "boolean") return generator;
  return generator ? yield* generator : false;
}
