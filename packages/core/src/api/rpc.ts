import { z } from 'zod';
import { errorMessage } from '../lib/errors.js';
import type { Transport } from './transport.js';

export type RequestId = number | string;

export interface RpcErrorBody {
  code: number;
  message: string;
  data?: unknown;
}

type RpcResponse = { jsonrpc: '2.0'; id: RequestId | null; result: unknown } | { jsonrpc: '2.0'; id: RequestId | null; error: RpcErrorBody };

type RpcMessage = { jsonrpc: '2.0'; id: RequestId; method: string; params?: unknown } | { jsonrpc: '2.0'; method: string; params?: unknown } | RpcResponse;

/** JSON-RPC's own codes, and `closed` for what was still waiting when the connection went. */
export const RpcCode = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  closed: -32000,
} as const;

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

/** What one side answers: the requests it takes, with their params and results, and the notifications it listens to. */
export interface Contract {
  requests: Record<string, { params: unknown; result: unknown }>;
  notifications: Record<string, unknown>;
}

type Method<C extends Contract> = keyof C['requests'] & string;

type Notification<C extends Contract> = keyof C['notifications'] & string;

export type Params<C extends Contract, M extends Method<C>> = C['requests'][M]['params'];

export type Result<C extends Contract, M extends Method<C>> = C['requests'][M]['result'];

/**
 * One side of a JSON-RPC 2.0 connection; the server and its clients use the same one. `Local` is what this side
 * answers, `Remote` what the other side does. A handler that answers at once is answered before anything sent after
 * it, so a snapshot always comes before the changes that follow it.
 */
export class RpcPeer<Local extends Contract, Remote extends Contract> {
  private lastId = 0;
  private open = true;
  private readonly pending = new Map<RequestId, { resolve(result: unknown): void; reject(error: RpcError): void }>();
  private readonly handlers = new Map<string, (params: never) => unknown>();
  private readonly listeners = new Map<string, Set<(params: never) => void>>();
  private readonly closeListeners = new Set<() => void>();

  /** `schemas` check the params of what comes in, keyed by method, before a handler or listener sees them. */
  constructor(
    private readonly transport: Transport,
    private readonly schemas: Partial<Record<string, z.ZodType>> = {},
  ) {
    transport.start({ message: (text) => this.receive(text), closed: () => this.closed() });
  }

  request<M extends Method<Remote>>(method: M, params: Params<Remote, M>): Promise<Result<Remote, M>> {
    if (!this.open) return Promise.reject(new RpcError(RpcCode.closed, 'The connection is closed.'));

    const id = ++this.lastId;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: (result) => resolve(result as Result<Remote, M>), reject });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  notify<M extends Notification<Remote>>(method: M, params: Remote['notifications'][M]) {
    if (this.open) this.send({ jsonrpc: '2.0', method, params });
  }

  handle<M extends Method<Local>>(method: M, handler: (params: Params<Local, M>) => Result<Local, M> | Promise<Result<Local, M>>) {
    this.handlers.set(method, handler);
  }

  on<M extends Notification<Local>>(method: M, listener: (params: Local['notifications'][M]) => void) {
    const listeners = this.listeners.get(method) ?? new Set();

    this.listeners.set(method, listeners);
    listeners.add(listener);

    return () => void listeners.delete(listener);
  }

  onClose(listener: () => void) {
    this.closeListeners.add(listener);

    return () => void this.closeListeners.delete(listener);
  }

  close() {
    this.transport.close();
  }

  private receive(text: string) {
    let message: RpcMessage | undefined;

    try {
      message = parse(JSON.parse(text));
    } catch {
      return this.send({ jsonrpc: '2.0', id: null, error: { code: RpcCode.parseError, message: 'The message is not JSON.' } });
    }

    if (!message) return this.send({ jsonrpc: '2.0', id: null, error: { code: RpcCode.invalidRequest, message: 'The message is not JSON-RPC 2.0.' } });
    if (!('method' in message)) return this.settle(message);

    if ('id' in message) void this.answer(message);
    else this.notified(message.method, message.params);
  }

  private async answer({ id, method, params }: { id: RequestId; method: string; params?: unknown }) {
    try {
      const handler = this.handlers.get(method) as ((params: unknown) => unknown) | undefined;
      if (!handler) throw new RpcError(RpcCode.methodNotFound, `There is no method ${method}.`);

      const answered = handler(this.checked(method, params));
      const result = answered instanceof Promise ? await answered : answered;

      this.send({ jsonrpc: '2.0', id, result: result ?? null });
    } catch (error) {
      this.send({ jsonrpc: '2.0', id, error: errorBody(error) });
    }
  }

  /** A notification gets no answer, so one with params that don't fit is dropped. */
  private notified(method: string, params: unknown) {
    const listeners = this.listeners.get(method) as Set<(params: unknown) => void> | undefined;
    if (!listeners) return;

    let checked: unknown;

    try {
      checked = this.checked(method, params);
    } catch {
      return;
    }

    for (const listener of listeners) listener(checked);
  }

  private checked(method: string, params: unknown) {
    const schema = this.schemas[method];
    if (!schema) return params;

    const parsed = schema.safeParse(params ?? {});
    if (!parsed.success) throw new RpcError(RpcCode.invalidParams, z.prettifyError(parsed.error));

    return parsed.data;
  }

  private settle(response: RpcResponse) {
    const waiting = response.id === null ? undefined : this.pending.get(response.id);
    if (!waiting) return;

    this.pending.delete(response.id!);

    if ('error' in response) waiting.reject(new RpcError(response.error.code, response.error.message, response.error.data));
    else waiting.resolve(response.result);
  }

  /** An answer that was still being worked out when the connection went has nobody left to go to. */
  private send(message: RpcMessage) {
    if (this.open) this.transport.send(JSON.stringify(message));
  }

  private closed() {
    this.open = false;

    for (const { reject } of this.pending.values()) reject(new RpcError(RpcCode.closed, 'The connection closed.'));

    this.pending.clear();
    for (const listener of this.closeListeners) listener();
  }
}

function parse(value: unknown): RpcMessage | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

  const message = value as Record<string, unknown>;
  const id = message.id;
  const validId = typeof id === 'number' || typeof id === 'string';
  if (message.jsonrpc !== '2.0') return undefined;

  if (typeof message.method === 'string') {
    if ('id' in message && !validId) return undefined;

    return message as RpcMessage;
  }

  if (!validId && id !== null) return undefined;
  if ('result' in message) return message as RpcMessage;

  const error = message.error as Partial<RpcErrorBody> | undefined;
  if (typeof error?.code === 'number' && typeof error.message === 'string') return message as RpcMessage;

  return undefined;
}

function errorBody(error: unknown): RpcErrorBody {
  if (error instanceof RpcError) return { code: error.code, message: error.message, data: error.data };

  return { code: RpcCode.internalError, message: errorMessage(error) };
}
