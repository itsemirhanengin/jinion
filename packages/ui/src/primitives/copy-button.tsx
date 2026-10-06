import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { classNames } from '../lib/class-names.js';

/** Copies `text`, and says so with a check for a moment. */
export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => setCopied(false), 1200);

    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => void navigator.clipboard.writeText(text).then(() => setCopied(true));

  return (
    <button
      type="button"
      aria-label={label}
      title={copied ? 'Copied' : label}
      onClick={copy}
      className={classNames('flex size-6 cursor-default items-center justify-center rounded-md text-faint hover:bg-shade hover:text-ink [&_svg]:size-3.5', className)}
    >
      {copied ? <Check className="text-added" /> : <Copy />}
    </button>
  );
}
