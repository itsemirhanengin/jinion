import { classNames } from '@jinion/ui';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

const MODELS = [
  { group: 'Claude', rows: [{ label: 'Default (recommended)', detail: 'Opus 5.5 · Best for everyday, complex tasks', checked: true }, { label: 'Sonnet 5', detail: 'Fast, for most coding' }, { label: 'Haiku 4.5', detail: 'Quickest, for small tasks' }] },
  { group: 'Codex', rows: [{ label: 'GPT-6.1-Sol', detail: 'Latest workhorse model for coding' }, { label: 'GPT-6-Astra', detail: 'Frontier intelligence for hard work' }, { label: 'GPT-6-Luna', detail: 'Fast and affordable' }] },
];

const COMMANDS = [
  { label: '/model', detail: 'Switch the model and its effort', hint: 'model' },
  { label: '/effort', detail: 'Change how hard the model thinks', hint: 'level' },
  { label: '/help', detail: 'Shortcuts, commands and skills' },
  { label: '/resume', detail: 'Pick up a previous conversation', hint: 'search' },
  { label: '/mode', detail: 'How freely the agent acts' },
];

/** Three directions for every menu, popover and list over the composer, drawn with the same content side by side. */
export function Menus() {
  return (
    <div className="grid min-h-full grid-cols-3 gap-6 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5">
      <Direction name="A · Quiet" note="One line a row, the description faint beside the name; a soft shadow, a hairline edge.">
        <QuietMenu />
        <QuietMenu commands />
      </Direction>
      <Direction name="B · Detail below" note="Only names in the rows; what the highlighted one does shows in a footer.">
        <DetailMenu />
        <DetailMenu commands />
      </Direction>
      <Direction name="C · Native" note="Like a macOS menu: tight rows, the highlight in the primary, white text.">
        <NativeMenu />
        <NativeMenu commands />
      </Direction>
    </div>
  );
}

function Direction({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-medium">{name}</h2>
        <p className="text-pretty text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

const quietSurface = 'rounded-[10px] bg-white p-1 shadow-[0_6px_24px_-8px_rgb(0_0_0/0.14),0_0_0_0.5px_rgb(0_0_0/0.1)]';

function QuietMenu({ commands }: { commands?: boolean }) {
  return (
    <div className={classNames(quietSurface, 'w-72 text-[13px]')}>
      {commands
        ? COMMANDS.map((row, index) => (
            <div key={row.label} className={classNames('flex h-7 items-center gap-2 rounded-md px-2', index === 0 && 'bg-black/[0.045]')}>
              <span className="shrink-0 text-ink">{row.label}</span>
              <span className="min-w-0 flex-1 truncate text-black/40">{row.detail}</span>
            </div>
          ))
        : MODELS.map(({ group, rows }) => (
            <div key={group}>
              <div className="px-2 pt-2 pb-0.5 text-[11px] font-medium text-black/35">{group}</div>
              {rows.map((row, index) => (
                <div key={row.label} className={classNames('flex h-7 items-center gap-2 rounded-md px-2', group === 'Claude' && index === 1 && 'bg-black/[0.045]')}>
                  <span className="shrink-0 text-ink">{row.label}</span>
                  <span className="min-w-0 flex-1 truncate text-black/40">{row.detail}</span>
                  {row.checked && <Check className="size-3.5 shrink-0 text-ink" />}
                </div>
              ))}
            </div>
          ))}
    </div>
  );
}

function DetailMenu({ commands }: { commands?: boolean }) {
  const rows = commands ? COMMANDS.map((row) => ({ ...row, group: '' })) : MODELS.flatMap(({ group, rows }) => rows.map((row) => ({ ...row, group })));
  const highlighted = commands ? 0 : 1;

  return (
    <div className={classNames(quietSurface, 'w-60 overflow-hidden p-0 text-[13px]')}>
      <div className="p-1">
        {rows.map((row, index) => (
          <div key={row.label}>
            {row.group && row.group !== rows[index - 1]?.group && <div className="px-2 pt-2 pb-0.5 text-[11px] font-medium text-black/35">{row.group}</div>}
            <div className={classNames('flex h-7 items-center gap-2 rounded-md px-2', index === highlighted && 'bg-black/[0.045]')}>
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              {'hint' in row && row.hint && <span className="text-[11px] text-black/30">{row.hint}</span>}
              {'checked' in row && row.checked && <Check className="size-3.5 shrink-0" />}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-black/[0.06] px-3 py-2 text-[12px] leading-4 text-black/50">{rows[highlighted]?.detail}</div>
    </div>
  );
}

function NativeMenu({ commands }: { commands?: boolean }) {
  const rows = commands ? COMMANDS.map((row) => ({ ...row, group: '' })) : MODELS.flatMap(({ group, rows }) => rows.map((row) => ({ ...row, group })));
  const highlighted = commands ? 0 : 1;

  return (
    <div className="w-64 rounded-lg bg-white/85 p-[5px] text-[13px] shadow-[0_8px_30px_-6px_rgb(0_0_0/0.18),0_0_0_0.5px_rgb(0_0_0/0.15)] backdrop-blur-xl">
      {rows.map((row, index) => (
        <div key={row.label}>
          {row.group && row.group !== rows[index - 1]?.group && (
            <>
              {index > 0 && <div className="mx-2 my-1 h-px bg-black/[0.08]" />}
              <div className="px-2 pt-0.5 pb-0.5 text-[11px] font-medium text-black/40">{row.group}</div>
            </>
          )}
          <div className={classNames('flex h-6 items-center gap-1.5 rounded-[5px] px-2', index === highlighted ? 'bg-[#181E33] text-white' : 'text-ink')}>
            <span className="flex w-3.5 shrink-0">{'checked' in row && row.checked && <Check className="size-3.5" />}</span>
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {'hint' in row && row.hint && <span className={classNames('text-[11px]', index === highlighted ? 'text-white/60' : 'text-black/30')}>{row.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
