import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Code, Italic, Link2, type LucideIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { classNames } from '../lib/class-names.js';

type Mark = 'bold' | 'italic' | 'code' | 'link';

const MARKS: { mark: Mark; label: string; Icon: LucideIcon }[] = [
  { mark: 'bold', label: 'Bold (⌘B)', Icon: Bold },
  { mark: 'italic', label: 'Italic (⌘I)', Icon: Italic },
  { mark: 'code', label: 'Code (⌘E)', Icon: Code },
  { mark: 'link', label: 'Link', Icon: Link2 },
];

/** The marks over a selection, in the window's quiet menu look; a link asks for its address in the menu itself. */
export function SelectionMenu({ editor }: { editor: Editor }) {
  const [linking, setLinking] = useState(false);
  const [address, setAddress] = useState('');

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => Object.fromEntries(MARKS.map(({ mark }) => [mark, current?.isActive(mark) ?? false])) as Record<Mark, boolean>,
  });

  const toggle = (mark: Mark) => {
    const chain = editor.chain().focus();

    if (mark === 'bold') chain.toggleBold().run();
    else if (mark === 'italic') chain.toggleItalic().run();
    else if (mark === 'code') chain.toggleCode().run();
    else if (active.link) chain.extendMarkRange('link').unsetLink().run();
    else setLinking(true);
  };

  const link = (event: FormEvent) => {
    event.preventDefault();

    if (address.trim()) editor.chain().focus().extendMarkRange('link').setLink({ href: address.trim() }).run();
    setLinking(false);
    setAddress('');
  };

  return (
    <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }} className="float flex items-center gap-0.5 rounded-[10px] p-1">
      {linking ? (
        <form onSubmit={link} className="flex items-center">
          <input
            ref={(field) => field?.focus()}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setLinking(false)}
            placeholder="Paste a link, then ↵"
            className="h-7 w-56 bg-transparent px-2 outline-none placeholder:text-faint"
          />
        </form>
      ) : (
        MARKS.map(({ mark, label, Icon }) => (
          <button
            key={mark}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active[mark]}
            onClick={() => toggle(mark)}
            className={classNames('flex size-7 cursor-default items-center justify-center rounded-md', active[mark] ? 'bg-shade text-ink' : 'text-muted hover:bg-shade hover:text-ink')}
          >
            <Icon className="size-4" />
          </button>
        ))
      )}
    </BubbleMenu>
  );
}
