import type { Options, Query, query, SDKMessage, SDKUserMessage, SlashCommand } from '@anthropic-ai/claude-agent-sdk';
import { Inbox } from '../agent/claude/inbox.js';

interface Spawned {
  options: Options;
  output: Inbox<SDKMessage>;
}

/**
 * Stands in for Claude Code: `spawn` replaces the SDK's `query`, the prompts every process is sent queue up for
 * `nextPrompt`, and the test decides what comes back with `reply`, `stderr` and `exit`.
 */
export class FakeClaude {
  readonly processes: Spawned[] = [];
  commands: SlashCommand[] = [];
  /** The prompts files were rewound to, dry runs left out. */
  readonly rewound: string[] = [];
  private readonly prompts: SDKUserMessage[] = [];
  private readonly waiting: ((prompt: SDKUserMessage) => void)[] = [];

  readonly spawn = (({ prompt, options = {} }) => {
    const spawned: Spawned = { options, output: new Inbox() };
    this.processes.push(spawned);
    void (async () => {
      for await (const message of prompt as AsyncIterable<SDKUserMessage>) {
        const waiter = this.waiting.shift();
        if (waiter) waiter(message);
        else this.prompts.push(message);
      }
    })();
    const fake = {
      [Symbol.asyncIterator]: () => spawned.output[Symbol.asyncIterator](),
      interrupt: async () => {},
      close: () => spawned.output.close(),
      setMaxThinkingTokens: async () => {},
      applyFlagSettings: async () => {},
      setPermissionMode: async () => {},
      setModel: async () => {},
      supportedCommands: async () => this.commands,
      rewindFiles: async (id: string, { dryRun = false } = {}) => {
        if (!dryRun) this.rewound.push(id);
        return { canRewind: true, filesChanged: ['/project/a.ts'], insertions: 2, deletions: 1 };
      },
    };
    return fake as unknown as Query;
  }) as typeof query;

  /** The process started last. */
  get current() {
    const spawned = this.processes.at(-1);
    if (!spawned) throw new Error('Claude Code was never started.');
    return spawned;
  }

  /** Resolves with the next prompt any process is sent, also one sent before it was asked for. */
  nextPrompt() {
    const sent = this.prompts.shift();
    return sent ? Promise.resolve(sent) : new Promise<SDKUserMessage>((resolve) => this.waiting.push(resolve));
  }

  reply(...messages: SDKMessage[]) {
    for (const message of messages) this.current.output.push(message);
  }

  stderr(text: string) {
    this.current.options.stderr?.(text);
  }

  exit() {
    this.current.output.close();
  }
}

/** The smallest messages Claude Code sends, for scripting a conversation. */
export const claudeSays = {
  init: (session = 'session-1') => ({ type: 'system', subtype: 'init', session_id: session, model: 'claude-test', permissionMode: 'acceptEdits' }) as unknown as SDKMessage,
  text: (text: string) =>
    ({
      type: 'assistant',
      parent_tool_use_id: null,
      message: { id: `message-${text}`, content: [{ type: 'text', text }] },
    }) as unknown as SDKMessage,
  result: (answering: string, error?: string) =>
    ({
      type: 'result',
      subtype: 'success',
      is_error: error !== undefined,
      result: error ?? 'done',
      user_message_uuid: answering,
      total_cost_usd: 0.01,
      modelUsage: {},
    }) as unknown as SDKMessage,
  commands: (...names: string[]) =>
    ({ type: 'system', subtype: 'commands_changed', commands: names.map((name) => ({ name, description: name, argumentHint: '' })) }) as unknown as SDKMessage,
};
