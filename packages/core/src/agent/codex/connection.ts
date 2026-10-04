import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { DebugLog } from '../../lib/debug.js';
import { codexBinary, withPath } from './binary.js';
import type { Notification, ServerRequest } from './protocol.js';

/** A running `codex app-server`, one JSON message per line each way. */
export interface CodexProcess {
  write(line: string): void;
  onLine(listener: (line: string) => void): void;
  onExit(listener: (error?: Error) => void): void;
  kill(): void;
}

export interface ConnectionOptions {
  /** Tests give a fake one. */
  start?: () => CodexProcess;
  debug?: DebugLog;
  version: string;
}

type Message = { id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { code: number; message: string } };

/**
 * JSON-RPC with the app-server. Its messages leave out `"jsonrpc": "2.0"`, so Jinion's own peer, which insists on it,
 * isn't used here.
 */
export class CodexConnection {
  /** Settles once `initialize` is answered; requests wait for it. */
  readonly ready: Promise<void>;
  private readonly process: CodexProcess;
  private next = 0;
  private readonly waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  private readonly notificationListeners = new Set<(notification: Notification) => void>();
  private readonly exitListeners = new Set<(error: Error) => void>();
  private answer?: (request: ServerRequest) => Promise<unknown>;
  private exited?: Error;

  constructor(private readonly options: ConnectionOptions) {
    this.process = (options.start ?? spawnAppServer)();
    this.process.onLine((line) => this.receive(line));
    this.process.onExit((error) => this.exit(error ?? new Error('Codex stopped.')));

    this.ready = this.call('initialize', {
      clientInfo: { name: 'jinion', title: 'Jinion', version: options.version },
      // Plan mode, Jinion's own tools and the questions Codex asks are behind the experimental API.
      capabilities: { experimentalApi: true, requestAttestation: false },
    }).then(() => this.send({ method: 'initialized' }));

    this.ready.catch(() => {});
  }

  async request<T>(method: string, params: unknown): Promise<T> {
    await this.ready;

    return this.call(method, params) as Promise<T>;
  }

  onNotification(listener: (notification: Notification) => void) {
    this.notificationListeners.add(listener);

    return () => void this.notificationListeners.delete(listener);
  }

  /** What Codex asks, such as an approval; a request without an answer is refused. */
  onRequest(answer: (request: ServerRequest) => Promise<unknown>) {
    this.answer = answer;
  }

  onExit(listener: (error: Error) => void) {
    this.exitListeners.add(listener);
  }

  close() {
    this.process.kill();
    this.exit(new Error('Codex was closed.'));
  }

  private call(method: string, params: unknown) {
    if (this.exited) return Promise.reject(this.exited);

    const id = ++this.next;

    return new Promise<unknown>((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.send({ id, method, params });
    });
  }

  private send(message: Message) {
    this.options.debug?.write('prompt', message);
    this.process.write(`${JSON.stringify(message)}\n`);
  }

  private receive(line: string) {
    if (!line.trim()) return;

    let message: Message;

    try {
      message = JSON.parse(line) as Message;
    } catch {
      return this.options.debug?.write('stderr', line);
    }

    this.options.debug?.write('message', message);

    if (message.method === undefined) return this.settle(message);

    if (message.id === undefined) {
      for (const listener of this.notificationListeners) listener(message as Notification);

      return;
    }

    void this.reply(message.id, message as ServerRequest);
  }

  private settle({ id, result, error }: Message) {
    const waiting = typeof id === 'number' ? this.waiting.get(id) : undefined;
    if (!waiting) return;

    this.waiting.delete(id as number);

    if (error) waiting.reject(new Error(error.message));
    else waiting.resolve(result);
  }

  private async reply(id: number | string, request: ServerRequest) {
    try {
      if (!this.answer) throw new Error(`Jinion can't answer ${request.method}.`);

      this.send({ id, result: await this.answer(request) });
    } catch (error) {
      this.send({ id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } });
    }
  }

  private exit(error: Error) {
    if (this.exited) return;

    this.exited = error;
    for (const { reject } of this.waiting.values()) reject(error);
    this.waiting.clear();
    for (const listener of this.exitListeners) listener(error);
  }
}

function spawnAppServer(): CodexProcess {
  const { path, pathDirs } = codexBinary();
  const child = spawn(path, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], env: withPath(process.env, pathDirs) });
  const stderr: string[] = [];

  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
  // A write after it stopped fails; its exit says why.
  child.stdin.on('error', () => {});

  return {
    write: (line) => child.stdin.write(line),
    onLine: (listener) => createInterface({ input: child.stdout }).on('line', listener),
    onExit: (listener) => {
      child.on('error', listener);

      child.on('exit', (code, signal) => {
        const why = stderr.join('').trim().split('\n').at(-1);

        listener(new Error(`Codex stopped (${signal ?? `exit code ${code}`})${why ? `: ${why}` : '.'}`));
      });
    },
    kill: () => child.kill(),
  };
}
