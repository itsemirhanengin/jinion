import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps, useEditorState } from '@tiptap/react';
import { Workflow } from 'lucide-react';
import { useEffect, useState } from 'react';
import { drawDiagram } from './diagram.js';
import { DiagramEditor } from './diagram-editor.js';

/**
 * A code block, and a Mermaid one as the diagram its text draws. The text stays out of the page; a click on the
 * drawing opens it over the window, next to the drawing as it changes.
 */
export function CodeBlockView({ node, editor, getPos }: ReactNodeViewProps) {
  const diagram = node.attrs.language === 'mermaid';
  const text = node.textContent;
  const empty = text.trim() === '';

  const editable = useEditorState({ editor, selector: ({ editor: current }) => current?.isEditable ?? false });

  const [svg, setSvg] = useState<string | null>();
  const [editing, setEditing] = useState<string>();

  useEffect(() => {
    if (!diagram || empty) return;

    let current = true;

    drawDiagram(text).then(
      (drawn) => current && setSvg(drawn),
      () => current && setSvg(null),
    );

    return () => {
      current = false;
    };
  }, [diagram, empty, text]);

  if (!diagram) {
    return (
      <NodeViewWrapper>
        <pre>
          <NodeViewContent<'code'> as="code" />
        </pre>
      </NodeViewWrapper>
    );
  }

  const save = (changed: string) => {
    const at = getPos();
    if (at === undefined || changed === text) return;

    editor
      .chain()
      .command(({ tr }) => {
        if (changed.trim() === '') tr.delete(at, at + node.nodeSize);
        else tr.insertText(changed, at + 1, at + node.nodeSize - 1);

        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper className="not-prose flex flex-col gap-2 rounded-lg bg-raised/60 py-4 ring-1 ring-line">
      {/* The text the drawing comes from, kept in the document for the editor; it shows in the diagram's editor. */}
      <pre className="hidden">
        <NodeViewContent<'code'> as="code" />
      </pre>
      {empty ? (
        <button
          type="button"
          contentEditable={false}
          disabled={!editable}
          onClick={() => setEditing(text)}
          className="flex cursor-default flex-col items-center gap-1.5 px-4 py-3 text-faint hover:text-ink disabled:pointer-events-none"
        >
          <Workflow className="size-5" />
          {editable ? 'An empty diagram · click to write it' : 'An empty diagram'}
        </button>
      ) : svg === null ? (
        <button type="button" contentEditable={false} disabled={!editable} onClick={() => setEditing(text)} className="mx-4 cursor-default text-left disabled:pointer-events-none">
          <pre className="overflow-x-auto font-mono text-mono whitespace-pre text-muted">{text}</pre>
        </button>
      ) : (
        <button
          type="button"
          contentEditable={false}
          disabled={!editable}
          onClick={() => setEditing(text)}
          className="flex cursor-default justify-center px-4 disabled:pointer-events-none [&_svg]:h-auto [&_svg]:max-w-full"
          aria-label="Edit the diagram"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid's strict mode cleans the SVG it draws
          dangerouslySetInnerHTML={{ __html: svg ?? '' }}
        />
      )}
      {editable && !empty && (
        <p contentEditable={false} className="px-4 text-center text-small text-faint">
          {svg === null ? "This diagram doesn't draw · click to fix its text" : 'Diagram · click to edit'}
        </p>
      )}
      <DiagramEditor text={editing} onSave={save} onClose={() => setEditing(undefined)} />
    </NodeViewWrapper>
  );
}
