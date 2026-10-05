import { ArrowUp, ImagePlus, Mic } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** The choices under the text, such as the mode and the model. */
  controls?: ReactNode;
  /** A turn runs, so the send button stops it instead. */
  busy?: boolean;
  onStop?: () => void;
  onAttach?: () => void;
  onDictate?: () => void;
  /** Taller, as alone in the middle of a thread that hasn't started. */
  large?: boolean;
}

export function Composer({ value, onChange, onSubmit, placeholder, controls, busy, onStop, onAttach, onDictate, large }: ComposerProps) {
  const empty = value.trim() === '';

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method composes a word picks the word, not the message.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (!empty) onSubmit();
  };

  return (
    <div className="rounded-2xl bg-floating shadow-sm ring-1 ring-edge">
      <textarea
        name="message"
        aria-label="Message"
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keyDown}
        className={classNames(
          'field-sizing-content block max-h-72 w-full resize-none bg-transparent px-4 pt-3 outline-none placeholder:text-faint',
          large ? 'min-h-32' : 'min-h-16',
        )}
      />
      <div className="flex items-center gap-1 px-2 pb-2">
        {onAttach && (
          <Button size="icon" aria-label="Attach an image" title="Attach an image" onClick={onAttach}>
            <ImagePlus />
          </Button>
        )}
        {controls}
        <span className="flex-1" />
        {onDictate && (
          <Button size="icon" aria-label="Dictate" title="Dictate" onClick={onDictate}>
            <Mic />
          </Button>
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
            onClick={onSubmit}
            className={classNames('flex size-7 cursor-default items-center justify-center rounded-full text-on-primary', empty ? 'bg-primary/30' : 'bg-primary')}
          >
            <ArrowUp className="size-4 shrink-0" />
          </button>
        )}
      </div>
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
