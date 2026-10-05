export interface Dated {
  id: string;
  /** When it last changed, newest first. */
  at: number;
}

/**
 * The threads' order with the ones known kept where they are, so a row never moves when it is opened, starts working
 * or closes; one not seen before goes in by its time, before the first known one older than it.
 */
export function keepOrder(known: string[], threads: Dated[]): string[] {
  const order = [...known];
  const times = new Map(threads.map((thread) => [thread.id, thread.at]));

  for (const thread of [...threads].sort((a, b) => b.at - a.at)) {
    if (order.includes(thread.id)) continue;

    const before = order.findIndex((id) => (times.get(id) ?? Number.NEGATIVE_INFINITY) < thread.at);

    order.splice(before < 0 ? order.length : before, 0, thread.id);
  }

  return order;
}
