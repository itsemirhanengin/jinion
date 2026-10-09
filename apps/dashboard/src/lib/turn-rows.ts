import { listFeedback, listTurns, listUsers } from '@/lib/data';
import type { TurnRow } from '@/lib/lists/turns';

/** Every turn as the turns list shows it, with the people they belong to. */
export async function turnRows() {
  const [turns, users, feedback] = await Promise.all([listTurns(), listUsers(), listFeedback()]);
  const names = new Map(users.map((user) => [user.id, user.name]));
  const withFeedback = new Set(feedback.flatMap((item) => (item.turn ? [item.turn] : [])));

  const rows: TurnRow[] = turns.map((turn) => ({ ...turn, person: names.get(turn.user) ?? turn.user, feedback: withFeedback.has(turn.id) }));

  return { rows, turns, users };
}
