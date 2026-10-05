import { Page, Pill, StatusIcon } from '@jinion/ui';
import { ChangesCard, CommandCard, Composer, ComposerFooter, Conversation, DiffCard, Prose, ToolGroup, ToolLine, Turn, UserMessage, Working } from '@jinion/ui/chat';
import { GitBranch, Laptop } from 'lucide-react';
import { useState } from 'react';

export type ThreadState = 'working' | 'waiting' | 'idle';

export interface Thread {
  title: string;
  state: ThreadState;
  ago: string;
  started: boolean;
}

export interface Change {
  path: string;
  added: number;
  removed: number;
  created?: boolean;
}

export function StateMark({ state }: { state: ThreadState }) {
  return <StatusIcon status={state} />;
}

const diff = [
  { kind: 'context' as const, number: 3, text: "import express from 'express';" },
  { kind: 'removed' as const, number: 4, text: "import { json } from 'body-parser';" },
  { kind: 'added' as const, number: 4, text: "import { limits } from './limits.js';" },
  { kind: 'context' as const, number: 5, text: '' },
  { kind: 'context' as const, number: 6, text: 'const app = express();' },
  { kind: 'added' as const, number: 7, text: 'app.use(limits({ perMinute: 60, key: apiKey }));' },
  { kind: 'context' as const, number: 8, text: 'app.use(express.json());' },
];

export function ThreadView({ thread, changes }: { thread: Thread; changes: Change[] }) {
  const [draft, setDraft] = useState('');

  return (
    <Conversation
      footer={
        <>
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => setDraft('')}
            busy={thread.state === 'working'}
            placeholder="Ask for a follow-up. / for commands, @ for files"
            controls={
              <>
                <Pill>Auto</Pill>
                <Pill>
                  Opus 5.5 <span className="text-faint">High</span>
                </Pill>
              </>
            }
          />
          <ComposerFooter
            start={
              <>
                <Pill icon={<GitBranch />}>main</Pill>
                <Pill icon={<Laptop />}>Local</Pill>
              </>
            }
            end={<span className="px-2 text-faint tabular-nums">40% of context</span>}
          />
        </>
      }
    >
      {thread.started && (
        <Turn>
          <UserMessage text={thread.title} />
          <Prose text="I'll put the limiter in front of the routes, keyed by the API key, with the window in Redis so it holds across instances." />
          <div className="flex flex-col gap-1">
            <ToolGroup title="Explored" summary="4 files, 2 searches">
              <ToolLine label="Read" detail="apps/api/src/server.ts" />
              <ToolLine label="Searched" detail='"app.use" in apps/api' />
            </ToolGroup>
            <CommandCard command="pnpm test --filter api" output={['✓ 42 tests passed']} exitCode={0} took="4.2s" />
          </div>
          <DiffCard path="apps/api/src/server.ts" lines={diff} />
          <Prose text="The limiter answers with a 429 and `Retry-After` in seconds. The tests pass, two new ones included for the edge of the window." />
          <ChangesCard files={changes.map((change) => ({ created: false, ...change }))} onReview={() => undefined} />
          {thread.state === 'working' && <Working since={Date.now() - 3000} />}
        </Turn>
      )}
    </Conversation>
  );
}

export function DiffView({ path }: { path: string }) {
  return (
    <div className="h-full overflow-auto p-6">
      <DiffCard path={path} lines={diff} bare />
    </div>
  );
}

export function Skills() {
  return (
    <Page title="Skills" description="What the agent knows how to do, and loads when a task needs it.">
      <p className="text-muted">The skills of the project, yours, and those of claude.ai.</p>
    </Page>
  );
}

export function Settings() {
  return (
    <Page title="Settings" description="For this project, saved in .jinion/settings.json.">
      <p className="text-muted">The model, the mode, worktrees and the theme.</p>
    </Page>
  );
}
