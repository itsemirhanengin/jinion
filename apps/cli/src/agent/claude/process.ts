import { randomUUID } from 'node:crypto';
import { query, type Options, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { DebugLog } from '../../debug.js';
import type { AgentResume } from '../types.js';
import { ClaudeEvents } from './events.js';
import { Inbox } from './inbox.js';

type Result = Extract<SDKMessage, { type: 'result' }>;

/** A prompt's text, or its text and images. */
export type Content = SDKUserMessage['message']['content'];

/** Images in the debug log say how big they were rather than holding them. */
const loggable = (content: Content) =>
  typeof content === 'string'
    ? content
    : content.map((block) =>
        block.type === 'image' && block.source.type === 'base64' ? { type: 'image', bytes: block.source.data.length } : block,
      );

export interface ClaudeProcessOptions {
  /** Claude Code's options, without the prompt and stderr, which the process takes care of. */
  options: Options;
  cwd: string;
  /** The conversation this process continues. */
  resume?: AgentResume;
  debug?: DebugLog;
  /** What Claude Code sends while no turn runs, e.g. its commands changing after a turn, or a turn it starts itself. */
  onIdle(message: SDKMessage): void;
  /** The process ended, whether it was closed or exited on its own. */
  onExit(): void;
  /** Starts Claude Code: the SDK's `query`, or a stand-in in tests. */
  spawn?: typeof query;
}

/**
 * One Claude Code process and the conversation it holds. Everything it sends is read for as long as it runs; what
 * comes while a prompt is being answered belongs to that turn, the rest goes to `onIdle`.
 */
export class ClaudeProcess {
  readonly query: ReturnType<typeof query>;
  /** Maps this conversation's messages; it keeps their session id, cost and tool calls. */
  readonly events: ClaudeEvents;
  private readonly input = new Inbox<SDKUserMessage>();
  /** The prompts the turn in progress still has to answer, and where what it sends goes. */
  private turn?: { waiting: Set<string>; messages: Inbox<SDKMessage | Error>; interrupted?: boolean };
  private exited?: Error;
  private stderr = '';

  constructor(private readonly options: ClaudeProcessOptions) {
    const { spawn = query, debug } = options;
    this.events = new ClaudeEvents(options.cwd, options.resume?.cost);
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

  /**
   * Sends a prompt, then yields what Claude Code sends until the results that answer it and the messages steered into
   * the turn, which come last. Fails when the process exits first.
   */
  async *send(content: Content): AsyncGenerator<SDKMessage> {
    if (this.exited) throw this.exited;
    if (this.turn) throw new Error('Claude Code is still answering the previous prompt.');
    const turn = { waiting: new Set<string>(), messages: new Inbox<SDKMessage | Error>() };
    this.turn = turn;
    this.push(content, turn);
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

  /**
   * Adds a message to the turn in progress. Claude Code reads it as soon as the current tool calls finish, or answers
   * it in a turn of its own right after, which still belongs to this one. False when no turn runs to take it.
   */
  steer(content: Content) {
    if (!this.turn || this.exited) return false;
    this.push(content, this.turn, 'next');
    return true;
  }

  /** Stops the turn in progress; it ends with the next result, whatever was steered into it. */
  interrupt() {
    if (this.turn) this.turn.interrupted = true;
    this.query.interrupt().catch(() => {});
  }

  close() {
    this.input.close();
    this.query.close();
  }

  private push(content: Content, turn: NonNullable<ClaudeProcess['turn']>, priority?: 'next') {
    const uuid = randomUUID();
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
        const turn = this.turn;
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

/** Takes the prompts `result` answers off `waiting`, and says whether none are left. */
function answered(result: Result, waiting: Set<string>) {
  const ids = result.user_message_uuids ?? (result.user_message_uuid ? [result.user_message_uuid] : undefined);
  // A result that doesn't say which prompts it answers ends the turn, as before Claude Code reported them.
  if (!ids) waiting.clear();
  for (const id of ids ?? []) waiting.delete(id);
  return waiting.size === 0;
}

/** Why Claude Code failed a turn, e.g. a rate limit; the process can still take the next one. */
export function errorOf(result: Result) {
  if (result.subtype === 'success') return result.result || 'Claude Code reported an error.';
  return result.errors.join('\n') || `Claude Code stopped: ${result.subtype}.`;
}
