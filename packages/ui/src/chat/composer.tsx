import { ArrowUp, Mic, Plus } from 'lucide-react';
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
import { MOTION, reducedMotion } from '../lib/motion.js';
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
  /** The first line inside the box, such as the running turn's todos; with one, the composer is a box from the start. */
  header?: ReactNode;
  /** What goes with the message besides its text, before the text; with any, a message without text can go. */
  attachments?: ReactNode;
  /** Takes the focus once it shows, as when it moves from the middle of a new thread to the end of its conversation. */
  focusOnShow?: boolean;
  /** Escape in the text with no list open, such as to put the composer away. */
  onEscape?: () => void;
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
const TEXT = 'block w-full resize-none whitespace-pre-wrap break-words leading-6';

/** Where the text sits in the capsule, and in the box it grows into. */
const PADDING = { capsule: 'px-1 py-1.5', box: 'px-4 pt-3 pb-1' };

/** What the text may come short of the capsule's width by before the box goes back to one, so the two never flip back and forth. */
const SLACK = 24;

/** The least room the capsule leaves its text; narrower, as in a split, the composer is a box, its choices under the text. */
const NARROWEST = 120;

/**
 * One line in a capsule, what goes with the message and its choices beside the text; once the text takes more than the
 * line, or a header shows, a box with the text over the choices. The textarea stays the same element in both, so the
 * caret and the focus stay where they are.
 */
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
  header,
  attachments,
  focusOnShow,
  onEscape,
}: ComposerProps) {
  const holder = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLFieldSetElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const behind = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const caret = useRef<number>(undefined);
  const latest = useRef(value);
  const capsule = useRef({ text: 0, card: 0 });
  const shape = useRef<Shape>(undefined);
  const turning = useRef(false);
  const moving = useRef<Animation[]>([]);
  const [cursor, setCursor] = useState(value.length);
  const [dragging, setDragging] = useState(false);
  const [listTop, setListTop] = useState<number>();
  const [long, setLong] = useState(false);
  const [width, setWidth] = useState(0);
  const listId = useId();

  latest.current = value;

  const { completion, selected, select, dismiss } = useCompletion(completions, value, Math.min(cursor, value.length));
  const empty = value.trim() === '' && !attachments;
  const pieces = useMemo(() => piecesOf(value, chips), [value, chips]);
  const boxed = Boolean(header) || long;
  const padding = boxed ? PADDING.box : PADDING.capsule;

  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));

    if (holder.current) observer.observe(holder.current);

    return () => observer.disconnect();
  }, []);

  // The capsule turns into the box once its line wraps or it leaves the text too little room, and back once the text
  // would fit the capsule's line again; what sits beside the text keeps its width, so the capsule's room follows the card's.
  useLayoutEffect(() => {
    const box = textarea.current;
    const fieldset = card.current;
    if (!box || !fieldset) return;

    const style = getComputedStyle(box);

    if (!boxed) {
      capsule.current = { text: box.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight), card: fieldset.clientWidth };

      const line = Number.parseFloat(style.lineHeight) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);

      if ((value !== '' && box.scrollHeight > line + 1) || capsule.current.text < NARROWEST) turn(true);

      return;
    }

    const room = capsule.current.text + fieldset.clientWidth - capsule.current.card;

    if (long && room >= NARROWEST && !value.includes('\n') && widthOf(value, style.font) <= room - SLACK) turn(false);
  }, [value, boxed, width]);

  // The capsule and the box morph into each other: the card's height eases while each part slides from where it was.
  useLayoutEffect(() => {
    const fieldset = card.current;
    if (!fieldset) return;

    // About to turn, this layout is never painted, so the one painted last stays the one to move from.
    if (turning.current) {
      turning.current = false;

      return;
    }

    const before = shape.current;
    const turned = before !== undefined && before.boxed !== boxed;

    // A turn starts from where the last one was going, since halfway through, what is on screen is neither shape.
    if (turned) for (const animation of moving.current) animation.cancel();
    else if (moving.current.some((animation) => animation.playState === 'running')) return;

    shape.current = shapeOf(fieldset, boxed);
    if (turned && !reducedMotion()) moving.current = morph(fieldset, before, shape.current);
  });

  const turn = (next: boolean) => {
    turning.current = true;
    setLong(next);
  };

  // The list goes over the composer, or under the caret's line when whatever holds the composer would cut it off.
  useLayoutEffect(() => {
    const list = completion && document.getElementById(listId);
    if (!list || !card.current || !textarea.current) return setListTop(undefined);

    const room = card.current.getBoundingClientRect().top - clipTop(card.current) - 8;

    setListTop(list.offsetHeight <= room ? undefined : textarea.current.offsetTop + caretLineBottom(textarea.current) + 4);
  }, [completion, value, cursor]);

  // A draft already there is carried on from its end.
  useLayoutEffect(() => {
    if (!focusOnShow || !textarea.current) return;

    textarea.current.focus();
    textarea.current.setSelectionRange(value.length, value.length);
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
    if (event.key === 'Escape' && onEscape) return onEscape();

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

  const add = onImages && (
    <Button size="icon" data-part="add" aria-label="Attach an image" title="Attach an image" onClick={() => picker.current?.click()}>
      <Plus />
    </Button>
  );

  return (
    <div ref={holder} className="relative">
      {completion && (
        <CompletionList id={listId} top={listTop} completion={completion} selected={selected} onSelect={select} onPick={() => pick(completion.items[selected]?.submit ?? Boolean(completion.submit))} />
      )}
      <fieldset
        ref={card}
        aria-label="Composer"
        onDragOver={dragOver}
        onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setDragging(false)}
        onDrop={drop}
        className={classNames(
          'flex min-w-0 bg-floating shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)] ring-1',
          boxed ? 'flex-col rounded-3xl' : classNames('min-h-12 items-center gap-1 rounded-[26px] py-1.5 pr-1.5', onImages ? 'pl-2' : 'pl-3'),
          dragging ? 'ring-2 ring-faint' : 'ring-edge',
        )}
      >
        {header && <div data-part="header">{header}</div>}
        {!boxed && add}
        {attachments && (
          <div data-part="attachments" className={classNames('flex shrink-0 items-center gap-1', boxed && 'flex-wrap px-3 pt-2.5')}>
            {attachments}
          </div>
        )}
        <div data-part="text" className="relative min-w-0 flex-1">
          {chips && (
            <div ref={behind} aria-hidden className={classNames(TEXT, padding, 'pointer-events-none absolute inset-0 overflow-hidden')}>
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
            rows={1}
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
              padding,
              'relative field-sizing-content max-h-72 bg-transparent outline-none placeholder:text-faint',
              chips && 'text-transparent caret-ink selection:bg-accent/20',
              // The capsule keeps to one line however long the placeholder.
              !boxed && 'placeholder:truncate',
              boxed && 'min-h-16',
            )}
          />
        </div>
        <div className={classNames('flex shrink-0 items-center gap-1', boxed && 'px-2 pb-2')}>
          {boxed && add}
          {controls && (
            <div data-part="controls" className="flex min-w-0 flex-wrap items-center gap-1">
              {controls}
            </div>
          )}
          <span className="flex-1" />
          {onDictate && (
            <Button size="icon" data-part="dictate" aria-label="Dictate" title="Dictate" onClick={onDictate}>
              <Mic />
            </Button>
          )}
          {busy ? (
            <button
              type="button"
              data-part="send"
              aria-label="Stop"
              title="Stop"
              onClick={onStop}
              className="flex size-8 shrink-0 cursor-default items-center justify-center rounded-full bg-primary"
            >
              <span className="size-2.5 rounded-[2px] bg-on-primary" />
            </button>
          ) : (
            <button
              type="button"
              data-part="send"
              aria-label="Send"
              title="Send"
              disabled={empty}
              onClick={() => onSubmit(value)}
              className={classNames('flex size-8 shrink-0 cursor-default items-center justify-center rounded-full text-on-primary', empty ? 'bg-primary/30' : 'bg-primary')}
            >
              <ArrowUp className="size-4 shrink-0" />
            </button>
          )}
        </div>
        {onImages && (
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
        )}
      </fieldset>
    </div>
  );
}

/** The faint line under the composer: the branch, where the agent works, how full the context is. */
export function ComposerFooter({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-4 pt-1.5 text-small text-faint">
      {start}
      <span className="flex-1" />
      {end}
    </div>
  );
}

/** The card's height and where each of its parts starts in it, and how wide its content is, as last painted. */
interface Shape {
  boxed: boolean;
  height: number;
  parts: Map<string, { x: number; y: number; width: number }>;
}

function shapeOf(card: HTMLElement, boxed: boolean): Shape {
  const frame = card.getBoundingClientRect();
  const parts = new Map<string, { x: number; y: number; width: number }>();

  for (const part of card.querySelectorAll<HTMLElement>('[data-part]')) {
    const rect = part.getBoundingClientRect();
    // The text's padding differs between the two, so where its first letter sits, and how wide its lines run, is what moves.
    const text = part.querySelector('textarea');
    const style = text && getComputedStyle(text);
    const left = style ? Number.parseFloat(style.paddingLeft) : 0;

    parts.set(part.dataset.part!, {
      x: rect.left - frame.left + left,
      y: rect.top - frame.top + (style ? Number.parseFloat(style.paddingTop) : 0),
      width: rect.width - left,
    });
  }

  return { boxed, height: frame.height, parts };
}

/** From the last shape to this one: the height eases, the parts that were there slide over, the new ones fade in. */
function morph(card: HTMLElement, from: Shape, to: Shape) {
  const animations = [
    card.animate(
      [
        { height: `${from.height}px`, overflow: 'hidden' },
        { height: `${to.height}px`, overflow: 'hidden' },
      ],
      MOTION,
    ),
  ];

  // The capsule centres its parts in the card, so while its height eases they ride its middle, not its top.
  const middle = (shape: Shape) => (to.boxed ? 0 : shape.height / 2);

  for (const part of card.querySelectorAll<HTMLElement>('[data-part]')) {
    const start = from.parts.get(part.dataset.part!);
    const end = to.parts.get(part.dataset.part!)!;

    if (!start) {
      animations.push(part.animate([{ opacity: 0 }, { opacity: 1 }], MOTION));
      continue;
    }

    // The text's lines, once wider than before, open up from where they ended, rather than over what sat beside them.
    const cut = part.dataset.part === 'text' ? Math.max(0, end.width - start.width) : 0;
    const x = start.x - end.x;
    const y = start.y - middle(from) - (end.y - middle(to));

    if (x !== 0 || y !== 0 || cut > 0) {
      animations.push(
        part.animate(
          [
            { transform: `translate(${x}px, ${y}px)`, clipPath: `inset(0 ${cut}px 0 0)` },
            { transform: 'none', clipPath: 'inset(0)' },
          ],
          MOTION,
        ),
      );
    }
  }

  return animations;
}

let measure: CanvasRenderingContext2D | undefined;

/** How wide the text is in the font, on one line. */
function widthOf(text: string, font: string) {
  measure ??= document.createElement('canvas').getContext('2d')!;
  measure.font = font;

  return measure.measureText(text).width;
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
