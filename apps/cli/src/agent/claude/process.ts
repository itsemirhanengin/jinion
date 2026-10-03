import { randomUUID } from 'node:crypto';
import { query, type Options, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { DebugLog } from '../../debug.js';
import type { AgentResume } from '../types.js';
import { ClaudeEvents } from './events.js';
import { Inbox } from './inbox.js';

type Result = Extract<SDKMessage, { type: 'result' }>;

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
  private turn?: { uuid: string; messages: Inbox<SDKMessage | Error> };
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
   * Sends a prompt, then yields what Claude Code sends until the result that answers it, which comes last. Fails when
   * the process exits first.
   */
  async *send(content: string): AsyncGenerator<SDKMessage> {
    if (this.exited) throw this.exited;
    if (this.turn) throw new Error('Claude Code is still answering the previous prompt.');
    const turn = { uuid: randomUUID(), messages: new Inbox<SDKMessage | Error>() };
    this.turn = turn;
    this.options.debug?.write('prompt', { uuid: turn.uuid, content });
    this.input.push({ type: 'user', uuid: turn.uuid, message: { role: 'user', content }, parent_tool_use_id: null, origin: { kind: 'human' } });
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

  close() {
    this.input.close();
    this.query.close();
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
        // The turn ends here rather than where it is read, so what comes right after its result is idle.
        if (message.type === 'result' && answers(message, turn.uuid)) {
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

/** Whether `result` ends the turn started by the prompt with this uuid. */
function answers(result: Result, uuid: string) {
  const ids = result.user_message_uuids ?? (result.user_message_uuid ? [result.user_message_uuid] : undefined);
  return !ids || ids.includes(uuid);
}

/** Why Claude Code failed a turn, e.g. a rate limit; the process can still take the next one. */
export function errorOf(result: Result) {
  if (result.subtype === 'success') return result.result || 'Claude Code reported an error.';
  return result.errors.join('\n') || `Claude Code stopped: ${result.subtype}.`;
}
