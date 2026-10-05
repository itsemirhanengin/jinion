import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { app } from 'electron';
import type { RecentProject } from './bridge.js';

const KEPT = 20;

const file = () => join(app.getPath('userData'), 'projects.json');

/** The folders opened before, newest first, each with its branch; those gone from disk are left out. */
export async function recentProjects(): Promise<RecentProject[]> {
  const projects = read().filter((project) => existsSync(project.path));

  return Promise.all(projects.map(async (project) => ({ ...project, branch: await branchOf(project.path) })));
}

export function rememberProject(path: string): RecentProject {
  const project = { path, name: basename(path), openedAt: Date.now() };

  write([project, ...read().filter((each) => each.path !== path)].slice(0, KEPT));

  return project;
}

export function forgetProject(path: string) {
  write(read().filter((project) => project.path !== path));
}

function read(): RecentProject[] {
  try {
    return JSON.parse(readFileSync(file(), 'utf8')) as RecentProject[];
  } catch {
    return [];
  }
}

function write(projects: RecentProject[]) {
  writeFileSync(file(), `${JSON.stringify(projects, null, 2)}\n`);
}

function branchOf(path: string) {
  return new Promise<string | undefined>((resolve) => {
    execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: path, timeout: 2000 }, (error, stdout) =>
      resolve(error ? undefined : stdout.trim() || undefined),
    );
  });
}
