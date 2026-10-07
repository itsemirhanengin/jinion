import { Button, classNames, FadeText, Pill } from '@jinion/ui';
import { type ChipKind, Composer, UserMessage } from '@jinion/ui/chat';
import { ArrowLeft, ArrowRight, Bot, ExternalLink, Globe, Play, RotateCw, SquareMousePointer, X } from 'lucide-react';
import type { ReactNode } from 'react';

const ELEMENT = 'PricingCard Button';

const AREA = 'Area 1';

const CHIPS: ChipKind[] = [
  { pattern: new RegExp(ELEMENT), tone: 'blue', whole: true },
  { pattern: new RegExp(AREA), tone: 'gray', whole: true },
];

const TYPED = `Make ${ELEMENT} full width under 640px. ${AREA} feels cramped, give the features more room.`;

const nothing = () => {};

/**
 * The dev server's preview as picked: the page beside its thread, one Point tool in its bar where a click takes an
 * element and a drag an area, and the picks as chips in the composer's text. Then the empty preview.
 */
export function Preview() {
  return (
    <div className="flex flex-col gap-10 pb-10">
      <Window
        toolbar={<Bar pointing />}
        pointing
        page={<Site />}
        composer={<Composer value={TYPED} onChange={nothing} onSubmit={nothing} chips={CHIPS} controls={<Controls />} onImages={async () => ''} />}
      />
      <Window
        title="Preview"
        toolbar={<Bar address="" />}
        page={<Empty />}
        composer={<Composer value="" onChange={nothing} onSubmit={nothing} controls={<Controls />} placeholder="Ask for a change. / for commands, @ for files" />}
      />
    </div>
  );
}

/** The thread on the left, the preview beside it as a tab of its own, half the room each. */
function Window({ title = 'localhost:5173', toolbar, page, composer, pointing }: { title?: string; toolbar: ReactNode; page: ReactNode; composer: ReactNode; pointing?: boolean }) {
  return (
    <div className="flex h-176 overflow-hidden rounded-xl bg-chrome ring-1 ring-black/10">
      <div className="m-2 flex min-w-0 flex-1 overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-black/5">
        <section className="flex min-w-0 flex-1 flex-col">
          <Tabs>
            <Tab>
              <FadeText>Pricing page polish</FadeText>
            </Tab>
          </Tabs>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex max-w-176 flex-col gap-4 px-8 pt-4 pb-6">
              <UserMessage text="start the website and open the pricing page" />
              <p className="text-pretty">
                The website runs on <span className="font-mono text-mono">localhost:5173</span>, started in a terminal of the project. The pricing page is at
                <span className="font-mono text-mono"> /pricing</span>.
              </p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-176 px-8 pb-4">{composer}</div>
        </section>
        <section className="flex min-w-0 flex-1 flex-col border-l border-line">
          <Tabs>
            <Tab>
              <Globe className="size-4 shrink-0 text-faint" />
              <FadeText>{title}</FadeText>
              <X className="ml-auto size-3.5 shrink-0 text-muted" />
            </Tab>
          </Tabs>
          {toolbar}
          <div className={classNames('relative min-h-0 flex-1 overflow-hidden', pointing && 'ring-2 ring-accent ring-inset')}>{page}</div>
        </section>
      </div>
    </div>
  );
}

function Tabs({ children }: { children: ReactNode }) {
  return <div className="flex h-11 shrink-0 items-center gap-1 px-3">{children}</div>;
}

function Tab({ children }: { children: ReactNode }) {
  return <div className="flex h-7 w-44 min-w-24 shrink items-center gap-2 rounded-lg bg-shade px-2.5">{children}</div>;
}

/** Going back and forth, the address, pointing at the page, and the page in the browser. */
function Bar({ address = 'localhost:5173/pricing', pointing }: { address?: string; pointing?: boolean }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-3">
      <Icon label="Back">
        <ArrowLeft />
      </Icon>
      <Icon label="Forward">
        <ArrowRight />
      </Icon>
      <Icon label="Reload">
        <RotateCw />
      </Icon>
      <div className="mx-1 flex h-7 min-w-0 flex-1 items-center rounded-lg bg-shade px-2.5">
        {address ? <FadeText>{address}</FadeText> : <span className="text-faint">Type an address</span>}
      </div>
      <Icon label="Point at the page: click an element, or drag over an area (⇧⌘C)" on={pointing}>
        <SquareMousePointer />
      </Icon>
      <Icon label="Open in the browser">
        <ExternalLink />
      </Icon>
    </div>
  );
}

function Controls() {
  return (
    <>
      <Pill>Auto</Pill>
      <Pill>Opus 5.5</Pill>
    </>
  );
}

/** Over the element, as short as it can be: the element, then the component it is in. */
function Label() {
  return (
    <span className="absolute bottom-full left-0 mb-1.5 flex items-center gap-1.5 rounded-md bg-primary px-1.5 py-0.5 text-small whitespace-nowrap text-on-primary shadow-sm">
      <span className="font-medium">button</span>
      <span className="opacity-60">PricingCard</span>
    </span>
  );
}

/** The user's own page, in looks of its own, so the app's pieces over it stand apart. */
function Site() {
  return (
    <div className="relative h-full overflow-hidden bg-[#fbfaf8] text-[#1c1917]">
      <div className="flex h-12 items-center gap-6 border-b border-[#e7e5e4] px-6 text-[13px]">
        <span className="font-semibold">Acme</span>
        <span className="text-[#78716c]">Product</span>
        <span>Pricing</span>
        <span className="text-[#78716c]">Docs</span>
      </div>
      <div className="px-6 pt-8 text-center">
        <h3 className="text-[22px] font-semibold tracking-tight">Simple pricing</h3>
        <p className="mt-1 text-[#78716c]">Start free, upgrade when your team grows.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 px-6 pt-6">
        <Card name="Free" price="$0" />
        <Card name="Pro" price="$12" picked />
      </div>
      <div className="relative mx-6 mt-5 grid grid-cols-3 gap-2 text-[12px] text-[#57534e]">
        {['Unlimited projects', 'Shared workspaces', 'Priority support'].map((feature) => (
          <span key={feature} className="rounded-md bg-[#f5f5f4] px-2 py-2">
            {feature}
          </span>
        ))}
        <span className="absolute -inset-2 rounded-[2px] border border-dashed border-accent bg-accent/5">
          <span className="absolute right-0 -bottom-5 font-mono text-[11px] text-accent">664 × 60</span>
        </span>
      </div>
    </div>
  );
}

function Card({ name, price, picked }: { name: string; price: string; picked?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#e7e5e4] bg-white p-4">
      <span className="text-[13px] text-[#78716c]">{name}</span>
      <span className="text-[24px] font-semibold">
        {price}
        <span className="text-[13px] font-normal text-[#78716c]"> / month</span>
      </span>
      <span className="relative flex self-start">
        <span className={classNames('block rounded-lg px-4 py-2 text-[13px]', picked ? 'bg-[#1c1917] text-white' : 'border border-[#e7e5e4]')}>Get {name}</span>
        {picked && (
          <>
            <span className="pointer-events-none absolute -inset-0.5 rounded-[3px] bg-accent/10 ring-2 ring-accent" />
            <Label />
          </>
        )}
      </span>
    </div>
  );
}

/** No page yet: the servers the terminals show running, then the scripts that start one, then an address. */
function Empty() {
  return (
    <div className="mx-auto flex max-w-120 flex-col gap-6 px-6 pt-8">
      <Group title="Running in the terminals">
        <Row icon={<Bot className="size-4 shrink-0 text-faint" />} title="localhost:5173" detail="pnpm dev, apps/website" action="Open" />
        <Row icon={<Globe className="size-4 shrink-0 text-faint" />} title="localhost:3000" detail="pnpm dev:docs, apps/docs" action="Open" />
      </Group>
      <Group title="Start one">
        <Row icon={<Play className="size-4 shrink-0 text-faint" />} title="pnpm dev" detail="vite, from package.json" action="Run" />
        <Row icon={<Play className="size-4 shrink-0 text-faint" />} title="pnpm dev:docs" detail="next dev, from package.json" action="Run" />
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="px-2.5 pb-1 text-small text-faint">{title}</h3>
      {children}
    </div>
  );
}

function Row({ icon, title, detail, action }: { icon: ReactNode; title: string; detail: string; action: string }) {
  return (
    <div className="group menu-row text-ink hover:bg-shade">
      {icon}
      <span className="shrink-0 font-mono text-mono">{title}</span>
      <FadeText className="text-faint">{detail}</FadeText>
      <Button size="small" className="ml-auto opacity-0 group-hover:opacity-100">
        {action}
      </Button>
    </div>
  );
}

function Icon({ label, on, children }: { label: string; on?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={classNames(
        'flex size-7 shrink-0 cursor-default items-center justify-center rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
        on ? 'bg-(--tint-blue) text-(--tint-blue-ink)' : 'text-muted hover:bg-shade hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
