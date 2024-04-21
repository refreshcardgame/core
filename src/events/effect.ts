import {
  RCGCard,
  type RCG1DSharedCardPosition,
  type RCGCardPosition,
} from "../card.ts";
import { RCGEvent, wrapEvent } from "../event.ts";
import type { RCGGame } from "../game.ts";
import {
  wrapSemi,
  type RCGProcess,
  type RCGSemiGenerator,
} from "../generator.ts";
import type { RCGEffectName } from "../types/effect.js";

export class RCGEffectEvent extends RCGEvent {
  effect?: RCGEffectName;
  positions = new Map<RCGCard, RCGCardPosition>();
  targets: RCGCard[][] = [];

  constructor(game: RCGGame, controller: RCGCard, effect?: RCGEffectName) {
    super(game, "effect", controller);
    if (effect) this.effect = effect;
  }

  getValidTargets(): RCGCard[] {
    return this.controller && this.effect
      ? this.game.getValidTargets(this.controller, this.effect, this.targets)
      : [];
  }

  input(): RCGSemiGenerator<RCGProcess> {
    return (
      typeof this.effect !== "string" ||
      wrapSemi(this.game.effects.get(this.effect)?.input?.(this) ?? true)
    );
  }

  isAvailable(target?: RCGCard): target is RCGCard {
    return (
      !!target &&
      this.targets.some((group) => group.includes(target)) &&
      target.position === this.positions.get(target)
    );
  }

  output(): RCGSemiGenerator<RCGProcess> {
    return (
      typeof this.effect !== "string" ||
      wrapSemi(this.game.effects.get(this.effect)?.output?.(this) ?? true)
    );
  }

  postInput?(): RCGSemiGenerator<RCGProcess>;

  *preInput(): RCGSemiGenerator<RCGProcess> {
    if (!this.controller || !this.effect) return true;
    const player = this.getPlayer();
    if (!player) return false;
    if (!(yield* wrapSemi(this.target()))) return false;
    return yield* player.consume(
      this.controller,
      this.game.effects.get(this.effect)?.bytes ?? [],
    );
  }

  override *register(): RCGSemiGenerator<RCGProcess> {
    if (!(yield* wrapSemi(this.preInput()))) return false;
    if (!(yield* wrapSemi(this.input()))) return false;
    return yield* wrapSemi(this.postInput?.() ?? true);
  }

  override resolve(): RCGSemiGenerator<RCGProcess> {
    return wrapSemi(this.output());
  }

  *target(): RCGSemiGenerator<RCGProcess> {
    if (!this.effect) return true;
    const player = this.getPlayer();
    if (!player) return false;
    const effect = this.game.effects.get(this.effect);
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
        this.positions.set(card, position);
      }

      this.targets.push(cards);
    }

    return true;
  }
}

export class RCGUsageEffectEvent extends RCGEffectEvent {
  card: RCGCard;
  position?: RCG1DSharedCardPosition;

  constructor(game: RCGGame, user: RCGCard, card: RCGCard) {
    super(game, user, card.usage);
    this.card = card;
  }

  override getValidTargets(): RCGCard[] {
    return this.controller
      ? this.game.getValidTargets(this.controller, this.card, this.targets)
      : [];
  }

  override postInput(): RCGSemiGenerator<RCGProcess> {
    const position = this.card.position;
    if (position?.zone !== "buffer") return false;
    this.position = position;
    return true;
  }

  override *preInput(): RCGSemiGenerator<RCGProcess> {
    if (!this.controller) return false;
    const player = this.getPlayer();
    if (!player) return false;
    return (
      (yield* wrapEvent(player.stage(this.controller, [this.card]))) &&
      (yield* wrapSemi(super.preInput()))
    );
  }

  override preResolve(): RCGSemiGenerator<RCGProcess> {
    if (this.card.position === this.position) return true;
    this.process?.return(false);
    return false;
  }
}
