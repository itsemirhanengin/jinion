import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { extname, isAbsolute, join } from 'node:path';
import type { AgentImage } from '@jinion/core/agent/agent';

const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Claude takes images up to 5 MB once encoded, and base64 makes them a third bigger. */
const MAX_BYTES = 3_750_000;

const SHRINK_TO = 2048;

/** Terminals paste a dragged file's path quoted, with backslashes before spaces, or as a `file://` URL. */
export function imageFromPaste(text: string): AgentImage | undefined {
  const path = pastedPath(text);
  const mediaType = path && MEDIA_TYPES[extname(path).toLowerCase()];
  if (!path || !mediaType || !existsSync(path) || !statSync(path).isFile()) return undefined;

  return fitting(readFileSync(path), mediaType);
}

function pastedPath(text: string) {
  let path = text.trim();
  if (!path || path.includes('\n')) return undefined;

  if (path.startsWith('file://')) path = decodeURIComponent(path.slice('file://'.length));
  path = path.replace(/^(['"])(.*)\1$/, '$2').replace(/\\(.)/g, '$1');
  if (path.startsWith('~/')) path = join(homedir(), path.slice(2));

  return isAbsolute(path) ? path : undefined;
}

export async function clipboardImage(): Promise<AgentImage | undefined> {
  const png = await clipboardPng();

  return png && png.length > 0 ? fitting(png, 'image/png') : undefined;
}

function clipboardPng(): Promise<Buffer | undefined> {
  if (process.platform === 'darwin') {
    const folder = mkdtempSync(join(tmpdir(), 'jinion-clipboard-'));
    const file = join(folder, 'clipboard.png');

    // AppleScript writes the clipboard's PNG data to a file, and fails when the clipboard holds no image.
    const script = [
      'set png to (the clipboard as «class PNGf»)',
      `set out to open for access POSIX file "${file}" with write permission`,
      'set eof out to 0',
      'write png to out',
      'close access out',
    ];

    return new Promise((resolve) => {
      execFile('osascript', script.flatMap((line) => ['-e', line]), (error) => {
        resolve(error || !existsSync(file) ? undefined : readFileSync(file));
        rmSync(folder, { recursive: true, force: true });
      });
    });
  }

  if (process.platform === 'linux') {
    const read = (command: string, args: string[]) =>
      new Promise<Buffer | undefined>((resolve) => {
        execFile(command, args, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (error, stdout) =>
          resolve(error ? undefined : stdout),
        );
      });

    return read('wl-paste', ['--type', 'image/png']).then(
      (png) => png ?? read('xclip', ['-selection', 'clipboard', '-t', 'image/png', '-o']),
    );
  }

  return Promise.resolve(undefined);
}

function fitting(bytes: Buffer, mediaType: string): AgentImage {
  if (bytes.length <= MAX_BYTES) return { mediaType, data: bytes.toString('base64') };

  const smaller = shrink(bytes);

  if (!smaller || smaller.length > MAX_BYTES) {
    throw new Error(`The image is ${(bytes.length / 1_000_000).toFixed(1)} MB; Claude takes images up to 3.7 MB.`);
  }

  return { mediaType: 'image/jpeg', data: smaller.toString('base64') };
}

function shrink(bytes: Buffer) {
  if (process.platform !== 'darwin') return undefined;

  const folder = mkdtempSync(join(tmpdir(), 'jinion-image-'));

  try {
    const source = join(folder, 'source');
    const target = join(folder, 'target.jpg');

    writeFileSync(source, bytes);

    execFileSync('sips', ['-Z', String(SHRINK_TO), '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', source, '--out', target], {
      stdio: 'ignore',
    });

    return readFileSync(target);
  } catch {
    return undefined;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
