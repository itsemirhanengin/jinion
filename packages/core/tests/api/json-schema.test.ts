import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { apiJsonSchema } from '../../src/api/json-schema.js';
import { requests } from '../../src/api/protocol.js';
import type { Receiver } from '../../src/api/transport.js';
import { checked } from '../support/api.js';

const committed = () => readFileSync(new URL('../../schema/api.json', import.meta.url), 'utf8');

describe('the API’s JSON Schema', () => {
  it('is the one the protocol makes; pnpm --filter @jinion/core schema writes it again', () => {
    expect(committed()).toBe(`${JSON.stringify(apiJsonSchema(), null, 2)}\n`);
  });

  it('is what every API test checks the server’s messages against', () => {
    const received = vi.fn();
    let wire: Receiver | undefined;

    checked({ start: (receiver) => (wire = receiver), send: () => {}, close: () => {} }).start({ message: received, closed: () => {} });

    const deliver = (message: object) => wire!.message(JSON.stringify(message));

    expect(() => deliver({ jsonrpc: '2.0', method: 'screen/notify', params: { title: 'Done' } })).toThrow(/screen\/notify doesn't fit/);
    expect(() => deliver({ jsonrpc: '2.0', method: 'screen/shout', params: {} })).toThrow(/doesn't have/);
    expect(received).not.toHaveBeenCalled();
  });

  it('has every method, and names the core’s types rather than leaving them anonymous', () => {
    const schema = JSON.parse(committed()) as { properties: { requests: { properties: object } }; $defs: object };

    expect(Object.keys(schema.properties.requests.properties)).toEqual(Object.keys(requests));
    expect(Object.keys(schema.$defs)).toEqual(expect.arrayContaining(['Entry', 'AgentEvent', 'Action', 'SessionState', 'ToolCall', 'View']));
    expect(JSON.stringify(schema)).not.toMatch(/__schema\d/);
  });
});
