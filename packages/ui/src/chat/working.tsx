import { useEffect, useState } from 'react';
import { Spinner } from '../primitives/spinner.js';

/** The line under a running turn: what it is doing and for how long. */
export function Working({ since, label = 'Working' }: { since: number; label?: string }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.floor((now - since) / 1000));
  const took = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="flex items-center gap-2 text-muted">
      <Spinner />
      <span className="shimmer">{label}</span>
      <span className="text-faint tabular-nums">{took}</span>
      <span className="text-faint">· Esc to stop</span>
    </div>
  );
}
