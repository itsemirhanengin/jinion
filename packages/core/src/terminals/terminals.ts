import { chmodSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import serialize from '@xterm/addon-serialize';
import xterm from '@xterm/headless';
import type { IPty } from 'node-pty';
import type { TerminalInfo, TerminalOutput } from './types.js';

const SCROLLBACK = 5000;

export interface TerminalStart {
  cwd: string;
  /** Run in the user's shell, by the agent; the terminal ends with it. Without one, the shell itself, for the user. */
  command?: string;
  cols?: number;
  rows?: number;
}

/**
 * The project's terminals, which outlive the sessions: each a shell or a command in a pty, with a copy of its screen kept
 * here, so a client opening later sees what is there and the agent can read it as text.
 */
export class Terminals {
  private readonly running = new Map<string, Terminal>();
  private readonly changeListeners = new Set<(terminals: TerminalInfo[]) => void>();
  private readonly outputListeners = new Set<(output: TerminalOutput) => void>();
  private count = 0;

  list(): TerminalInfo[] {
    return [...this.running.values()].map((terminal) => ({ ...terminal.info }));
  }

  async open({ cwd, command, cols = 120, rows = 30 }: TerminalStart) {
    const { spawn } = await loadPty();
    const shell = process.env.SHELL || '/bin/zsh';
    const id = `terminal-${++this.count}`;

    const pty = spawn(shell, command ? ['-lc', command] : ['-l'], { name: 'xterm-256color', cols, rows, cwd, env: terminalEnv() });
    const info: TerminalInfo = { id, title: command ?? basename(shell), cwd, agent: command !== undefined, running: true, startedAt: Date.now() };
    const terminal = new Terminal(info, pty, cols, rows);

    this.running.set(id, terminal);
    pty.onData((data) => this.emitOutput({ id, seq: terminal.wrote(data), data }));

    pty.onExit(({ exitCode }) => {
      info.running = false;
      info.exitCode = exitCode;

      // A shell the user left goes, as a terminal does; what the agent ran stays to be read.
      if (info.agent) this.changed();
      else this.close(id);
    });

    this.changed();

    return { ...info };
  }

  write(id: string, data: string) {
    this.find(id).input(data);
  }

  resize(id: string, cols: number, rows: number) {
    this.find(id).resize(cols, rows);
  }

  close(id: string) {
    const terminal = this.running.get(id);
    if (!terminal) return;

    this.running.delete(id);
    terminal.dispose();
    this.changed();
  }

  closeAll() {
    for (const id of [...this.running.keys()]) this.close(id);
  }

  /** The screen and what scrolled off it, as escape codes that draw it again, and the last output they hold. */
  screen(id: string) {
    return this.find(id).screen();
  }

  /** The last lines, as plain text, as the agent reads them. */
  text(id: string, lines?: number) {
    return this.find(id).text(lines);
  }

  /** Resolves once the terminal's command ends, or after `ms`, whichever comes first. */
  settle(id: string, ms: number) {
    return this.find(id).settle(ms);
  }

  has(id: string) {
    return this.running.has(id);
  }

  info(id: string) {
    return { ...this.find(id).info };
  }

  onChange(listener: (terminals: TerminalInfo[]) => void) {
    this.changeListeners.add(listener);

    return () => this.changeListeners.delete(listener);
  }

  onOutput(listener: (output: TerminalOutput) => void) {
    this.outputListeners.add(listener);

    return () => this.outputListeners.delete(listener);
  }

  private find(id: string) {
    const terminal = this.running.get(id);
    if (!terminal) throw new Error(`There is no terminal ${id}.`);

    return terminal;
  }

  private changed() {
    const terminals = this.list();

    for (const listener of this.changeListeners) listener(terminals);
  }

  private emitOutput(output: TerminalOutput) {
    for (const listener of this.outputListeners) listener(output);
  }
}

/** One pty and the copy of its screen; output is numbered as it comes, and the copy knows how far it has read. */
class Terminal {
  private readonly copy: InstanceType<typeof xterm.Terminal>;
  private readonly serializer = new serialize.SerializeAddon();
  private seq = 0;
  private parsed = 0;
  private readonly exited: Promise<void>;

  constructor(
    readonly info: TerminalInfo,
    private readonly pty: IPty,
    cols: number,
    rows: number,
  ) {
    this.copy = new xterm.Terminal({ cols, rows, scrollback: SCROLLBACK, allowProposedApi: true });
    this.copy.loadAddon(this.serializer);
    this.exited = new Promise((resolve) => pty.onExit(() => resolve()));
  }

  wrote(data: string) {
    const seq = ++this.seq;

    this.copy.write(data, () => (this.parsed = seq));

    return seq;
  }

  input(data: string) {
    if (this.info.running) this.pty.write(data);
  }

  resize(cols: number, rows: number) {
    if (this.info.running) this.pty.resize(cols, rows);
    this.copy.resize(cols, rows);
  }

  async screen() {
    await this.caughtUp();

    return { screen: this.serializer.serialize({ scrollback: SCROLLBACK }), seq: this.parsed };
  }

  async text(lines = 200) {
    await this.caughtUp();

    const buffer = this.copy.buffer.active;
    const all: string[] = [];

    for (let index = 0; index < buffer.length; index++) {
      const line = buffer.getLine(index);
      if (!line) continue;

      const text = line.translateToString(true);

      // A line too long for the width goes on in the next row; the agent reads it as the one line it was.
      if (line.isWrapped && all.length > 0) all[all.length - 1] += text;
      else all.push(text);
    }

    while (all.length > 0 && all.at(-1)!.trim() === '') all.pop();

    return all.slice(-lines).join('\n');
  }

  settle(ms: number) {
    return Promise.race([this.exited, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
  }

  dispose() {
    if (this.info.running) this.pty.kill();
    this.copy.dispose();
  }

  private caughtUp() {
    return new Promise<void>((resolve) => this.copy.write('', resolve));
  }
}

let ptyModule: Promise<typeof import('node-pty')> | undefined;

// Loaded with the first terminal, so a platform without node-pty's binary only loses terminals.
function loadPty() {
  ptyModule ??= import('node-pty').then((module) => {
    makeHelperExecutable();

    return module;
  });

  return ptyModule;
}

// node-pty 1.1.0 ships its spawn helper without the execute bit, and pnpm doesn't run its install script.
function makeHelperExecutable() {
  try {
    const root = dirname(createRequire(import.meta.url).resolve('node-pty/package.json'));
    const helper = join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');

    if (existsSync(helper) && (statSync(helper).mode & 0o111) === 0) chmodSync(helper, 0o755);
  } catch {
    // A packaged app has the bit set when it is built, and may not be writable.
  }
}

// What the app itself runs with doesn't belong in the user's shell.
function terminalEnv() {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !key.startsWith('ELECTRON_') && key !== 'JINION_CORE') env[key] = value;
  }

  return { ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };
}
