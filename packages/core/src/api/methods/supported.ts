import { ApiCode } from '../protocol.js';
import { RpcError } from '../rpc.js';

/** What a backend has, or an error saying it can't do `what`. */
export function supported<T>(feature: T | undefined, backend: string, what: string): T {
  if (feature === undefined) throw new RpcError(ApiCode.unsupported, `${backend} can't ${what}.`);

  return feature;
}
