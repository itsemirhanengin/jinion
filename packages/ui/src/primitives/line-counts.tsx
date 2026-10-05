/** `+24 -3`, the lines a change added and removed; a side with none is left out. */
export function LineCounts({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="inline-flex shrink-0 gap-1 tabular-nums">
      {added > 0 && <span className="text-added">+{added}</span>}
      {removed > 0 && <span className="text-removed">-{removed}</span>}
    </span>
  );
}
