import { pullAll, takeRight } from "lodash-es";
import { wrap, type RCGEffect } from "../src/index.ts";

export const cacheOfGreedUsage: RCGEffect = {
  bytes: [],
  name: "refresh:cacheOfGreed",
  *output(event) {
    yield* wrap(event.getController()?.draw(2));
    return true;
  },
  triggers: ["main"],
};

export const peekOperationUsage: RCGEffect = {
  bytes: [],
  name: "refresh:peekOperation",
  *output(event) {
    const options = takeRight(event.getPlayer()?.getDeck(), 4);
    const cardsGenerator = event
      .getPlayer()
      ?.request({ cards: { maximum: 1, minimum: 1, options } });

    if (cardsGenerator) {
      const { cards } = yield* cardsGenerator;
      yield* wrap(event.getController()?.download(cards));
      pullAll(options, cards);
    }

    const { length } = options;
    const orderGenerator = event.getPlayer()?.request({
      order: {
        defaultOptions: Array.from({ length }, (_, index) => index),
        maximum: length,
        minimum: length,
        options,
      },
    });
    yield* wrap(
      event
        .getController()
        ?.enqueue(orderGenerator ? (yield* orderGenerator).order : options),
    );
    return true;
  },
  triggers: ["main"],
};
