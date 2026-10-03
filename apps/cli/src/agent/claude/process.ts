import { randomUUID } from 'node:crypto';
import { query, type Options, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { DebugLog } from '../../lib/debug.js';
import { Inbox } from '../../lib/inbox.js';
import type { AgentResume } from '../agent.js';
import { ClaudeEvents } from './events.js';

type Result = Extract<SDKMessage, { type: 'result' }>;

export type Content = SDKUserMessage['message']['content'];

export type Uuid = ReturnType<typeof randomUUID>;

export type ClaudeResume = AgentResume & { at?: string };

export interface ClaudeProcessOptions {
  options: Options;
  cwd: string;
  resume?: ClaudeResume;
  debug?: DebugLog;
  onIdle(message: SDKMessage): void;
  onTurn(): void;
  onExit(): void;
  spawn?: typeof query;
}

/** What comes while a prompt is being answered belongs to that turn; the rest goes to `onIdle`. */
export class ClaudeProcess {
  readonly query: ReturnType<typeof query>;
  readonly events: ClaudeEvents;
  readonly resumed?: ClaudeResume;
  private readonly input = new Inbox<SDKUserMessage>();
  /** `own` is a turn Claude Code started itself, which answers no prompt unless one was steered into it. */
  private turn?: { waiting: Set<string>; messages: Inbox<SDKMessage | Error>; interrupted?: boolean; own?: boolean };
  private unfollowed?: ClaudeProcess['turn'];
  private exited?: Error;
  private stderr = '';

  constructor(private readonly options: ClaudeProcessOptions) {
    const { spawn = query, debug } = options;

    this.events = new ClaudeEvents(options.cwd, options.resume?.cost);
    this.resumed = options.resume;

    this.query = spawn({
      prompt: this.input,
      options: {
        ...options.options,
        stderr: (data) => {
          this.stderr = (this.stderr + data).slice(-2000);
          debug?.write('stderr', data);
        },
      },
    });

    void this.read();
  }

  /** Yields until the results answering the prompt and those steered into the turn; `uuid` is where rewinding finds it. */
  async *send(content: Content, uuid: Uuid = randomUUID()): AsyncGenerator<SDKMessage> {
    if (this.exited) throw this.exited;
    if (this.turn) throw new Error('Claude Code is still answering the previous prompt.');

    const turn = { waiting: new Set<string>(), messages: new Inbox<SDKMessage | Error>() };

    this.turn = turn;
    this.push(content, uuid, turn);
    yield* this.drain(turn);
  }

  async *follow(): AsyncGenerator<SDKMessage> {
    const turn = this.unfollowed;

    this.unfollowed = undefined;
    if (turn) yield* this.drain(turn);
  }

  /** Claude Code reads it once the current tool calls finish, or answers it in a turn of its own right after, which still belongs to this one. */
  steer(content: Content) {
    if (!this.turn || this.exited) return undefined;

    const uuid = randomUUID();

    this.push(content, uuid, this.turn, 'next');

    return uuid;
  }

  interrupt() {
    if (this.turn) this.turn.interrupted = true;
    this.query.interrupt().catch(() => {});
  }

  close() {
    this.input.close();
    this.query.close();
  }

  private async *drain(turn: NonNullable<ClaudeProcess['turn']>) {
    try {
      for await (const item of turn.messages) {
        if (item instanceof Error) throw item;

        yield item;
      }
    } finally {
      // Left before its result, e.g. by a caller that stopped reading.
      if (this.turn === turn) this.turn = undefined;
    }
  }

  private push(content: Content, uuid: Uuid, turn: NonNullable<ClaudeProcess['turn']>, priority?: 'next') {
    turn.waiting.add(uuid);
    this.options.debug?.write('prompt', { uuid, content: loggable(content), priority });

    this.input.push({
      type: 'user',
      uuid,
      message: { role: 'user', content },
      parent_tool_use_id: null,
      origin: { kind: 'human' },
      ...(priority && { priority }),
    });
  }

  private async read() {
    try {
      for await (const message of this.query) {
        this.options.debug?.write('message', message);
        let turn = this.turn;

        if (!turn && startsTurn(message)) {
          turn = { waiting: new Set(), messages: new Inbox(), own: true };
          this.turn = turn;
          this.unfollowed = turn;
          this.options.onTurn();
        }

        if (!turn) {
          this.options.onIdle(message);
          continue;
        }

        turn.messages.push(message);

        // The turn ends here rather than where it is read, so what comes right after its last result is idle.
        if (message.type === 'result' && (answered(message, turn.waiting) || turn.interrupted)) {
          this.turn = undefined;
          turn.messages.close();
        }
      }
    } catch {
      // Claude Code stopped sending; why is in its stderr.
    }

    const detail = this.stderr.trim().split('\n').slice(-5).join('\n');

    this.exited = new Error(detail ? `Claude Code exited:\n${detail}` : 'Claude Code exited unexpectedly.');
    this.turn?.messages.push(this.exited);
    this.turn?.messages.close();
    this.options.onExit();
  }
}

const loggable = (content: Content) =>
  typeof content === 'string'
    ? content
    : content.map((block) =>
        block.type === 'image' && block.source.type === 'base64' ? { type: 'image', bytes: block.source.data.length } : block,
      );

/** Claude Code's init, or the main agent's output when init didn't come; background subagents speak while no turn runs. */
function startsTurn(message: SDKMessage) {
  if (message.type === 'system') return message.subtype === 'init';

  return (message.type === 'assistant' || message.type === 'stream_event') && message.parent_tool_use_id === null;
}

function answered(result: Result, waiting: Set<string>) {
  const ids = result.user_message_uuids ?? (result.user_message_uuid ? [result.user_message_uuid] : undefined);
  // A result that doesn't say which prompts it answers ends the turn, as before Claude Code reported them, unless it
  // ends a turn Claude Code started itself, e.g. for a background task, which answers none of them.
  const own = result.origin !== undefined && result.origin.kind !== 'human';

  if (!ids && !own) waiting.clear();
  for (const id of ids ?? []) waiting.delete(id);

  return waiting.size === 0;
}

export function errorOf(result: Result) {
  if (result.subtype === 'success') return result.result || 'Claude Code reported an error.';

  return result.errors.join('\n') || `Claude Code stopped: ${result.subtype}.`;
}
