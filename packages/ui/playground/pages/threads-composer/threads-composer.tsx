import { classNames, StatusIcon } from '@jinion/ui';
import { ChevronRight, Code, MessagesSquare, Plus, X } from 'lucide-react';
import { type ComponentType, useState } from 'react';
import { CapsuleComposer, CurrentComposer, FramedComposer, MinimalComposer, SoftComposer, ToolbarComposer } from './composers.js';
import { CompactSidebar, CurrentSidebar, PinnedSidebar, QuietSidebar, StatusSidebar, TimelineSidebar } from './sidebars.js';

const sidebars: { name: string; Sidebar: ComponentType }[] = [
  { name: 'Today (current)', Sidebar: CurrentSidebar },
  { name: 'Quiet', Sidebar: QuietSidebar },
  { name: 'By status', Sidebar: StatusSidebar },
  { name: 'Timeline', Sidebar: TimelineSidebar },
  { name: 'Pinned and recent', Sidebar: PinnedSidebar },
  { name: 'Compact', Sidebar: CompactSidebar },
];

const composers: { name: string; Composer: ComponentType<{ attached: boolean }> }[] = [
  { name: 'Box (current)', Composer: CurrentComposer },
  { name: 'Capsule', Composer: CapsuleComposer },
  { name: 'Toolbar', Composer: ToolbarComposer },
  { name: 'Soft', Composer: SoftComposer },
  { name: 'Framed', Composer: FramedComposer },
  { name: 'Minimal', Composer: MinimalComposer },
];

const PICKS = ['Threads sidebar', 'Composer'] as const;

/** The threads sidebar and the composer drawn several ways, each picked apart through the ui.sh picker, in one window. */
export function ThreadsComposer() {
  const [attached, setAttached] = useState(false);
  const [comparing, setComparing] = useState<(typeof PICKS)[number]>('Threads sidebar');

  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-180 flex-col gap-3">
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-2">
          <span className="text-muted">Compare</span>
          <div className="flex items-center gap-0.5 rounded-lg bg-shade p-0.5">
            {PICKS.map((pick) => (
              <button
                key={pick}
                type="button"
                onClick={() => setComparing(pick)}
                className={classNames('h-7 rounded-md px-2.5', comparing === pick ? 'bg-background text-ink shadow-xs ring-1 ring-edge' : 'text-muted hover:text-ink')}
              >
                {pick}
              </button>
            ))}
          </div>
        </div>
        <label className="flex w-fit items-center gap-2 text-muted">
          <input type="checkbox" checked={attached} onChange={(event) => setAttached(event.target.checked)} className="accent-primary" />
          With a file's lines attached, as Ask anywhere sends them
        </label>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-chrome shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] ring-1 ring-black/12">
        <header className="flex h-11 shrink-0 items-center gap-2 px-4">
          <span className="flex w-14 gap-2">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-on-primary">C</span>
          <span className="font-medium">coding-agent</span>
          <span className="ml-2 flex h-7 items-center gap-1.5 rounded-full bg-floating px-3 shadow-xs ring-1 ring-edge">
            <MessagesSquare className="size-3.5" />
            Agent
          </span>
          <span className="flex h-7 items-center gap-1.5 rounded-full px-3 text-muted">
            <Code className="size-3.5" />
            Code
          </span>
        </header>
        <div className="flex min-h-0 flex-1">
          {/* The ui.sh picker reads only the first group on the page, so only the one compared carries the attribute. */}
          <div data-uidotsh-pick={comparing === 'Threads sidebar' ? comparing : undefined} className="contents">
            {sidebars.map(({ name, Sidebar }, index) => (
              <div key={name} data-uidotsh-option={name} className="contents" hidden={index > 0}>
                <Sidebar />
              </div>
            ))}
          </div>
          <div className="mr-2 mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-edge">
            <div className="flex h-11 shrink-0 items-center gap-1 px-3">
              <span className="flex h-7 w-48 items-center gap-2 rounded-lg bg-shade px-2.5">
                <StatusIcon status="idle" />
                <span className="flex-1 truncate">Jinion'un frontend yetkinliği</span>
                <X className="size-3.5 text-muted" />
              </span>
              <Plus className="ml-1 size-4 text-muted" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex max-w-176 flex-col gap-5 px-8 pt-4 pb-8">
                <div className="rounded-xl bg-raised px-4 py-3 ring-1 ring-edge">
                  Selam jinion, bugün seninle frontend tarafındaki yetkinliğini konuşalım: neyi iyi yapıyorsun, neyi eksik?
                </div>
                <p className="text-pretty text-ink/85">
                  Frontend işlerinde en güçlü olduğum yer mevcut bir arayüzü okuyup aynı dilde yeni parçalar eklemek. Eksik kaldığım yer, bir tasarımı gözle
                  kontrol etmek: değişikliği tarayıcıda açıp bakmadan bitti demem doğru olmaz.
                </p>
                <div className="flex flex-col text-muted">
                  <p className="flex h-7 items-center gap-2">
                    Explored 6 files, 3 searches <ChevronRight className="size-4 text-faint" />
                  </p>
                  <p className="flex h-7 items-center gap-2">
                    Read the design notes <ChevronRight className="size-4 text-faint" />
                  </p>
                </div>
                <p className="text-pretty text-ink/85">
                  Önerim: Preview'ı her arayüz değişikliğinden sonra kendiliğinden açayım, seçtiğin öğeyi bağlam olarak alayım ve farkı ekran görüntüsüyle
                  göstereyim.
                </p>
              </div>
            </div>
            <div className="mx-auto w-full max-w-176 px-8 pb-4">
              <div data-uidotsh-pick={comparing === 'Composer' ? comparing : undefined} className="contents">
                {composers.map(({ name, Composer }, index) => (
                  <div key={name} data-uidotsh-option={name} className="contents" hidden={index > 0}>
                    <Composer attached={attached} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
