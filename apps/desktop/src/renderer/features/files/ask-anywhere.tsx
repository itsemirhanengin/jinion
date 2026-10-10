import { ChoiceMenu, Pill } from '@jinion/ui';
import { Composer } from '@jinion/ui/chat';
import { useWorkbench } from '@jinion/workbench';
import { atom, useAtom, useSetAtom } from 'jotai';
import { MessageSquare, MessagesSquare, Plus, SquarePen } from 'lucide-react';
import { type ButtonHTMLAttributes, type RefObject, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Submission } from '../../core/core.js';
import { draftsAtom } from '../../state/app.js';
import { useCore } from '../../state/session.js';
import { useOpenSessions } from '../threads/active.js';
import { newThread } from '../threads/spare.js';

/** The first and last line selected in a file, counted from 1. */
export interface Lines {
  from: number;
  to: number;
}

const NEW = 'new';

/** The file tab ⌘L asked to open its composer in, by the tab's id; in each project's store. */
export const askedAtom = atom<string | undefined>(undefined);

/**
 * The lines selected in the element's code. A selection moving elsewhere, as into the composer, keeps them; a click on
 * the code's lines, which leaves nothing selected, lets them go.
 */
export function useSelectedLines(code: RefObject<HTMLElement | null>) {
  const [lines, setLines] = useState<Lines>();

  useEffect(() => {
    const changed = () => {
      const selection = document.getSelection();
      const box = code.current;
      if (!selection || !box?.contains(selection.anchorNode)) return;

      const elementOf = (node: Node | null) => (node instanceof Element ? node : node?.parentElement);

      // The bar and the composer sit in the code too, and what happens in them isn't a selection of it.
      if (elementOf(selection.anchorNode)?.closest('[data-ask]')) return;

      // Pressing the bar collapses the selection onto the box, which isn't a click on the code's lines.
      if (selection.isCollapsed) {
        if (elementOf(selection.anchorNode)?.closest('[data-line]')) setLines(undefined);

        return;
      }

      const lineOf = (node: Node | null) => Number(elementOf(node)?.closest('[data-line]')?.getAttribute('data-line'));
      const anchor = lineOf(selection.anchorNode);
      const focus = lineOf(selection.focusNode);

      setLines(anchor && focus ? { from: Math.min(anchor, focus), to: Math.max(anchor, focus) } : undefined);
    };

    document.addEventListener('selectionchange', changed);

    return () => document.removeEventListener('selectionchange', changed);
  }, [code]);

  return lines;
}

/**
 * Nothing over a file's code until it is asked about. Lines selected get a bar under them, to ask about them or to add
 * them to a thread, and asking opens the composer right there; ⌘L asks about the selection, or with none, the whole file
 * at the tab's foot. The question goes to the thread picked, the file's own by default, or to a new one.
 */
export function AskAnywhere({ id, session, path, code, lines, scroller }: { id: string; session: string; path: string; code: string; lines?: Lines; scroller: RefObject<HTMLElement | null> }) {
  const core = useCore();
  const workbench = useWorkbench();
  const threads = useOpenSessions();
  const setDrafts = useSetAtom(draftsAtom);
  const [asked, setAsked] = useAtom(askedAtom);

  const [box, setBox] = useState<HTMLElement | null>(null);
  const [asking, setAsking] = useState<{ lines?: Lines }>();
  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<string>();
  const [top, setTop] = useState<number>();

  const target = picked ?? (threads.some((thread) => thread.id === session) ? session : NEW);
  const about = asking ? asking.lines : lines;

  const choices = [
    ...threads.map((thread) => ({ value: thread.id, label: thread.snapshot.state.title ?? 'New thread' })),
    { value: NEW, label: 'A new thread' },
  ];

  useLayoutEffect(() => setBox(scroller.current), [scroller]);

  useEffect(() => {
    if (asked !== id) return;

    setAsked(undefined);
    setAsking({ lines });
  }, [asked]);

  // Another selection, or a click in the code, lets go of a question not typed yet.
  useEffect(() => {
    if (asking && draft.trim() === '') setAsking(undefined);
  }, [lines]);

  // Under the last line asked about, inside the code, so it scrolls with it.
  useLayoutEffect(() => {
    const line = about && box?.querySelector<HTMLElement>(`[data-line="${about.to}"]`);

    setTop(line ? line.offsetTop + line.offsetHeight : undefined);
  }, [box, about?.to, code]);

  const close = () => {
    setAsking(undefined);
    setDraft('');
  };

  const submit = (text: string) => {
    const question = text.trim();
    if (!question) return;

    const submission = askedAbout(question, path, code, asking?.lines);
    const working = threads.find((thread) => thread.id === target)?.snapshot.fields.working;

    close();

    if (target === NEW) core.act(newThread(core, workbench).then((thread) => core.submit(thread, submission)));
    // A thread at work gets it once its turn ends, as its own composer queues.
    else core.act(working ? core.queue(target, submission) : core.submit(target, submission));
  };

  // The lines as a mention at the end of the thread's draft, for the message to be written there.
  const add = (thread: string) => {
    if (!lines) return;

    const mention = `${/\s/.test(path) ? `@"${path}"` : `@${path}`} ${where(lines)} `;

    const put = (into: string) => {
      setDrafts((all) => ({ ...all, [into]: all[into]?.trim() ? `${all[into].trimEnd()} ${mention}` : mention }));
      workbench.setMode('agent');
      workbench.open({ kind: 'thread', id: into });
    };

    if (thread === NEW) core.act(newThread(core, workbench).then(put));
    else put(thread);
  };

  const composer = (
    <div data-ask>
      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        onEscape={close}
        placeholder={asking?.lines ? 'Ask about these lines' : 'Ask about this file'}
        controls={
          <ChoiceMenu
            side="top"
            groups={[{ label: 'Send to', choices }]}
            value={target}
            onChange={setPicked}
            trigger={<Pill icon={target === NEW ? <SquarePen /> : <MessagesSquare />}>{choices.find((choice) => choice.value === target)?.label}</Pill>}
          />
        }
        focusOnShow
      />
    </div>
  );

  const bar = (
    <div className="flex w-fit items-center gap-0.5 rounded-full bg-floating p-1 shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)] ring-1 ring-edge select-none">
      <BarButton onClick={() => setAsking({ lines })}>
        <MessageSquare />
        Ask
        <span className="text-faint">⌘L</span>
      </BarButton>
      <ChoiceMenu
        groups={[{ label: 'Add to', choices }]}
        value=""
        onChange={add}
        trigger={
          <BarButton>
            <Plus />
            Add to a thread
          </BarButton>
        }
      />
    </div>
  );

  return (
    <>
      {box &&
        about &&
        top !== undefined &&
        createPortal(
          <div data-ask style={{ top }} className="absolute left-12 z-10 mt-1.5 w-[min(36rem,calc(100%-4rem))] font-sans text-ui">
            {asking ? composer : bar}
          </div>,
          box,
        )}
      {asking && !asking.lines && (
        <div className="pointer-events-none absolute right-2.5 bottom-0 left-0 bg-linear-to-t from-background from-60% to-transparent px-6 pt-10 pb-4">
          <div className="pointer-events-auto mx-auto max-w-176">{composer}</div>
        </div>
      )}
      {!asking && !lines && (
        <p className="pointer-events-none absolute right-6 bottom-5 rounded-full bg-floating px-3.5 py-1.5 text-small text-muted shadow-xs ring-1 ring-edge">
          Select lines to ask about them · ⌘L asks about the whole file
        </p>
      )}
    </>
  );
}

function BarButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="flex h-7 cursor-default items-center gap-1.5 rounded-full px-3 hover:bg-shade data-popup-open:bg-shade [&_svg]:size-3.5 [&_svg]:text-muted"
      {...props}
    >
      {children}
    </button>
  );
}

/** The question as the conversation shows it, and as the agent gets it: with the file, the lines and their code. */
function askedAbout(question: string, path: string, code: string, lines?: Lines): Submission {
  const name = path.slice(path.lastIndexOf('/') + 1);

  if (!lines) return { text: `${question}\n\nAbout ${name}`, prompt: { text: `About \`${path}\`:\n\n${question}` } };

  const selected = code.split('\n').slice(lines.from - 1, lines.to).join('\n');
  const language = path.slice(path.lastIndexOf('.') + 1);

  return {
    text: `${question}\n\nAbout ${name}, ${where(lines)}`,
    prompt: { text: `About \`${path}\`, ${where(lines)}:\n\`\`\`${language}\n${selected}\n\`\`\`\n\n${question}` },
  };
}

/** `lines 10-13`, or `line 10` for one. */
function where(lines: Lines) {
  return lines.from === lines.to ? `line ${lines.from}` : `lines ${lines.from}-${lines.to}`;
}
