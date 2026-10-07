import { expect, test } from 'vitest';
import { localUrls } from '../../src/preview/urls.js';

test('finds the address Vite prints, its port in bold', () => {
  const output = '  \x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:\x1b[1m5173\x1b[22m/\x1b[39m\r\n';

  expect(localUrls(output)).toEqual(['http://localhost:5173']);
});

test("finds Next's, and keeps a path the server is under", () => {
  const output = '   - Local:        http://localhost:3000\n   - Network:      http://192.168.1.4:3000\n app on http://127.0.0.1:8080/app/ now.\n';

  expect(localUrls(output)).toEqual(['http://localhost:3000', 'http://127.0.0.1:8080/app/']);
});

test('opens a server listening on every address as localhost, once', () => {
  expect(localUrls('listening on http://0.0.0.0:4000, http://localhost:4000\n')).toEqual(['http://localhost:4000']);
});

test('waits for an address that ends the output, which may go on', () => {
  expect(localUrls('Local: http://localhost:51')).toEqual([]);
  expect(localUrls('Local: http://localhost:5173\n')).toEqual(['http://localhost:5173']);
});
