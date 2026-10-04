export interface BackgroundTask {
  id: string;
  kind: 'shell' | 'agent' | 'other';
  title: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: number;
  endedAt?: number;
  output?: string;
  calls?: number;
  lastCall?: string;
  /** The turn waits for it. The backend lists a long command here after a few seconds. */
  foreground?: boolean;
}
