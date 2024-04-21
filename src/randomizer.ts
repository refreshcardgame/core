import { last } from "lodash-es";
import {
  uniformIntDistribution,
  xoroshiro128plus,
  type RandomGenerator,
} from "pure-rand";

export class RCGRandomizer {
  algorithm: ((seed: number) => RandomGenerator) & {
    fromState: (state: readonly number[]) => RandomGenerator;
  };
  randomGenerators: RandomGenerator[] = [];
  seed: number;

  constructor(seed: number, algorithm = xoroshiro128plus) {
    this.algorithm = algorithm;
    this.seed = seed;
  }

  getRandomGenerator(): RandomGenerator {
    const currentRandomGenerator = last(this.randomGenerators);
    const nextRandomGenerator =
      currentRandomGenerator?.next()[1] ?? this.algorithm(this.seed);
    this.randomGenerators.push(nextRandomGenerator);
    return nextRandomGenerator;
  }

  getIntegerBetweenInclusive(
    minimumInteger: number,
    maximumInteger: number,
  ): number {
    return uniformIntDistribution(
      minimumInteger,
      maximumInteger,
    )(this.getRandomGenerator())[0];
  }

  getNonNegativeIntegerUpTo(maximumInteger: number): number {
    return this.getIntegerBetweenInclusive(0, maximumInteger);
  }

  shuffle<T>(array: T[]): T[] {
    for (
      let currentIndex = array.length - 1;
      currentIndex > 0;
      currentIndex--
    ) {
      const randomIndex = this.getNonNegativeIntegerUpTo(currentIndex);
      // Swap elements
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex] as T, // TypeScript can't infer that randomIndex is always valid here
        array[currentIndex] as T, // TypeScript can't infer that currentIndex is always valid here
      ];
    }

    return array;
  }
}
