import {
  RCGCard,
  type RCG1DSharedCardPosition,
  type RCGCardPosition,
} from "../card.ts";
import { RCGEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import { wrap, type RCGProcess, type RCGSemiGenerator } from "../generator.ts";
import type { RCGCharacterCard } from "../types/cards/character.ts";
import type { RCGEffect, RCGEffectName } from "../types/effect.ts";

export class RCGEffectEvent extends RCGEvent {
  effect?: RCGEffectName;
  targetPositions = new Map<RCGCharacterCard, RCGCardPosition>();
  targets: RCGCard[][] = [];

  constructor(
    game: RCGGame,
    controller: RCGCharacterCard,
    effect?: RCGEffectName,
  ) {
    super(game, "effect", controller);
    if (effect) this.effect = effect;
  }

  getEffect(): RCGEffect | undefined {
    if (this.effect) return this.game.effects.get(this.effect);
  }

  getValidTargets(): RCGCard[] {
    const controller = this.getController();
    return controller && this.effect
      ? this.game.getValidTargets(controller, this.effect, this.targets)
      : [];
  }

  input(): RCGSemiGenerator<RCGProcess> {
    return (
      typeof this.effect !== "string" ||
      wrap(this.getEffect()?.input?.(this) ?? true)
    );
  }

  isTargetAvailable(target?: RCGCard): target is RCGCard {
    return (
      !!target &&
      this.targets.some((group) => group.includes(target)) &&
      target.position === this.targetPositions.get(target)
    );
  }

  output(): RCGSemiGenerator<RCGProcess> {
    return (
      typeof this.effect !== "string" ||
      wrap(this.getEffect()?.output?.(this) ?? true)
    );
  }

  postInput?(): RCGSemiGenerator<RCGProcess>;

  *preInput(): RCGSemiGenerator<RCGProcess> {
    return (
      this.effect &&
      (yield* wrap(this.target())) &&
      (yield* wrap(
        this.getController()?.consume(this.getEffect()?.bytes ?? []),
      ))
    );
  }

  override *register(): RCGSemiGenerator<RCGProcess> {
    if (!(yield* wrap(this.preInput()))) return false;
    if (!(yield* wrap(this.input()))) return false;
    return yield* wrap(this.postInput?.() ?? true);
  }

  override resolve(): RCGSemiGenerator<RCGProcess> {
    return wrap(this.output());
  }

  *target(): RCGSemiGenerator<RCGProcess> {
    if (!this.effect) return true;
    const player = this.getPlayer();
    if (!player) return false;
    const effect = this.getEffect();
    if (!effect?.targets?.length) return true;

    for (;;) {
      const target = effect.targets[this.targets.length];
      if (!target) break;
      const { maximum, minimum } = target;
      const { cards } = yield* player.request({
        cards: { maximum, minimum, options: this.getValidTargets() },
      });

      for (const card of cards) {
        const { position } = card;
        if (!position) return false;
        this.targetPositions.set(card, position);
      }

      this.targets.push(cards);
    }

    return true;
  }
}

export class RCGUsageEffectEvent extends RCGEffectEvent {
  card: RCGCard;
  position?: RCG1DSharedCardPosition;

  constructor(game: RCGGame, user: RCGCharacterCard, card: RCGCard) {
    super(game, user, card.usage);
    this.card = card;
  }

  override getValidTargets(): RCGCard[] {
    const controller = this.getController();
    return controller
      ? this.game.getValidTargets(controller, this.card, this.targets)
      : [];
  }

  override postInput(): RCGSemiGenerator<RCGProcess> {
    const position = this.card.position;
    if (position?.zone !== "buffer") return false;
    this.position = position;
    return true;
  }

  override *preInput(): RCGSemiGenerator<RCGProcess> {
    return (
      (yield* wrap(this.getController()?.stage([this.card]))) &&
      (yield* wrap(super.preInput()))
    );
  }

  override preResolve(): RCGSemiGenerator<RCGProcess> {
    if (this.card.position === this.position) return true;
    this.process?.return(false);
    return false;
  }
}
