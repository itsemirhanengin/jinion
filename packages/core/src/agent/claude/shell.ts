import { homedir } from 'node:os';
import { basename, resolve } from 'node:path';

export function commands(line: unknown) {
  if (typeof line !== 'string') return [];

  const parts: string[] = [];
  let part = '';
  let quote: string | undefined;

  for (let index = 0; index < line.length; index++) {
    const char = line[index]!;
    const pair = line.slice(index, index + 2);
    let split = 0;

    if (quote === "'") {
      if (char === "'") quote = undefined;
    } else if (char === '\\') {
      part += pair;
      index++;
      continue;
    } else if (char === '`' || pair === '$(') {
      // A command substitution runs inside double quotes too.
      split = char === '`' ? 1 : 2;
    } else if (quote === '"') {
      if (char === '"') quote = undefined;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (pair === '&&' || pair === '||') {
      split = 2;
    } else if (char === ';' || char === '\n' || (char === '|' && line[index - 1] !== '>')) {
      split = 1;
    }

    if (split === 0) {
      part += char;
      continue;
    }

    parts.push(part);
    part = '';
    index += split - 1;
  }

  parts.push(part);

  return parts.map((command) => command.trim().replace(/^(?:\w+=\S*\s+|sudo\s+)+/, '')).filter(Boolean);
}

/** Absolute paths, each from where a `cd` before it went; a path with a variable other than `$HOME` can't be told and is left out. */
export function writtenPaths(line: string, cwd: string): string[] {
  const paths: string[] = [];
  let dir: string | undefined = cwd;

  for (const command of commands(line)) {
    const words = shellWords(command);
    const args: string[] = [];
    const targets: string[] = [];

    for (let index = 0; index < words.length; index++) {
      const word = words[index]!;

      if (/^(?:\d*|&)>>?$/.test(word)) {
        const target = words[++index];

        // `2>&1` points one stream at another.
        if (target && !target.startsWith('&')) targets.push(target);
      } else if (word === '<') index++;
      else args.push(word);
    }

    const [program = '', ...rest] = args;
    const operands = rest.filter((arg) => !arg.startsWith('-'));

    switch (basename(program)) {
      case 'cd':
      case 'pushd': {
        const to = expand(operands[0] ?? '~');

        dir = to === undefined || dir === undefined ? undefined : resolve(dir, to);
        continue;
      }

      case 'tee':
      case 'rm':
      case 'rmdir':
      case 'unlink':
      case 'touch':
      case 'mkdir':
      case 'truncate':
      case 'shred':
      case 'mv':
        targets.push(...operands);
        break;

      case 'chmod':
      case 'chown':
      case 'chgrp':
        targets.push(...operands.slice(1));
        break;

      case 'cp':
      case 'install':
      case 'ln':
        if (operands.length >= 2) targets.push(operands.at(-1)!);
        break;

      case 'sed':
        if (rest.some((arg) => /^-[^-]*i/.test(arg) || arg.startsWith('--in-place'))) {
          // The script is the first operand, unless it came with -e.
          targets.push(...(rest.includes('-e') ? operands : operands.slice(1)));
        }

        break;

      case 'dd':
        targets.push(...rest.filter((arg) => arg.startsWith('of=')).map((arg) => arg.slice(3)));
        break;
    }

    if (dir === undefined) continue;

    for (const target of targets) {
      const path = expand(target);

      if (path !== undefined) paths.push(resolve(dir, path));
    }
  }

  return paths;
}

function expand(path: string) {
  const home = path.replace(/^~(?=\/|$)/, homedir()).replace(/^\$(?:HOME\b|\{HOME\})/, homedir());

  return home.includes('$') ? undefined : home;
}

export function shellWords(command: string) {
  const words: string[] = [];
  let word = '';
  let started = false;
  let quote: string | undefined;

  const flush = () => {
    if (started) words.push(word);
    word = '';
    started = false;
  };

  for (let index = 0; index < command.length; index++) {
    const char = command[index]!;

    if (quote) {
      if (char === quote) quote = undefined;
      else if (char === '\\' && quote === '"') word += command[++index] ?? '';
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === '\\') {
      word += command[++index] ?? '';
      started = true;
    } else if (/\s/.test(char)) flush();
    else if (char === '>') {
      // A stream's number or `&` right before belongs to the operator.
      const prefix = started && /^(?:\d+|&)$/.test(word) ? word : '';

      if (prefix) {
        word = '';
        started = false;
      } else flush();

      let operator = `${prefix}>`;

      if (command[index + 1] === '>') operator += command[++index];
      if (command[index + 1] === '|') index++;
      words.push(operator);
    } else if (char === '<') {
      flush();
      words.push('<');
    } else {
      word += char;
      started = true;
    }
  }

  flush();

  return words;
}
