// `pnpm --filter @jinion/core schema` writes `schema/api.json` from the protocol's zod schemas; a test fails when it is stale.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiJsonSchema } from '../src/api/json-schema.js';

const path = fileURLToPath(new URL('../schema/api.json', import.meta.url));

mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, `${JSON.stringify(apiJsonSchema(), null, 2)}\n`);
console.log(`Wrote ${path}`);
