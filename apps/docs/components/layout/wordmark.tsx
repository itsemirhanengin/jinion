/** Jinion's `>_` mark and name, at the top of the sidebar. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-6 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="7" className="fill-fd-primary" />
        <path
          d="M8 10.5 13.5 16 8 21.5"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-fd-primary-foreground"
        />
        <path d="M16.5 22h7.5" strokeWidth="3" strokeLinecap="round" className="stroke-fd-primary-foreground" />
      </svg>
      <span className="font-semibold">jinion</span>
    </span>
  );
}
