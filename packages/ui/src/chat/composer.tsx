import { ArrowUp, ImagePlus, Mic, Square } from 'lucide-react';
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
}

export function Composer({ value, onChange, onSubmit, placeholder, controls, busy, onStop, onAttach, onDictate }: ComposerProps) {
  const empty = value.trim() === '';

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method composes a word picks the word, not the message.
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (!empty) onSubmit();
  };

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-raised shadow-[0_1px_2px_rgb(0_0_0/0.04)] focus-within:border-ink/20">
      <textarea
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keyDown}
        className="field-sizing-content max-h-72 min-h-14 resize-none bg-transparent px-4 pt-3.5 outline-none placeholder:text-faint"
      />
      <div className="flex items-center gap-1 px-3 pt-1 pb-2.5">
        {controls}
        <span className="flex-1" />
        {onDictate && (
          <Button size="icon" aria-label="Dictate" onClick={onDictate} className="[&_svg]:size-4">
            <Mic />
          </Button>
        )}
        {onAttach && (
          <Button size="icon" aria-label="Attach an image" onClick={onAttach} className="[&_svg]:size-4">
            <ImagePlus />
          </Button>
        )}
        {busy ? (
          <Button size="icon" variant="primary" aria-label="Stop" onClick={onStop} className="[&_svg]:size-3 [&_svg]:fill-current">
            <Square />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="primary"
            aria-label="Send"
            disabled={empty}
            onClick={onSubmit}
            className={classNames('[&_svg]:size-4', empty && 'bg-faint')}
          >
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  );
}

/** The row under the composer: where the agent works, what it may do, the branch. */
export function ComposerFooter({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-1 pt-1.5">
      {start}
      <span className="flex-1" />
      {end}
    </div>
  );
}
