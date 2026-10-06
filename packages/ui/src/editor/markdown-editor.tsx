import { CodeBlock } from '@tiptap/extension-code-block';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { classNames } from '../lib/class-names.js';
import { CodeBlockView } from './code-block-view.js';
import { SelectionMenu } from './selection-menu.js';

export interface MarkdownEditorProps {
  markdown: string;
  /** The text as changed; `undefined` once it is back to what it was. */
  onChange?: (markdown: string | undefined) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Markdown edited as the document it draws: headings, marks, lists and task lists, code, tables, and Mermaid diagrams
 * drawn. Typing `#`, `-`, `1.`, `[ ]` or three backticks starts a block; a selection brings the marks. A new `markdown`
 * takes a new editor, by a key the caller gives.
 */
export function MarkdownEditor({ markdown, onChange, editable = true, placeholder, className }: MarkdownEditorProps) {
  const changed = useRef(onChange);
  // The editor tidies the document as it opens, adding a trailing paragraph and the like, so what the user changed is
  // measured from the text as it is when they first touch it; nothing before that counts.
  const original = useRef<string>(undefined);

  changed.current = onChange;

  const touched = () => {
    original.current ??= editor?.getMarkdown();

    return false;
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true } }),
      CodeBlock.extend({ addNodeView: () => ReactNodeViewRenderer(CodeBlockView) }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit,
      Placeholder.configure({ placeholder }),
      Markdown,
    ],
    content: markdown,
    contentType: 'markdown',
    editable,
    editorProps: {
      attributes: { class: classNames('prose document outline-none', className) },
      handleDOMEvents: { mousedown: touched, keydown: touched, beforeinput: touched, paste: touched, drop: touched },
    },
    onUpdate: ({ editor: updated }) => {
      if (original.current === undefined) return;

      const now = updated.getMarkdown();

      changed.current?.(now === original.current ? undefined : now);
    },
  });

  // Without an update, which would read as the user changing the text.
  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  return (
    <>
      <EditorContent editor={editor} />
      {editor && editable && <SelectionMenu editor={editor} />}
    </>
  );
}
