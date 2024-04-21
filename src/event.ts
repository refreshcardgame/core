import { Queue } from "queue-typed";
import { Stack } from "stack-typed";
import { toShifted } from "./array.ts";
import { getAvailableCommands, type RCGUseCommand } from "./command.ts";
import type { RCGGame } from "./game.ts";
import { wrap, type RCGProcess, type RCGSemiGenerator } from "./generator.ts";
import type { RCGPlayer } from "./player.ts";
import { capitalize } from "./string.ts";
import type { RCGCharacterCard } from "./types/cards/character.ts";

export type RCGEventName = string;
export type RCGTiming = string;
export type RCGScope = string;

export class RCGEvent {
  afterEvent: ((event: RCGEvent) => RCGSemiGenerator<RCGProcess>)[] = [];
  aliases: string[] = [];
  controller?: RCGCharacterCard | RCGPlayer;
  children: RCGEvent[] = [];
  finished = false;
  game: RCGGame;
  name: RCGEventName;
  parent?: RCGEvent;
  priorityPointer?: RCGPlayer;
  process?: RCGProcess;
  triggeredFrom: RCGTiming[] = [];
  triggering: RCGTiming[] = [];

  constructor(
    game: RCGGame,
    name: RCGEventName,
    controller?: RCGCharacterCard | RCGPlayer,
  ) {
    this.game = game;
    this.name = name;
    if (controller) this.controller = controller;
  }

  getAllChildren<T extends RCGEvent>(
    filter?: (event: RCGEvent) => event is T,
    algorithm: "depth" | "breadth" = "depth",
  ): T[] {
    const result: T[] = [];

    if (algorithm === "breadth") {
      const queue = new Queue(this.children);

      while (!queue.isEmpty()) {
        const event = queue.shift();
        if (!event) break;
        if (!filter || filter(event)) result.push(event as T);
        queue.pushMany(event.children);
      }
    } else {
      const stack = new Stack(this.children);

      while (!stack.isEmpty()) {
        const event = stack.pop();
        if (!event) break;
        if (!filter || filter(event)) result.push(event as T);
        const children = event.children.slice();
        let child;

        while ((child = children.pop())) {
          stack.push(child);
        }
      }
    }

    return result;
  }

  getController(): RCGCharacterCard | undefined {
    if (this.controller?.type === "card") return this.controller;
  }

  getPlayer(): RCGPlayer | undefined {
    const player = this.getController()?.getController();
    if (player) return player;
    if (this.controller?.type === "player") return this.controller;
  }

  preResolve?(): RCGSemiGenerator<RCGProcess>;

  register?(): RCGSemiGenerator<RCGProcess>;

  resolve?(): RCGSemiGenerator<RCGProcess>;

  *run(): RCGProcess {
    let result = true;
    if (this.register) result = yield* wrap(this.register());

    if (result) {
      yield* this.trigger(
        this.aliases
          .concat(this.name)
          .map((name) => `before${capitalize(name)}`),
      );
      if (this.preResolve) result = yield* wrap(this.preResolve());
      if (this.resolve) result = yield* wrap(this.resolve());
      yield* this.trigger(
        this.aliases
          .concat(this.name)
          .map((name) => `after${capitalize(name)}`),
      );
    }

    return result;
  }

  *trigger(timings: RCGTiming[]): RCGProcess {
    const firstPriorityPointer =
      this.game.getTurnPointer() ?? this.game.getStartingPointer();
    if (!firstPriorityPointer) return false;
    this.triggering.push(...timings);

    for (const player of toShifted(
      this.game.state.players,
      firstPriorityPointer,
    )) {
      this.priorityPointer = player;

      for (;;) {
        const options = getAvailableCommands(this, player);

        const { commands } = yield* player.request({
          commands: { maximum: 1, minimum: 0, options },
        });
        const command = commands[0];
        if (!command) break;
        const [character, subcommand, args] = command;
        // TypeScript type narrowing is not working properly here
        const event = character[subcommand as RCGUseCommand[1]](
          ...(args as RCGUseCommand[2]),
        );
        if (!event) continue;
        event.aliases.push("command");
        yield* event;
      }
    }

    delete this.priorityPointer;
    this.triggering.length = 0;
    return true;
  }

  *[Symbol.iterator](): RCGProcess {
    const currentEvent = this.game.getCurrentEvent();

    if (currentEvent) {
      currentEvent.children.push(this);
      this.triggeredFrom.push(...currentEvent.triggering);
      this.parent = currentEvent;
    }

    this.game.events.push(this);
    this.process = this.run();
    const result = yield* this.process;
    delete this.process;
    const index = this.game.events.indexOf(this);
    if (index > -1) this.game.events.length = index;
    this.finished = true;

    for (const callback of this.afterEvent) {
      yield* wrap(callback(this));
    }

    return result;
  }
}
