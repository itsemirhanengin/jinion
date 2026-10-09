import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CodexProcess } from '../../src/agent/codex/connection.js';

// biome-ignore lint/suspicious/noExplicitAny: messages of every shape go through it.
type Message = Record<string, any>;

export interface FakeCodexOptions {
  /** Each turn's end waits for Jinion to interrupt it, as a turn the user stops does. */
  holdUntilInterrupt?: boolean;
  /** What it answers other requests with, by method, such as `thread/turns/list`. */
  answers?: Record<string, unknown>;
}

/**
 * A `codex app-server` that answers Jinion's requests itself and plays a recorded fixture, one turn per `turn/start`
 * or `thread/compact/start`. What it asks Jinion waits for the answer, as the real one does.
 */
export class FakeCodex {
  /** Everything Jinion sent, in order. */
  readonly received: Message[] = [];
  /** Jinion's answers to what it asked, by request id. */
  readonly answers = new Map<number | string, unknown>();
  readonly thread: string;
  private readonly turns: Message[][];
  private line?: (line: string) => void;
  private exit?: (error?: Error) => void;
  private readonly answered = new Map<number | string, () => void>();
  private interrupted?: () => void;

  constructor(
    fixture: string,
    private readonly options: FakeCodexOptions = {},
  ) {
    const messages = readFileSync(join(import.meta.dirname, '..', 'agent', 'codex', 'fixtures', `${fixture}.jsonl`), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Message);

    this.thread = messages.find((message) => message.params?.threadId)?.params.threadId;
    this.turns = splitTurns(messages);
  }

  readonly start = (): CodexProcess => ({
    write: (line) => this.receive(JSON.parse(line) as Message),
    onLine: (listener) => (this.line = listener),
    onExit: (listener) => (this.exit = listener),
    kill: () => {},
  });

  /** Requests Jinion sent with `method`. */
  sent(method: string) {
    return this.received.filter((message) => message.method === method);
  }

  /** A notification the fixture doesn't have, such as the item a steered message starts as the model gets it. */
  notify(method: string, params: Message) {
    this.send({ method, params });
  }

  /** The app-server stops, as when it crashes. */
  crash() {
    this.exit?.(new Error('Codex stopped (exit code 1): it crashed.'));
  }

  private receive(message: Message) {
    this.received.push(message);

    if (message.method === undefined) {
      this.answers.set(message.id, message.result ?? message.error);
      this.answered.get(message.id)?.();

      return;
    }

    if (message.method === 'turn/interrupt') this.interrupted?.();
    if (message.id === undefined) return;

    const turn = message.method === 'turn/start' || message.method === 'thread/compact/start' ? this.turns.shift() : undefined;

    setImmediate(() => {
      this.send({ id: message.id, result: this.result(message, turn) });
      if (turn) void this.play(turn);
    });
  }

  private result(message: Message, turn: Message[] | undefined) {
    switch (message.method) {
      case 'thread/start':
      case 'thread/resume':
        return {
          thread: { id: this.thread },
          sandbox: { type: 'workspaceWrite', writableRoots: [], networkAccess: true, excludeTmpdirEnvVar: false, excludeSlashTmp: false },
        };

      case 'turn/start':
        return { turn: { id: turn?.find((item) => item.method === 'turn/started')?.params.turn.id, status: 'inProgress', error: null } };

      default:
        return this.options.answers?.[message.method] ?? {};
    }
  }

  private async play(turn: Message[]) {
    for (const message of turn) {
      await new Promise((resolve) => setImmediate(resolve));

      if (message.method === 'turn/completed' && this.options.holdUntilInterrupt) {
        await new Promise<void>((resolve) => (this.interrupted = resolve));
      }

      this.send(message);

      if (message.id !== undefined) await new Promise<void>((resolve) => this.answered.set(message.id, resolve));
    }
  }

  private send(message: Message) {
    this.line?.(JSON.stringify(message));
  }
}

/** Each turn, from what came before its end; what comes after the last one, such as a background command ending, goes with it. */
function splitTurns(messages: Message[]) {
  const turns: Message[][] = [[]];

  for (const message of messages) {
    turns.at(-1)!.push(message);
    if (message.method === 'turn/completed') turns.push([]);
  }

  const after = turns.pop()!;

  turns.at(-1)?.push(...after);

  return turns.filter((turn) => turn.length > 0);
}
