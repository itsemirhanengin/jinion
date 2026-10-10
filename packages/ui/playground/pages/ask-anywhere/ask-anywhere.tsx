import { PillTabs } from '@jinion/ui';
import { ChevronRight, Code, FileText, Files, GitBranch, MessagesSquare, Search, X } from 'lucide-react';
import { type ComponentType, useState } from 'react';
import { NAME } from './code.js';
import { CapsuleAsk, CornerAsk, InlineAsk, NotesAsk, SelectionAsk } from './variants.js';

const variants: { name: string; Variant: ComponentType<{ selected: boolean }> }[] = [
  { name: 'Capsule (current)', Variant: CapsuleAsk },
  { name: 'On selection', Variant: SelectionAsk },
  { name: 'Inline', Variant: InlineAsk },
  { name: 'Corner', Variant: CornerAsk },
  { name: 'Notes in the gutter', Variant: NotesAsk },
];

const tree = ['.changeset', '.github', 'apps', 'packages', 'src'];

/** Ways to ask about a file, or lines of it, from its tab in Code, each picked apart through the ui.sh picker. */
export function AskAnywhere() {
  const [selected, setSelected] = useState(true);

  return (
    <div className="flex h-[calc(100dvh-2rem)] min-h-180 flex-col gap-3">
      <label className="flex w-fit items-center gap-2 px-1 text-muted">
        <input type="checkbox" checked={selected} onChange={(event) => setSelected(event.target.checked)} className="accent-primary" />
        Lines 10–13 selected
      </label>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-chrome shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)] ring-1 ring-black/12">
        <header className="flex h-11 shrink-0 items-center gap-2 px-4">
          <span className="flex w-14 gap-2">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </span>
          <span className="flex size-5 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-on-primary">C</span>
          <span className="mr-2 font-medium">coding-agent</span>
          <PillTabs
            value="code"
            onChange={() => {}}
            tabs={[
              { id: 'agent', label: 'Agent', icon: <MessagesSquare /> },
              { id: 'code', label: 'Code', icon: <Code /> },
            ]}
          />
        </header>
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-60 shrink-0 flex-col gap-2 pb-2 pl-2">
            <div className="flex h-8 items-center">
              <PillTabs
                value="files"
                onChange={() => {}}
                tabs={[
                  { id: 'files', label: 'Files', icon: <Files /> },
                  { id: 'search', label: 'Search', icon: <Search /> },
                  { id: 'git', label: 'Git', icon: <GitBranch /> },
                ]}
              />
            </div>
            <div className="flex flex-col">
              {tree.map((folder) => (
                <p key={folder} className="flex h-7 items-center gap-1.5 px-2 text-ink/80">
                  <ChevronRight className="size-3.5 text-faint" />
                  {folder}
                </p>
              ))}
              <p className="flex h-7 items-center gap-1.5 rounded-lg bg-background px-2 pl-7 shadow-xs ring-1 ring-edge">{NAME}</p>
            </div>
          </aside>
          <div className="mr-2 mb-2 ml-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-edge">
            <div className="flex h-11 shrink-0 items-center gap-1 px-3">
              <span className="flex h-7 w-48 items-center gap-2 rounded-lg bg-shade px-2.5">
                <FileText className="size-3.5 text-muted" />
                <span className="flex-1 truncate italic">{NAME}</span>
                <X className="size-3.5 text-muted" />
              </span>
            </div>
            <div data-uidotsh-pick="Ask anywhere" className="contents">
              {variants.map(({ name, Variant }, index) => (
                <div key={name} data-uidotsh-option={name} className="contents" hidden={index > 0}>
                  <Variant key={String(selected)} selected={selected} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
