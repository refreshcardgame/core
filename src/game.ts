import { last, pull, remove, takeRight } from "lodash-es";
import type { Constructor } from "type-fest";
import {
  RCGCard,
  type RCGCardData,
  type RCGCardID,
  type RCGCardName,
  type RCGRelativeCardPosition,
} from "./card.ts";
import type { RCGEvent, RCGScope } from "./event.ts";
import { RCGCardEvent } from "./events/card.ts";
import { RCGEffectEvent } from "./events/effect.ts";
import { RCGInitialEvent } from "./events/initial.ts";
import { RCGIntegrityEvent } from "./events/integrity.ts";
import { RCGRevealEvent } from "./events/reveal.ts";
import { RCGRoundEvent } from "./events/round.ts";
import { RCGTurnEvent } from "./events/turn.ts";
import type { RCGProcess } from "./generator.ts";
import { RCGGrid } from "./grid.ts";
import type { RCGPlayer, RCGPlayerName } from "./player.ts";
import { RCGRandomizer } from "./randomizer.ts";
import { RCGState } from "./state.ts";
import type { RCGCharacterCard } from "./types/cards/character.ts";
import type {
  RCGEffect,
  RCGEffectLimit,
  RCGEffectName,
} from "./types/effect.ts";
import type { RCGExtension } from "./types/extension.ts";
import type {
  RCGRawResponse,
  RCGRawResponses,
  RCGRequest,
  RCGRequests,
  RCGResponse,
  RCGResponses,
} from "./types/request.ts";

export type RCGCardDefinition = Omit<RCGCardData, "id" | "type">;

export class RCGGame {
  cardDefinitions = new Map<RCGCardName, RCGCardDefinition>([
    [
      "refresh:basicCharacter",
      {
        attack: 1,
        defense: 1,
        name: "refresh:basicCharacter",
        range: 1,
        speed: 1,
        types: ["character"],
      },
    ],
  ]);
  effects = new Map<RCGEffectName, RCGEffect>();
  events: RCGEvent[] = [];
  extensions = new Map<string, RCGExtension>();
  randomizer: RCGRandomizer;
  state: RCGState;
  started = false;

  constructor(
    grid = new RCGGrid([
      { x: 0, y: 0 },
      { x: 7, y: 0 },
      { x: 7, y: 7 },
      { x: 0, y: 7 },
    ]),
    seed = (
      crypto.getRandomValues(new Uint32Array(1)) as Uint32Array & { 0: number }
    )[0], // TypeScript can't infer that 0 is always valid here
  ) {
    this.randomizer = new RCGRandomizer(seed);
    this.state = new RCGState(grid, seed);
  }

  addCard(card: RCGCard): this {
    this.state.cards.set(card.id, card);
    return this;
  }

  addCardDefinition(definition: RCGCardDefinition): this {
    this.cardDefinitions.set(definition.name, definition);
    return this;
  }

  addCardDefinitions(definitions: RCGCardDefinition[]): this {
    for (const definition of definitions) {
      this.addCardDefinition(definition);
    }

    return this;
  }

  addCards(cards: RCGCard[]): this {
    for (const card of cards) {
      this.addCard(card);
    }

    return this;
  }

  addEffect(effect: RCGEffect): this {
    this.effects.set(effect.name, effect);
    return this;
  }

  addEffects(effects: RCGEffect[]): this {
    for (const effect of effects) {
      this.addEffect(effect);
    }

    return this;
  }

  addPlayer(player: RCGPlayer): this {
    this.state.players.push(player);
    return this;
  }

  addPlayers(players: RCGPlayer[]): this {
    this.state.players.push(...players);
    return this;
  }

  canStart(): boolean {
    return this.state.players.length > 1;
  }

  damage(
    target: RCGCharacterCard,
    amount: number,
    source?: RCGCharacterCard,
    controller?: RCGCharacterCard,
  ): RCGIntegrityEvent | undefined {
    if (amount !== 0)
      return new RCGIntegrityEvent(
        this,
        new Map([
          [
            target,
            [
              source
                ? { amount: -amount, source, type: "damage" }
                : { amount: -amount, type: "damage" },
            ],
          ],
        ]),
        controller,
      );
  }

  deleteCards(
    cards: RCGCard[] | Map<RCGPlayer, RCGCard[]>,
    controller?: RCGCharacterCard,
  ): RCGCardEvent | undefined {
    if (Array.isArray(cards)) {
      const groupedCards = new Map<RCGPlayer, RCGCard[]>();

      for (const card of cards) {
        const { owner } = card;
        if (!owner) continue;
        const player = this.getPlayer(owner);
        if (player && !groupedCards.get(player)?.push(card))
          groupedCards.set(player, [card]);
      }

      cards = groupedCards;
    }

    const to = new Map(
      cards
        .entries()
        .filter(([, { length }]) => length)
        .map(([{ name }, cards]) => [
          {
            player: name,
            zone: "recycleBin",
          } satisfies RCGRelativeCardPosition,
          cards,
        ]),
    );
    if (to.size) return new RCGCardEvent(this, to, controller);
  }

  discard(
    cards: RCGCard[] | Map<RCGPlayer, RCGCard[]>,
    controller?: RCGCharacterCard,
  ): RCGCardEvent | undefined {
    return this.deleteCards(
      Array.isArray(cards)
        ? cards.filter(({ position }) => position?.zone === "hand")
        : new Map(
            cards
              .entries()
              .map(([playerDiscardTo, cardsToDiscard]) => [
                playerDiscardTo,
                cardsToDiscard.filter(
                  ({ position }) => position?.zone === "hand",
                ),
              ]),
          ),
      controller,
    );
  }

  download(
    cards: RCGCard[] | Map<RCGPlayer, RCGCard[]>,
    controller?: RCGCharacterCard,
  ): RCGCardEvent | undefined {
    if (Array.isArray(cards)) {
      const groupedCards = new Map<RCGPlayer, RCGCard[]>();

      for (const card of cards) {
        const { owner } = card;
        if (!owner) continue;
        const player = this.getPlayer(owner);
        if (player && !groupedCards.get(player)?.push(card))
          groupedCards.set(player, [card]);
      }

      cards = groupedCards;
    }

    const to = new Map(
      cards
        .entries()
        .filter(([, { length }]) => length)
        .map(([{ name }, cards]) => [
          { player: name, zone: "hand" } satisfies RCGRelativeCardPosition,
          cards,
        ]),
    );
    if (to.size) return new RCGCardEvent(this, to, controller);
  }

  draw(
    counts: Map<RCGPlayer, number>,
    controller?: RCGCharacterCard,
  ): RCGCardEvent | undefined {
    const to = new Map(
      counts
        .entries()
        .map<[RCGRelativeCardPosition, RCGCard[]]>(
          ([{ deck, name }, count]) => [
            { player: name, zone: "hand" },
            takeRight(this.getCards(deck), count),
          ],
        )
        .filter(([, { length }]) => length),
    );
    if (to.size) return new RCGCardEvent(this, to, controller);
  }

  enqueue(
    cards: RCGCard[] | Map<RCGPlayer, RCGCard[]>,
    controller?: RCGCharacterCard,
  ): RCGCardEvent | undefined {
    if (Array.isArray(cards)) {
      const groupedCards = new Map<RCGPlayer, RCGCard[]>();

      for (const card of cards) {
        const { owner } = card;
        if (!owner) continue;
        const player = this.getPlayer(owner);
        if (player && !groupedCards.get(player)?.push(card))
          groupedCards.set(player, [card]);
      }

      cards = groupedCards;
    }

    const to = new Map<RCGRelativeCardPosition, RCGCard[]>(
      cards
        .entries()
        .filter(([, { length }]) => length)
        .map(([{ name }, cards]) => [
          { index: 0, player: name, zone: "deck" },
          cards,
        ]),
    );
    if (to.size) return new RCGCardEvent(this, to, controller);
  }

  getActivationCount(
    character: RCGCharacterCard,
    scope: RCGScope,
    effect?: RCGEffectName | RCGEffect,
  ): number {
    if (typeof effect !== "string") effect = effect?.name;
    let event = this.getCurrentEvent();
    let eventScope = true;

    for (;;) {
      if (!event) return 0;
      if (event.name === scope) break;

      if (event.triggering.includes(scope)) {
        eventScope = false;
        break;
      }

      if (event.triggeredFrom.includes(scope)) {
        event = event.parent;
        if (!event) return 0;
        eventScope = false;
        break;
      }

      event = event.parent;
    }

    const filter: (event: RCGEvent) => event is RCGEffectEvent = effect
      ? (event): event is RCGEffectEvent =>
          event instanceof RCGEffectEvent &&
          event.getController()?.position === character.position &&
          event.effect === effect
      : (event): event is RCGEffectEvent =>
          event instanceof RCGEffectEvent &&
          event.getController()?.position === character.position;
    return (
      eventScope ? event.getAllChildren(filter) : event.children.filter(filter)
    ).length;
  }

  getEffectLimits(
    effect: RCGEffectName | RCGEffect,
  ): Record<RCGScope, RCGEffectLimit> {
    if (typeof effect === "string") {
      const foundEffect = this.effects.get(effect);
      if (!foundEffect) return {};
      effect = foundEffect;
    }

    return structuredClone(effect.limits) ?? {};
  }

  getCard(id: RCGCardID): RCGCard | undefined {
    return this.state.cards.get(id);
  }

  getCards(ids: RCGCardID[], filter?: (card: RCGCard) => boolean): RCGCard[] {
    return ids
      .map((id) => this.getCard(id))
      .filter((card): card is RCGCard => !!card && (!filter || filter(card)));
  }

  getCurrentEvent(): RCGEvent | undefined {
    return last(this.events);
  }

  getDefaultRawResponse(request: RCGRequest<unknown>): RCGRawResponse {
    const response: RCGRawResponse = {};

    for (const [key, field] of Object.entries(request)) {
      response[key] =
        field.defaultOptions?.slice() ??
        Array.from({ length: field.minimum }, (_, index) => index);
    }

    return response;
  }

  getEvent<TEvent extends RCGEvent>(
    eventClass: Constructor<TEvent>,
  ): TEvent | undefined {
    return this.events.findLast(
      eventClass[Symbol.hasInstance] as (event: RCGEvent) => event is TEvent,
    );
  }

  getPlayer(name?: string): RCGPlayer | undefined {
    if (name)
      return this.state.players.find(
        ({ name: playerName }) => playerName === name,
      );
  }

  getStartingPointer(): RCGPlayer | undefined {
    return this.state.players[0];
  }

  getTurnPointer(): RCGPlayer | undefined {
    return this.getEvent(RCGTurnEvent)?.getPlayer();
  }

  getValidTargets(
    character: RCGCharacterCard,
    cardOrEffect: RCGEffectName | RCGCard | RCGEffect,
    selections: RCGCard[][] = [],
  ): RCGCard[] {
    let effect;
    if (typeof cardOrEffect === "string")
      effect = this.effects.get(cardOrEffect);
    else if (cardOrEffect instanceof RCGCard) effect = cardOrEffect.getUsage();
    else effect = cardOrEffect;
    if (!effect) return [];
    const { targets } = effect;
    const predicate = targets?.[selections.length]?.predicate;
    if (!predicate) return [];
    return this.state.cards
      .values()
      .filter(
        (target) =>
          (target.position?.zone !== "field" || character.isInRange(target)) &&
          (cardOrEffect instanceof RCGCard
            ? predicate(this, character, target, selections, cardOrEffect)
            : predicate(this, character, target, selections)),
      )
      .toArray();
  }

  *initialize(): RCGProcess {
    return yield* new RCGInitialEvent(this);
  }

  async load(...extensions: RCGExtension[]): Promise<void> {
    const quickLookup = new Map<string, RCGExtension>(
      extensions.map((extension) => [extension.name, extension]),
    );
    const loaded = new Set<string>();
    const loading = new Set<string>();
    const sorted: RCGExtension[] = [];
    const visit = (extension: RCGExtension) => {
      if (loaded.has(extension.name)) return;
      if (loading.has(extension.name))
        throw new Error(
          `Circular dependency detected for extension "${extension.name}"`,
        );
      loading.add(extension.name);

      for (const dependency of extension.dependencies ?? []) {
        if (this.extensions.has(dependency)) continue;
        const dependencyExtension = quickLookup.get(dependency);
        if (!dependencyExtension)
          throw new Error(
            `Missing dependency "${dependency}" for extension "${extension.name}"`,
          );
        visit(dependencyExtension);
      }

      loading.delete(extension.name);
      loaded.add(extension.name);
      sorted.push(extension);
    };

    for (const extension of extensions) {
      visit(extension);
    }

    for (const extension of sorted) {
      this.extensions.set(extension.name, extension);
      await extension.initialize?.(this);
    }
  }

  removePlayer(player: RCGPlayer | RCGPlayerName): this {
    if (typeof player === "string")
      remove(this.state.players, ({ name }) => name === player);
    else pull(this.state.players, player);
    return this;
  }

  *request<TRequest extends RCGRequest<unknown>>(
    requests: RCGRequests<TRequest>,
  ): Generator<
    RCGRequests<TRequest>,
    RCGResponses<TRequest>,
    RCGRawResponses | undefined
  > {
    requesting: for (;;) {
      const rawResponses = yield new Map(
        requests.entries().map(([player, request]) => {
          for (const field of Object.values(request)) {
            const { defaultOptions, options } = field;
            if (defaultOptions) field.defaultOptions = defaultOptions.slice();
            field.options = options.slice();
          }

          return [player, request];
        }),
      );
      if (!rawResponses) continue;
      const responses: RCGResponses<TRequest> = new Map();

      for (const [player, request] of requests) {
        const rawResponse = rawResponses.get(player);
        if (!rawResponse) continue requesting;
        const response = {} as RCGResponse<TRequest>;

        for (const [key, field] of Object.entries(request)) {
          const { defaultOptions, maximum, minimum, options } = field;
          const indices = rawResponse[key] ?? defaultOptions;
          if (!indices) continue requesting;
          const { length } = indices;
          if (
            new Set(indices).size !== length ||
            length > maximum ||
            length < minimum
          )
            continue requesting;
          response[key as keyof RCGResponse<TRequest>] = indices.map(
            options.at,
            options,
          ) as RCGResponse<TRequest>[typeof key];
        }

        responses.set(player, response);
      }

      return responses;
    }
  }

  reveal(
    cards: RCGCard[],
    controller?: RCGCharacterCard,
  ): RCGRevealEvent | undefined {
    if (cards.length) return new RCGRevealEvent(this, cards, controller);
  }

  stage(
    cards: RCGCard[],
    controller?: RCGCharacterCard,
  ): RCGCardEvent | undefined {
    if (cards.length)
      return new RCGCardEvent(
        this,
        new Map([[{ zone: "buffer" }, cards]]),
        controller,
      );
  }

  *start(): RCGProcess {
    this.randomizer.shuffle(this.state.players).forEach((player, index) => {
      const { name } = player;
      let mainCharacter = player.getMainCharacter();

      if (!mainCharacter) {
        const card = new RCGCard(this, "refresh:basicCharacter");
        mainCharacter = card;
        player.addCharacter(card);
        card.owner = name;
        card.virtual = true;
      }

      const initialCoordinate = this.state.grid.getInitialCoordinate(
        index,
        this.state.players.length,
      );
      const { x, y } = initialCoordinate;
      mainCharacter.controller = name;
      mainCharacter.setPosition({
        direction: this.state.grid.getInitialDirection(initialCoordinate),
        x,
        y,
        zone: "field",
      });
      this.randomizer.shuffle(player.deck);

      for (const card of player.getDeck()) {
        card.controller = name;
        card.owner = name;
        card.position = { player: name, zone: "deck" };
      }

      for (const card of player.getExtraDeck()) {
        card.controller = name;
        card.owner = name;
        card.position = { player: name, zone: "extraDeck" };
      }

      for (const card of player.getHand()) {
        card.controller = name;
        card.owner = name;
        card.position = { player: name, zone: "hand" };
      }

      for (const card of player.getRecycleBin()) {
        card.controller = name;
        card.owner = name;
        card.position = { player: name, zone: "recycleBin" };
      }

      player.getDeck().pop()?.setPosition({ player: name, zone: "hand" });
    });

    for (const [, card] of this.state.cards) {
      card.initialize();
    }

    this.started = true;
    return yield* this.initialize();
  }

  round(): RCGRoundEvent {
    return new RCGRoundEvent(this);
  }
}
