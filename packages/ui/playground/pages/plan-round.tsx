import { Button, classNames, FadeText, Waiting } from '@jinion/ui';
import { UserMessage, WorkLine } from '@jinion/ui/chat';
import { ChevronDown, ChevronRight, ClipboardList, Maximize2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Diagram } from '../../src/chat/diagram.js';

const DIAGRAM = `flowchart LR
  request[Request] --> limits["limits(apiKey)"]
  limits -->|under 60| handler[handler]
  limits -->|over| refused[429 Retry-After]`;

/**
 * The second round on plans as picked: the plan's card in the conversation as one row, the answer under the
 * conversation as the plan's bar has it, and a diagram edited over the window from the plan open beside it.
 */
export function PlanRound() {
  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-160 overflow-hidden rounded-xl bg-chrome ring-1 ring-black/10">
      <div className="m-2 flex min-w-0 flex-1 overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-black/5">
        <section className="flex min-w-0 flex-[7] flex-col">
          <Tabs titles={['plan rate limiting for the api']} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-176 flex-col gap-4 px-8 pt-4 pb-6">
              <UserMessage text="plan rate limiting for the api" />
              <WorkLine icon={<ChevronRight />}>
                <span>Worked for 1s</span>
                <span className="text-faint">1 file read, 1 search</span>
              </WorkLine>
              <RowCard />
            </div>
          </div>
          <div className="mx-auto w-full max-w-176 px-8 pb-4">
            <AnswerButtons />
          </div>
        </section>
        <section className="flex min-w-0 flex-[3] flex-col border-l border-line">
          <Tabs titles={[]} plan />
          <PlanBar />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <article className="prose document flex flex-col gap-3 px-6 pt-5 pb-10">
              <h1>Rate limiting for the API</h1>
              <p>Requests are limited per API key, 60 a minute, counted in Redis so every instance shares the count.</p>
              <h2>How a request goes</h2>
              <EditOver />
              <h2>Steps</h2>
              <ol>
                <li>Add a middleware that counts each key's requests.</li>
                <li>Use it before the JSON parser.</li>
                <li>Tests under the limit, over it, after a minute.</li>
              </ol>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

function Tabs({ titles, plan }: { titles: string[]; plan?: boolean }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 px-3">
      {titles.map((title) => (
        <div key={title} className="flex h-7 w-44 min-w-24 shrink items-center gap-2 rounded-lg bg-shade px-2.5">
          <Waiting />
          <FadeText>{title}</FadeText>
        </div>
      ))}
      {plan && (
        <div className="flex h-7 w-44 min-w-24 shrink items-center gap-2 rounded-lg bg-shade px-2.5">
          <ClipboardList className="size-4 shrink-0 text-faint" />
          <FadeText>Plan: Rate limiting</FadeText>
          <X className="ml-auto size-3.5 shrink-0 text-muted" />
        </div>
      )}
    </div>
  );
}

/** The plan's bar as it fits a third of the window: the status shortens before the answer does. */
function PlanBar() {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
      <Waiting />
      <span className="min-w-0 truncate text-ink">Waiting for you</span>
      <div className="flex-1" />
      <Button size="small" className="shrink-0">
        Keep planning
      </Button>
      <BuildButton />
    </div>
  );
}

function BuildButton({ label = 'Build' }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0">
      <Button variant="primary" size="small" className="rounded-r-none">
        {label}
      </Button>
      <Button variant="primary" size="icon" className="w-6 rounded-l-none border-l border-on-primary/20" aria-label="Pick the mode">
        <ChevronDown />
      </Button>
    </span>
  );
}

const META = '3 steps · 3 files · a diagram';

/** A: one row, as a diff card's header, the whole of it opening the plan. */
function RowCard() {
  return (
    <button type="button" className="flex h-10 cursor-default items-center gap-2 rounded-xl bg-raised pr-2 pl-3 text-left ring-1 ring-edge hover:bg-shade">
      <ClipboardList className="size-4 shrink-0 text-faint" />
      <span className="shrink-0 font-medium">Plan</span>
      <FadeText className="text-muted">Rate limiting for the API</FadeText>
      <span className="ml-auto shrink-0 text-faint">{META}</span>
      <Maximize2 className="size-4 shrink-0 text-faint" />
    </button>
  );
}

const panel = 'flex flex-col gap-3 rounded-2xl bg-floating p-4 shadow-sm ring-1 ring-edge';

/** A: what the plan's bar offers, and nothing else. */
function AnswerButtons() {
  return (
    <div className={classNames(panel, 'flex-row items-center')}>
      <ClipboardList className="size-4 shrink-0 text-primary" />
      <span className="font-medium">The plan is ready</span>
      <span className="text-faint">Open on the right</span>
      <div className="flex-1" />
      <Button size="small">Keep planning</Button>
      <BuildButton label="Build in Auto" />
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <pre className="m-0 h-full overflow-auto rounded-md bg-background px-3 py-2 font-mono text-mono whitespace-pre ring-1 ring-edge">{children}</pre>;
}

/** B: the drawing stays in the plan; a click opens a large editor over the window, the text beside the drawing. */
function EditOver() {
  return (
    <div className="not-prose">
      <Diagram text={DIAGRAM} fallback={null} />
      <div className="fixed inset-0 z-10 bg-black/10" />
      <div className="float fixed inset-x-[18%] top-28 z-20 flex flex-col gap-3 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">Edit the diagram</span>
          <span className="text-faint">Mermaid</span>
          <div className="flex-1" />
          <Button size="small">Cancel</Button>
          <Button size="small" variant="primary">
            Save
          </Button>
        </div>
        <div className="grid h-80 grid-cols-2 gap-3">
          <Code>{DIAGRAM}</Code>
          <div className="flex items-center rounded-md bg-raised ring-1 ring-line">
            <Diagram text={DIAGRAM} fallback={null} />
          </div>
        </div>
      </div>
    </div>
  );
}

