import { shuffle, take } from "lodash-es";
import {
  RCGCard,
  RCGGame,
  RCGPlayer,
  type RCGRawResponses,
} from "../src/index.ts";
import { cacheOfGreedCard, peekOperationCard } from "./card.ts";
import { cacheOfGreedUsage, peekOperationUsage } from "./effect.ts";

const game = new RCGGame();
game.addCardDefinition(cacheOfGreedCard);
game.addCardDefinition(peekOperationCard);
game.addEffect(cacheOfGreedUsage);
game.addEffect(peekOperationUsage);
const playerA = new RCGPlayer(game, "A");
const playerB = new RCGPlayer(game, "B");
game.addPlayers([playerA, playerB]);

for (let repetition = 0; repetition < 32; repetition++) {
  playerA.addCard(new RCGCard(game, "refresh:cacheOfGreed"), "deck");
  playerB.addCard(new RCGCard(game, "refresh:peekOperation"), "deck");
}

const process = game.start();
let responses: RCGRawResponses | undefined;

for (;;) {
  const { done, value } = process.next(responses);
  if (!done)
    responses = new Map(
      value.entries().map(([player, request]) => [
        player,
        Object.fromEntries(
          Object.entries(request).map(
            ([
              key,
              {
                maximum,
                options: { length },
              },
            ]) => [
              key,
              take(
                shuffle(Array.from({ length }, (_, index) => index)),
                maximum,
              ),
            ],
          ),
        ),
      ]),
    );
}
