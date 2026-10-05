/** How long ago, as short as the sidebar wants it: `25s`, `3m`, `2h`, `4d`, `1mo`. */
export function ago(time: number, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - time) / 1000));

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 30 * 86_400) return `${Math.floor(seconds / 86_400)}d`;

  return `${Math.floor(seconds / (30 * 86_400))}mo`;
}

/** How long something took: `4s`, `1m 12s`. */
export function took(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));

  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
