import type { ReactNode } from 'react';

export function Specimens({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-6">{children}</div>;
}

export function Specimen({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line pb-6 last:border-0 last:pb-0">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">{title}</h2>
        {note && <span className="text-faint">{note}</span>}
      </div>
      <div className="flex max-w-170 flex-col gap-4">{children}</div>
    </section>
  );
}
