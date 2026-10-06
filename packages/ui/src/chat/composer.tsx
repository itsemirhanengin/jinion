import { ArrowUp, ImagePlus, Mic } from 'lucide-react';
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { caretLineBottom, clipTop } from '../lib/caret.js';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';
import { type CompletionSource, useCompletion } from './completion.js';
import { CompletionList } from './completion-list.js';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** The text to send, which a picked completion may have just changed. */
  onSubmit: (value: string) => void;
  placeholder?: string;
  /** The choices under the text, such as the mode and the model. */
  controls?: ReactNode;
  /** A turn runs, so the send button stops it instead. */
  busy?: boolean;
  onStop?: () => void;
  /** Tab while a turn runs: the message waits for the turn to end. */
  onQueue?: () => void;
  /** Asked in order: the first with something to offer at the cursor shows its list. */
  completions?: CompletionSource[];
  /** Images pasted, dropped or picked, answered with the text that stands for them at the caret, such as `[Image #1]`. */
  onImages?: (files: File[]) => Promise<string>;
  /** What in the text is drawn as a pill, such as a file after `@`; the first kind that matches a piece of text wins. */
  chips?: ChipKind[];
  onDictate?: () => void;
  /** Taller, as alone in the middle of a thread that hasn't started. */
  large?: boolean;
  /** The first line inside the box, such as the running turn's todos. */
  header?: ReactNode;
  /** What goes with the message besides its text, over the text; with any, a message without text can go. */
  attachments?: ReactNode;
  /** Takes the focus once it shows, as when it moves from the middle of a new thread to the end of its conversation. */
  focusOnShow?: boolean;
}

export interface ChipKind {
  /** Without capturing groups, as they are put together into one. */
  pattern: RegExp;
  tone: 'blue' | 'violet' | 'gray';
  /** Backspace right after one takes all of it, as for an image, which a piece of its name doesn't stand for. */
  whole?: boolean;
  onClick?: (text: string) => void;
}

const NONE: CompletionSource[] = [];

const TONES: Record<ChipKind['tone'], string> = {
  blue: 'bg-(--tint-blue) text-(--tint-blue-ink) shadow-[0_0_0_2px_var(--tint-blue)]',
  violet: 'bg-(--tint-violet) text-(--tint-violet-ink) shadow-[0_0_0_2px_var(--tint-violet)]',
  gray: 'bg-(--tint-gray) text-(--tint-gray-ink) shadow-[0_0_0_2px_var(--tint-gray)]',
};

/**
 * The textarea's own text is clear, and the layer behind it draws the same text, laid out alike, with the pills tinted;
 * the textarea keeps the caret, the selection and the typing.
 */
const TEXT = 'block w-full resize-none px-4 pt-3 whitespace-pre-wrap break-words';

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  controls,
  busy,
  onStop,
  onQueue,
  completions = NONE,
  onImages,
  chips,
  onDictate,
  large,
  header,
  attachments,
  focusOnShow,
}: ComposerProps) {
  const card = useRef<HTMLFieldSetElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const behind = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const caret = useRef<number>(undefined);
  const latest = useRef(value);
  const [cursor, setCursor] = useState(value.length);
  const [dragging, setDragging] = useState(false);
  const [listTop, setListTop] = useState<number>();
  const listId = useId();

  latest.current = value;

  const { completion, selected, select, dismiss } = useCompletion(completions, value, Math.min(cursor, value.length));
  const empty = value.trim() === '' && !attachments;
  const pieces = useMemo(() => piecesOf(value, chips), [value, chips]);

  // The list goes over the composer, or under the caret's line when whatever holds the composer would cut it off.
  useLayoutEffect(() => {
    const list = completion && document.getElementById(listId);
    if (!list || !card.current || !textarea.current) return setListTop(undefined);

    const room = card.current.getBoundingClientRect().top - clipTop(card.current) - 8;

    setListTop(list.offsetHeight <= room ? undefined : textarea.current.offsetTop + caretLineBottom(textarea.current) + 4);
  }, [completion, value, cursor]);

  useLayoutEffect(() => {
    if (focusOnShow) textarea.current?.focus();
  }, []);

  // What was put in puts the caret after itself, once the text has it.
  useLayoutEffect(() => {
    if (caret.current === undefined) return;

    textarea.current?.focus();
    textarea.current?.setSelectionRange(caret.current, caret.current);
    setCursor(caret.current);
    caret.current = undefined;
  }, [value]);

  const insert = (text: string) => {
    const current = latest.current;
    const at = Math.min(textarea.current?.selectionStart ?? current.length, current.length);
    const before = at > 0 && !/\s/.test(current[at - 1]!) ? ' ' : '';
    const added = `${before}${text} `;

    caret.current = at + added.length;
    onChange(current.slice(0, at) + added + current.slice(at));
  };

  const attach = async (files: File[]) => {
    if (!onImages || files.length === 0) return;

    const text = await onImages(files);

    if (text) insert(text);
  };

  const pick = (submit: boolean) => {
    const item = completion?.items[selected];
    if (!completion || !item) return;

    const next = value.slice(0, completion.from) + item.insert + value.slice(completion.to);

    if (submit) return onSubmit(next.trim());

    caret.current = completion.from + item.insert.length;
    onChange(next);
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method composes a word picks the word, not the message.
    if (event.nativeEvent.isComposing) return;
    if (completion && completionKey(event)) return;
    if (event.key === 'Backspace' && removeChip(event)) return;

    if (event.key === 'Tab' && !event.shiftKey && busy && onQueue) {
      event.preventDefault();
      if (!empty) onQueue();

      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    if (!empty) onSubmit(value);
  };

  const completionKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const count = completion!.items.length;

    if (event.key === 'ArrowUp') select((selected - 1 + count) % count);
    else if (event.key === 'ArrowDown') select((selected + 1) % count);
    else if (event.key === 'Tab' && !event.shiftKey) pick(false);
    else if (event.key === 'Enter' && !event.shiftKey) pick(completion!.items[selected]?.submit ?? Boolean(completion!.submit));
    else if (event.key === 'Escape') dismiss();
    else return false;

    // Escape here closes the list, not the turn.
    event.preventDefault();
    event.stopPropagation();

    return true;
  };

  const removeChip = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd } = event.currentTarget;
    if (selectionStart !== selectionEnd) return false;

    const ends = pieces.map((_, index) => pieces.slice(0, index + 1).reduce((length, piece) => length + piece.text.length, 0));
    const chip = pieces.find((piece, index) => ends[index] === selectionStart && piece.kind?.whole);
    if (!chip) return false;

    // The space put in after the chip goes with it, unless it is what keeps two words apart.
    const start = selectionStart - chip.text.length;
    const end = value[selectionStart] === ' ' && (start === 0 || value[start - 1] === ' ') ? selectionStart + 1 : selectionStart;

    event.preventDefault();
    caret.current = start;
    onChange(value.slice(0, start) + value.slice(end));

    return true;
  };

  // The pills are behind the text, out of the pointer's reach, so the pointer is matched to them by where they are.
  const chipAt = (event: MouseEvent) => {
    const element = [...(behind.current?.querySelectorAll<HTMLElement>('[data-chip]') ?? [])].find((each) =>
      [...each.getClientRects()].some((rect) => event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom),
    );

    return element && pieces[Number(element.dataset.chip)];
  };

  const paste = (event: ClipboardEvent) => {
    const files = imageFiles(event.clipboardData.files);
    if (!onImages || files.length === 0) return;

    event.preventDefault();
    void attach(files);
  };

  const dragOver = (event: DragEvent) => {
    if (!onImages || !event.dataTransfer.types.includes('Files')) return;

    event.preventDefault();
    setDragging(true);
  };

  const drop = (event: DragEvent) => {
    setDragging(false);
    if (!onImages) return;

    event.preventDefault();
    void attach(imageFiles(event.dataTransfer.files));
  };

  return (
    <div className="relative">
      {completion && (
        <CompletionList id={listId} top={listTop} completion={completion} selected={selected} onSelect={select} onPick={() => pick(completion.items[selected]?.submit ?? Boolean(completion.submit))} />
      )}
      <fieldset
        ref={card}
        aria-label="Composer"
        onDragOver={dragOver}
        onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setDragging(false)}
        onDrop={drop}
        className={classNames('min-w-0 rounded-2xl bg-floating shadow-sm ring-1 transition-shadow', dragging ? 'ring-2 ring-faint' : 'ring-edge')}
      >
        {header}
        {attachments && <div className="flex flex-wrap items-center gap-1 px-3 pt-2.5">{attachments}</div>}
        <div className="relative">
          {chips && (
            <div ref={behind} aria-hidden className={classNames(TEXT, 'pointer-events-none absolute inset-0 overflow-hidden')}>
              {pieces.map((piece, index) =>
                piece.kind ? (
                  <span key={index} data-chip={index} className={classNames('rounded-[4px]', TONES[piece.kind.tone])}>
                    {piece.text}
                  </span>
                ) : (
                  piece.text
                ),
              )}
            </div>
          )}
          <textarea
            ref={textarea}
            name="message"
            aria-label="Message"
            role="combobox"
            aria-expanded={completion !== undefined}
            aria-autocomplete="list"
            aria-controls={completion && listId}
            aria-activedescendant={completion && `${listId}-${selected}`}
            value={value}
            rows={2}
            placeholder={placeholder}
            onChange={(event) => {
              setCursor(event.target.selectionStart);
              onChange(event.target.value);
            }}
            onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
            onScroll={(event) => {
              if (behind.current) behind.current.scrollTop = event.currentTarget.scrollTop;
            }}
            onKeyDown={keyDown}
            onPaste={paste}
            onMouseMove={(event) => {
              event.currentTarget.style.cursor = chipAt(event)?.kind?.onClick ? 'pointer' : '';
            }}
            onClick={(event) => {
              const chip = chipAt(event);

              chip?.kind?.onClick?.(chip.text);
            }}
            className={classNames(
              TEXT,
              'relative field-sizing-content max-h-72 bg-transparent outline-none placeholder:text-faint',
              chips && 'text-transparent caret-ink selection:bg-accent/20',
              large ? 'min-h-32' : 'min-h-16',
            )}
          />
        </div>
        <div className="flex items-center gap-1 px-2 pb-2">
          {controls}
          <span className="flex-1" />
          {onDictate && (
            <Button size="icon" aria-label="Dictate" title="Dictate" onClick={onDictate}>
              <Mic />
            </Button>
          )}
          {onImages && (
            <>
              <Button size="icon" aria-label="Attach an image" title="Attach an image" onClick={() => picker.current?.click()}>
                <ImagePlus />
              </Button>
              <input
                ref={picker}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  void attach(imageFiles(event.target.files));
                  event.target.value = '';
                }}
              />
            </>
          )}
          {busy ? (
            <button type="button" aria-label="Stop" title="Stop" onClick={onStop} className="flex size-7 cursor-default items-center justify-center rounded-full bg-primary">
              <span className="size-2.5 rounded-[2px] bg-on-primary" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              title="Send"
              disabled={empty}
              onClick={() => onSubmit(value)}
              className={classNames('flex size-7 cursor-default items-center justify-center rounded-full text-on-primary', empty ? 'bg-primary/30' : 'bg-primary')}
            >
              <ArrowUp className="size-4 shrink-0" />
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}

/** The row under the composer: the branch, where the agent works, how full the context is. */
export function ComposerFooter({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-1 pt-2 text-muted">
      {start}
      <span className="flex-1" />
      {end}
    </div>
  );
}

/** The text cut where the chips are, each piece with the kind it is a chip of. */
function piecesOf(value: string, chips: ChipKind[] | undefined): { text: string; kind?: ChipKind }[] {
  if (!chips || chips.length === 0) return [{ text: value }];

  const any = new RegExp(chips.map((chip) => `(${chip.pattern.source})`).join('|'), 'g');
  const pieces: { text: string; kind?: ChipKind }[] = [];
  let at = 0;

  for (const match of value.matchAll(any)) {
    if (match[0] === '') continue;

    pieces.push({ text: value.slice(at, match.index) });
    pieces.push({ text: match[0], kind: chips[match.slice(1).findIndex((group) => group !== undefined)] });
    at = match.index + match[0].length;
  }

  pieces.push({ text: value.slice(at) });

  return pieces;
}

const imageFiles = (files: FileList | null) => [...(files ?? [])].filter((file) => file.type.startsWith('image/'));
