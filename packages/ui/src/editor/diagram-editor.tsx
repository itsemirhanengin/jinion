import { Dialog } from '@base-ui/react/dialog';
import { type KeyboardEvent, useEffect, useState } from 'react';
import { Button } from '../primitives/button.js';
import { drawDiagram } from './diagram.js';

/** How long the text rests before the drawing follows it. */
const SETTLE = 250;

export interface DiagramEditorProps {
  /** The diagram's text while it is edited; none keeps the editor closed. */
  text?: string;
  onSave: (text: string) => void;
  onClose: () => void;
}

/**
 * A diagram's text edited over the window: the Mermaid text on the left, its drawing on the right as it is typed. The
 * last drawing stays while the text doesn't draw, with why under it. ⌘↵ saves, Escape leaves it as it was.
 */
export function DiagramEditor({ text, onSave, onClose }: DiagramEditorProps) {
  return (
    <Dialog.Root open={text !== undefined} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="float fixed inset-x-[8vw] top-[10vh] z-50 flex h-[70vh] flex-col gap-3 rounded-xl p-4 outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0">
          {text !== undefined && <Editing initial={text} onSave={onSave} onClose={onClose} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Editing({ initial, onSave, onClose }: { initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const [drawing, setDrawing] = useState<{ svg?: string; error?: string }>({});

  useEffect(() => {
    if (text.trim() === '') return setDrawing({});

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
  }, [text]);

  const save = () => {
    onSave(text);
    onClose();
  };

  const keyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;

    event.preventDefault();
    save();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Dialog.Title className="font-medium">Edit the diagram</Dialog.Title>
        <span className="text-faint">Mermaid</span>
        <div className="flex-1" />
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        {/* A diagram whose text is all gone is taken out, rather than left as an empty box. */}
        <Button size="small" variant="primary" title="⌘↵" onClick={save}>
          {text.trim() === '' ? 'Remove the diagram' : 'Save'}
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <textarea
          aria-label="The diagram's text"
          value={text}
          spellCheck={false}
          // biome-ignore lint/a11y/noAutofocus: the editor opens because the user asked to write in it
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onKeyDown={keyDown}
          className="h-full resize-none rounded-md bg-background px-3 py-2 font-mono text-mono ring-1 ring-edge outline-none focus:ring-primary/40"
        />
        <div className="flex min-h-0 flex-col gap-2 rounded-md bg-raised p-4 ring-1 ring-line">
          <div
            className="flex min-h-0 flex-1 items-center justify-center [&_svg]:h-full [&_svg]:max-h-full [&_svg]:w-full [&_svg]:max-w-none!"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid's strict mode cleans the SVG it draws
            dangerouslySetInnerHTML={{ __html: drawing.svg ?? '' }}
          />
          {text.trim() === '' && <p className="m-auto text-faint">Nothing to draw. Saving takes the diagram out of the plan.</p>}
          {drawing.error && <p className="line-clamp-2 text-small text-removed">{drawing.error}</p>}
        </div>
      </div>
    </>
  );
}
