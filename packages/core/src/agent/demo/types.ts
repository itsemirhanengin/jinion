import type { AgentEvent } from '../events.js';
import type { BackgroundTask } from '../tasks.js';
import type { Script } from './script.js';

export interface Scenario {
  title: string | ((prompt: string) => string);
  match?: RegExp;
  play(script: Script, prompt: string): AsyncGenerator<AgentEvent, void>;
}

export type Followup = (script: Script, task: BackgroundTask) => AsyncGenerator<AgentEvent, void>;

export interface BackgroundScript {
  /** A task without `exitCode` runs until it is stopped. */
  output: string[];
  durationMs?: number;
  exitCode?: number;
  followup?: Followup;
}
