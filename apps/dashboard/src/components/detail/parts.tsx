'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { PageBody, touchTarget } from '@/components/page';

/** The centered two-column body of a detail page: the main column and a narrower aside. */
export function DetailBody({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  return (
    <PageBody className="pb-28">
      <div className="mx-auto grid max-w-5xl gap-x-10 gap-y-8 pt-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-8">{children}</div>
        <aside className="flex flex-col gap-5">{aside}</aside>
      </div>
    </PageBody>
  );
}

export function DetailTitle({ title, badges, subtitle }: { title: string; badges?: React.ReactNode; subtitle: React.ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h1 className="text-xl/7 font-semibold tracking-tight">{title}</h1>
        {badges}
      </div>
      <p className="text-neutral-500">{subtitle}</p>
    </div>
  );
}

export function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="font-medium">{title}</h2>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function SideSection({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-neutral-950/8 not-first:border-t not-first:pt-5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Facts({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-neutral-500">{row.label}</dt>
          <dd className="min-w-0 text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Reference({ children }: { children: string }) {
  return <span className="rounded-md bg-neutral-950/6 px-1 tabular-nums">{children}</span>;
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="relative grid size-6 shrink-0 place-items-center rounded-md text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-950"
    >
      {copied ? <Check className="size-4 shrink-0" /> : <Copy className="size-4 shrink-0" />}
      {touchTarget}
    </button>
  );
}
