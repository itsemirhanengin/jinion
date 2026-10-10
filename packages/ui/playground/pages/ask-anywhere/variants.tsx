import { Button, classNames, languageOf, Pill, StatusIcon, useTokens } from '@jinion/ui';
import { Composer } from '@jinion/ui/chat';
import { MessageSquare, MessagesSquare, Plus, SquarePen, X } from 'lucide-react';
import { Fragment, type ReactNode, useState } from 'react';
import { CODE, NAME, PATH, SELECTED } from './code.js';

interface VariantProps {
  /** Lines 10 to 13 are selected, as by a drag over them. */
  selected: boolean;
}

/** Capsule (current): the composer always floats over the file's end, asking about the file, or the lines once picked. */
export function CapsuleAsk({ selected }: VariantProps) {
  const [draft, setDraft] = useState('');

  return (
    <Area>
      <Scroller className="pb-44">
        <Code selected={selected} />
      </Scroller>
      <div className="pointer-events-none absolute right-2.5 bottom-0 left-0 bg-linear-to-t from-background from-60% to-transparent px-6 pt-10 pb-4">
        <div className="pointer-events-auto mx-auto max-w-176">
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => setDraft('')}
            placeholder={selected ? 'Ask about these lines' : 'Ask about this file'}
            attachments={<FilePill selected={selected} />}
            controls={<Target />}
          />
        </div>
      </div>
    </Area>
  );
}

/** On selection: nothing over the code until lines are picked; then a small bar under them, which opens a composer right there. */
export function SelectionAsk({ selected }: VariantProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const bar = (
    <div className="absolute top-full left-16 z-10 mt-1.5 font-sans text-ui">
      {open ? (
        <div className="w-[32rem]">
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => {
              setDraft('');
              setOpen(false);
            }}
            placeholder="Ask about lines 10–13"
            controls={<Target />}
            focusOnShow
          />
        </div>
      ) : (
        <div className="flex items-center gap-0.5 rounded-full bg-floating p-1 shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)] ring-1 ring-edge">
          <BarButton onClick={() => setOpen(true)}>
            <MessageSquare />
            Ask
            <span className="text-faint">⌘L</span>
          </BarButton>
          <BarButton>
            <Plus />
            Add to a thread
          </BarButton>
        </div>
      )}
    </div>
  );

  return (
    <Area>
      <Scroller className="pb-24">
        <Code selected={selected} end={selected ? { line: SELECTED.to, node: bar } : undefined} />
      </Scroller>
      {!selected && <Hint>Select lines to ask about them · ⌘L asks about the whole file</Hint>}
    </Area>
  );
}

/** Inline: ⌘K, or the chip by the lines, opens a composer between them and the code under them; the answer comes back there. */
export function InlineAsk({ selected }: VariantProps) {
  const [open, setOpen] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [draft, setDraft] = useState('');

  const chip = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="absolute top-0 right-4 flex h-5 items-center gap-1.5 rounded-md bg-floating px-2 font-sans text-small text-muted shadow-xs ring-1 ring-edge hover:text-ink"
    >
      Ask <span className="text-faint">⌘K</span>
    </button>
  );

  const zone = (
    <div className="my-1.5 mr-4 ml-16 max-w-176 border-l-2 border-primary/40 py-1 pl-4 font-sans text-ui">
      {answered ? (
        <div className="flex flex-col gap-2">
          <p className="text-pretty text-ink/85">
            Each address gets one count for the whole window, so a burst at its start locks the address out for fifteen minutes. A sliding log or a token bucket
            would let it back in gradually.
          </p>
          <p className="flex items-center gap-2 text-muted">
            <MessagesSquare className="size-3.5" />
            Goes on in <span className="text-ink">Rate limiting</span>
            <span className="flex-1" />
            <button type="button" className="text-ink hover:underline">
              Open thread
            </button>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex size-6 items-center justify-center rounded-md hover:bg-shade">
              <X className="size-3.5" />
            </button>
          </p>
        </div>
      ) : (
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => {
            setDraft('');
            setAnswered(true);
          }}
          placeholder="Ask about lines 10–13"
          controls={<Target />}
          focusOnShow
        />
      )}
    </div>
  );

  return (
    <Area>
      <Scroller className="pb-24">
        <Code
          selected={selected}
          end={selected && !open ? { line: SELECTED.from, node: chip } : undefined}
          under={selected && open ? { line: SELECTED.to, node: zone } : undefined}
        />
      </Scroller>
      {!selected && <Hint>Select lines, then ⌘K to ask right where they are</Hint>}
    </Area>
  );
}

/** Corner: a small button at the tab's corner, naming the lines once picked; it opens into the capsule there and closes back. */
export function CornerAsk({ selected }: VariantProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <Area>
      <Scroller className="pb-24">
        <Code selected={selected} />
      </Scroller>
      <div className="absolute right-6 bottom-5">
        {open ? (
          <div className="w-[32rem]">
            <Composer
              value={draft}
              onChange={setDraft}
              onSubmit={() => {
                setDraft('');
                setOpen(false);
              }}
              placeholder={selected ? 'Ask about these lines' : 'Ask about this file'}
              attachments={<FilePill selected={selected} />}
              controls={
                <>
                  <Target />
                  <Button size="icon" aria-label="Close" title="Close (Esc)" onClick={() => setOpen(false)}>
                    <X />
                  </Button>
                </>
              }
              focusOnShow
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 items-center gap-2 rounded-full bg-floating pr-4 pl-3.5 shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)] ring-1 ring-edge hover:bg-raised"
          >
            <MessageSquare className="size-4 text-muted" />
            {selected ? 'Ask about lines 10–13' : 'Ask'}
            <span className="text-faint">⌘L</span>
          </button>
        )}
      </div>
    </Area>
  );
}

/** Notes: a + in the gutter picks lines and opens a note under them that goes to a thread; each stays as a mark in the gutter. */
export function NotesAsk({ selected }: VariantProps) {
  const [sent, setSent] = useState(false);
  const [draft, setDraft] = useState('');

  const mark = (line: number) => (
    <>
      {selected && line >= SELECTED.from && line <= SELECTED.to && <span className="absolute inset-y-0 left-1 w-0.5 rounded-full bg-primary" />}
      {line === 25 && (
        <span className="absolute top-0.5 left-0.5 flex h-4 items-center gap-0.5 rounded bg-primary/12 px-1 font-sans text-[10px] text-primary">
          <MessageSquare className="size-2.5" />1
        </span>
      )}
      {line !== 25 && (
        <span className="absolute top-0 left-0.5 hidden size-5 items-center justify-center rounded-md bg-primary text-on-primary group-hover:flex">
          <Plus className="size-3" />
        </span>
      )}
    </>
  );

  const note = (
    <div className="my-2 mr-4 ml-16 max-w-176 font-sans text-ui">
      {sent ? (
        <div className="flex flex-col gap-2 rounded-xl bg-floating px-3.5 py-3 shadow-xs ring-1 ring-edge">
          <p className="text-pretty">Should the window slide per route, or is one budget per address enough?</p>
          <p className="flex items-center gap-2 text-muted">
            <StatusIcon status="working" />
            Answering in <span className="text-ink">Rate limiting</span>
            <span className="flex-1" />
            <button type="button" className="text-ink hover:underline">
              Open thread
            </button>
          </p>
        </div>
      ) : (
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => {
            setDraft('');
            setSent(true);
          }}
          placeholder="Ask about lines 10–13"
          controls={<Target />}
          focusOnShow
        />
      )}
    </div>
  );

  return (
    <Area>
      <Scroller className="pb-24">
        <Code selected={selected} mark={mark} under={selected ? { line: SELECTED.to, node: note } : undefined} />
      </Scroller>
      {!selected && <Hint>Hover a line and press + to ask about it, or drag down the gutter for several</Hint>}
    </Area>
  );
}

interface CodeProps {
  selected: boolean;
  /** Over the end of a line, such as a chip by it. */
  end?: { line: number; node: ReactNode };
  /** Under a line, across the code, pushing what follows down. */
  under?: { line: number; node: ReactNode };
  /** In a line's gutter, before its number. */
  mark?: (line: number) => ReactNode;
}

function Code({ selected, end, under, mark }: CodeProps) {
  const tokens = useTokens(CODE, languageOf(PATH));
  const lines = CODE.split('\n');

  return (
    <pre className="min-w-fit py-2 font-mono text-mono">
      {lines.map((text, index) => {
        const line = index + 1;
        const picked = selected && line >= SELECTED.from && line <= SELECTED.to;

        return (
          <Fragment key={line}>
            <div className={classNames('group relative flex pr-4', picked && 'bg-primary/8')}>
              <span className="relative w-16 shrink-0 pr-4 text-right text-faint select-none">
                {mark?.(line)}
                {line}
              </span>
              <span className="whitespace-pre">
                {tokens?.[index]?.length
                  ? tokens[index].map((token, at) => (
                      <span key={at} style={token.style}>
                        {token.content}
                      </span>
                    ))
                  : text || ' '}
              </span>
              {end?.line === line && end.node}
            </div>
            {under?.line === line && under.node}
          </Fragment>
        );
      })}
    </pre>
  );
}

function Area({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 px-6 pt-3 pb-1 text-muted">{PATH}</p>
      {children}
    </div>
  );
}

function Scroller({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={classNames('relative min-h-0 flex-1 overflow-auto', className)}>{children}</div>;
}

function FilePill({ selected }: VariantProps) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md bg-(--tint-blue) px-2 text-(--tint-blue-ink)">
      {NAME}
      {selected && <span className="opacity-70">10–13</span>}
    </span>
  );
}

function Target() {
  return <Pill icon={<SquarePen />}>A new thread</Pill>;
}

function BarButton({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-7 items-center gap-1.5 rounded-full px-3 hover:bg-shade [&_svg]:size-3.5 [&_svg]:text-muted">
      {children}
    </button>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="absolute right-6 bottom-5 rounded-full bg-floating px-3.5 py-1.5 text-small text-muted shadow-xs ring-1 ring-edge">{children}</p>;
}
