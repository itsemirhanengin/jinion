import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';

export interface CodexBinary {
  path: string;
  /** Tools it brings along, such as `rg`, which go first on its PATH. */
  pathDirs: string[];
}

/**
 * The native `codex` of the pinned @openai/codex, run directly rather than through its Node launcher. Its platform
 * package is named after the platform, e.g. @openai/codex-darwin-arm64, and keeps the binary under a target triple.
 */
export function codexBinary(): CodexBinary {
  const require = createRequire(createRequire(import.meta.url).resolve('@openai/codex/package.json'));
  const name = `@openai/codex-${process.platform}-${process.arch}`;
  let vendor: string;

  try {
    vendor = join(dirname(require.resolve(`${name}/package.json`)), 'vendor');
  } catch {
    throw new Error(`Codex has no build for this machine (${process.platform}, ${process.arch}).`);
  }

  const [triple] = existsSync(vendor) ? readdirSync(vendor) : [];
  const path = triple && join(vendor, triple, 'bin', process.platform === 'win32' ? 'codex.exe' : 'codex');
  if (!path || !existsSync(path)) throw new Error(`Codex's binary is missing from ${name}. Reinstall jinion.`);

  const tools = join(vendor, triple, 'codex-path');

  return { path, pathDirs: existsSync(tools) ? [tools] : [] };
}

export const withPath = (env: NodeJS.ProcessEnv, dirs: string[]): NodeJS.ProcessEnv =>
  dirs.length === 0 ? env : { ...env, PATH: [...dirs, env.PATH].filter(Boolean).join(delimiter) };
