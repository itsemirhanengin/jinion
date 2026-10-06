import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps, useEditorState } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { drawDiagram } from './diagram.js';

/** How long the text rests before a diagram is drawn again, so it isn't drawn at every key. */
const SETTLE = 300;

/**
 * A code block, and a Mermaid one as the diagram its text draws: the text shows while the caret is in it, a click on the
 * diagram puts it there, and the drawing stays under it as a preview.
 */
export function CodeBlockView({ node, editor, getPos }: ReactNodeViewProps) {
  const diagram = node.attrs.language === 'mermaid';
  const text = node.textContent;

  const [drawing, setDrawing] = useState<{ svg?: string; error?: string }>({});

  const inside = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const at = getPos();
      if (at === undefined || !current) return false;

      const { from, to } = current.state.selection;

      return from > at && to < at + node.nodeSize;
    },
  });

  useEffect(() => {
    if (!diagram) return;

    let current = true;

    const timer = setTimeout(() => {
      drawDiagram(text).then(
        (svg) => current && setDrawing({ svg }),
        (error: Error) => current && setDrawing((before) => ({ svg: before.svg, error: error.message })),
      );
    }, SETTLE);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [diagram, text]);

  if (!diagram) {
    return (
      <NodeViewWrapper>
        <pre>
          <NodeViewContent<'code'> as="code" />
        </pre>
      </NodeViewWrapper>
    );
  }

  const edit = () => {
    const at = getPos();

    if (at !== undefined && editor.isEditable) editor.chain().focus().setTextSelection(at + node.nodeSize - 1).run();
  };

  return (
    <NodeViewWrapper className="not-prose flex flex-col gap-2 rounded-lg bg-raised/60 py-4 ring-1 ring-line">
      <pre className={classNames('mx-4 rounded-md bg-background px-3 py-2 font-mono text-mono ring-1 ring-edge', !inside && 'hidden')}>
        <NodeViewContent<'code'> as="code" />
      </pre>
      {drawing.svg && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the diagram's text takes the keys; the click only puts the caret in it
        // biome-ignore lint/a11y/noStaticElementInteractions: see above
        <div
          contentEditable={false}
          onClick={edit}
          className="flex justify-center px-4 [&_svg]:h-auto [&_svg]:max-w-full"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid's strict mode cleans the SVG it draws
          dangerouslySetInnerHTML={{ __html: drawing.svg }}
        />
      )}
      <p contentEditable={false} className={classNames('line-clamp-2 px-4 text-center text-small', drawing.error && inside ? 'text-removed' : 'text-faint')}>
        {drawing.error && inside ? drawing.error : inside ? 'Diagram text, drawn below as you type' : 'Diagram · click to edit its text'}
      </p>
    </NodeViewWrapper>
  );
}
