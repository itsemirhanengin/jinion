import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commands, shellWords, writtenPaths } from './shell.js';

describe('commands', () => {
  it('splits a line into its simple commands, without assignments and sudo', () => {
    expect(commands('FOO=1 sudo git commit && pnpm test | tee out; echo `date`')).toEqual(['git commit', 'pnpm test', 'tee out', 'echo', 'date']);
    expect(commands(undefined)).toEqual([]);
  });
});

describe('shellWords', () => {
  it('takes quotes off and keeps redirections apart', () => {
    expect(shellWords(`echo "a b" 'c'd\\ e 2>>err.log &>all <in >|out`)).toEqual(['echo', 'a b', 'cd e', '2>>', 'err.log', '&>', 'all', '<', 'in', '>', 'out']);
  });
});

describe('writtenPaths', () => {
  it('finds what a line writes, from the folder each command runs in', () => {
    expect(writtenPaths('cd src && touch a.ts > ../log.txt', '/work/project')).toEqual(['/work/project/log.txt', '/work/project/src/a.ts']);
    expect(writtenPaths('cp a.ts ~/b.ts && sed -i s/a/b/ c.ts', '/work')).toEqual([join(homedir(), 'b.ts'), '/work/c.ts']);
  });

  it('leaves out what only the shell knows, and streams pointed at each other', () => {
    expect(writtenPaths('rm $TARGET; ls 2>&1', '/work')).toEqual([]);
    expect(writtenPaths('cd $DIR && rm a', '/work')).toEqual([]);
  });
});
