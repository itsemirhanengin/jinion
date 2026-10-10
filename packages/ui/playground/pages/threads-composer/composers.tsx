import { classNames } from '@jinion/ui';
import { ArrowUp, AtSign, ChevronDown, CornerDownLeft, GitBranch, ImagePlus, Laptop, Paperclip, Plus, Slash } from 'lucide-react';
import { type ReactNode, useState } from 'react';

interface ComposerProps {
  /** A file's lines carried with the message, as Ask anywhere does. */
  attached: boolean;
}

/** The composer as it is today: a box, the mode and model under the text, the branch and machine under the box. */
export function CurrentComposer({ attached }: ComposerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-2xl bg-floating shadow-xs ring-1 ring-edge">
        {attached && <Attachment className="mx-3 mt-3" />}
        <Text className="px-4 pt-3" rows={3} />
        <div className="flex items-center gap-1 px-2 pb-2">
          <Choice>
            <Dot />
            Auto
          </Choice>
          <Choice>
            Opus 5.5 <span className="text-faint">Xhigh</span>
          </Choice>
          <div className="flex-1" />
          <Icon label="Add an image">
            <ImagePlus />
          </Icon>
          <span className="flex size-7 items-center justify-center rounded-full bg-faint/50 text-on-primary">
            <ArrowUp className="size-4" />
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 px-1">
        <Choice>
          <GitBranch className="size-4" />
          feat/desktop-layout
        </Choice>
        <Choice>
          <Laptop className="size-4" />
          Local
        </Choice>
      </div>
    </div>
  );
}

/** Capsule: one line in a pill, what it carries and the model inside it; the branch, machine and context faint under it. */
export function CapsuleComposer({ attached }: ComposerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-12 items-center gap-1 rounded-[26px] bg-floating py-1.5 pr-1.5 pl-2 shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)] ring-1 ring-edge">
        <Icon label="Attach">
          <Plus />
        </Icon>
        {attached && <Attachment />}
        <input placeholder="Ask for a change" className="min-w-0 flex-1 bg-transparent px-1 outline-none placeholder:text-faint" />
        <Choice>
          <Dot />
          Auto
        </Choice>
        <Choice>Opus 5.5</Choice>
        <Send round />
      </div>
      <p className="flex items-center gap-1.5 px-4 text-small text-faint">
        <GitBranch className="size-3.5" />
        feat/desktop-layout · This Mac
        <span className="flex-1" />
        <Context />
      </p>
    </div>
  );
}

/** Toolbar: the text first, a line of quiet tools under it to attach and point at files, the mode and model at its end. */
export function ToolbarComposer({ attached }: ComposerProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl bg-floating shadow-xs ring-1 ring-edge">
        {attached && <Attachment className="mx-3 mt-3" />}
        <Text className="px-4 pt-3" rows={2} />
        <div className="flex h-11 items-center gap-0.5 border-t border-line px-2">
          <Icon label="Attach a file">
            <Paperclip />
          </Icon>
          <Icon label="Point at a file (@)">
            <AtSign />
          </Icon>
          <Icon label="Commands (/)">
            <Slash />
          </Icon>
          <Icon label="Add an image">
            <ImagePlus />
          </Icon>
          <span className="mx-1.5 h-4 w-px bg-edge" />
          <Choice>
            <Dot />
            Auto
          </Choice>
          <div className="flex-1" />
          <Choice>
            Opus 5.5 <span className="text-faint">Xhigh</span>
          </Choice>
          <Send />
        </div>
      </div>
      <p className="px-2 text-small text-faint">feat/desktop-layout · This Mac · 12% of context</p>
    </div>
  );
}

/** Soft: a tinted surface without a frame, the choices as pills on it, Send named; the branch and machine as pills on top. */
export function SoftComposer({ attached }: ComposerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-raised p-3 ring-1 ring-line focus-within:ring-primary/30">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag icon={<GitBranch />}>feat/desktop-layout</Tag>
        <Tag icon={<Laptop />}>This Mac</Tag>
        {attached && <Attachment />}
      </div>
      <Text className="px-1" rows={2} />
      <div className="flex items-center gap-1.5">
        <Tag icon={<Plus />} />
        <Tag icon={<Dot />}>Auto</Tag>
        <Tag>
          Opus 5.5 <span className="text-faint">Xhigh</span>
        </Tag>
        <div className="flex-1" />
        <button type="button" className="flex h-8 items-center gap-2 rounded-full bg-primary pr-2.5 pl-3.5 font-medium text-on-primary">
          Send
          <CornerDownLeft className="size-3.5 opacity-70" />
        </button>
      </div>
    </div>
  );
}

/** Framed: a strip on top says where the message goes and how full the context is; the modes as a row of their own. */
export function FramedComposer({ attached }: ComposerProps) {
  const [mode, setMode] = useState('Auto');

  return (
    <div className="overflow-hidden rounded-xl bg-floating shadow-xs ring-1 ring-edge">
      <div className="flex h-8 items-center gap-2 border-b border-line bg-raised px-3 text-small text-muted">
        <span className="text-ink">To Search on the users table</span>
        <span className="text-faint">·</span>
        <GitBranch className="size-3.5" />
        feat/desktop-layout
        <span className="flex-1" />
        <Context />
      </div>
      {attached && <Attachment className="mx-3 mt-3" />}
      <Text className="px-4 pt-3" rows={2} />
      <div className="flex items-center gap-2 px-2 pb-2">
        <div className="flex items-center gap-0.5 rounded-lg bg-shade p-0.5">
          {['Manual', 'Edits', 'Plan', 'Auto'].map((each) => (
            <button
              key={each}
              type="button"
              onClick={() => setMode(each)}
              className={classNames('h-6 rounded-md px-2 text-small', mode === each ? 'bg-background text-ink shadow-xs ring-1 ring-edge' : 'text-muted hover:text-ink')}
            >
              {each}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Choice>Opus 5.5</Choice>
        <Send />
      </div>
    </div>
  );
}

/** Minimal: the text alone on a hairline, its choices one quiet line that comes up once something is typed. */
export function MinimalComposer({ attached }: ComposerProps) {
  const [text, setText] = useState('');

  return (
    <div className="flex flex-col gap-1 border-t border-edge pt-3">
      {attached && <Attachment className="mx-1" />}
      <textarea
        aria-label="Message"
        rows={2}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Ask for a change. Type something to see the choices."
        className="block w-full resize-none bg-transparent px-1 text-base/6 outline-none placeholder:text-faint"
      />
      <div className={classNames('flex items-center gap-1 transition-opacity', text ? 'opacity-100' : 'opacity-40')}>
        <Choice>
          <Dot />
          Auto
        </Choice>
        <Choice>Opus 5.5</Choice>
        <Choice>
          <GitBranch className="size-4" />
          feat/desktop-layout
        </Choice>
        <div className="flex-1" />
        <span className="pr-2 text-small text-faint">↵ to send</span>
        <Send round />
      </div>
    </div>
  );
}

function Text({ className, rows }: { className?: string; rows: number }) {
  return (
    <textarea
      aria-label="Message"
      rows={rows}
      placeholder="Ask for a change. / for commands, @ for files"
      className={classNames('block w-full resize-none bg-transparent outline-none placeholder:text-faint', className)}
    />
  );
}

function Attachment({ className }: { className?: string }) {
  return (
    <span className={classNames('inline-flex h-6 w-fit items-center gap-1.5 rounded-md bg-(--tint-blue) px-2 text-(--tint-blue-ink)', className)}>
      page.tsx <span className="opacity-70">10–13</span>
    </span>
  );
}

function Choice({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg pr-1.5 pl-2 text-ink/70 hover:bg-shade hover:text-ink">
      {children}
      <ChevronDown className="size-3.5 text-faint" />
    </button>
  );
}

function Tag({ icon, children }: { icon?: ReactNode; children?: ReactNode }) {
  return (
    <button
      type="button"
      className={classNames(
        'flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-background text-ink/80 ring-1 ring-edge hover:text-ink [&_svg]:size-3.5',
        children ? 'pr-3 pl-2.5' : 'w-7 justify-center',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Icon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-shade hover:text-ink [&_svg]:size-4">
      {children}
    </button>
  );
}

function Send({ round }: { round?: boolean }) {
  return (
    <button type="button" aria-label="Send" className={classNames('flex size-8 shrink-0 items-center justify-center bg-primary text-on-primary', round ? 'rounded-full' : 'rounded-lg')}>
      <ArrowUp className="size-4" />
    </button>
  );
}

function Dot() {
  return <span className="size-1.5 shrink-0 rounded-full bg-warning" />;
}

/** How full the context is, as a ring and a number. */
function Context() {
  return (
    <span className="flex items-center gap-1.5 text-faint">
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${0.12 * 37.7} 37.7`} transform="rotate(-90 8 8)" />
      </svg>
      12%
    </span>
  );
}
