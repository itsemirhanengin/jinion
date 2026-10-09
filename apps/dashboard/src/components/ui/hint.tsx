"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Text with an explanation on hover. A dotted underline means "hover for more", so every dotted label is one
 * of these; text without a hint stays plain.
 */
export function Hint({ text, className = "", children }: { text?: React.ReactNode; className?: string; children: React.ReactNode }) {
  if (!text) return <span className={className}>{children}</span>;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={`cursor-help underline decoration-neutral-400 decoration-dotted underline-offset-4 ${className}`}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
