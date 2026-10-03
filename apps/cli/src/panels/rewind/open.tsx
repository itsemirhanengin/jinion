import type { Jinion } from '../../controllers/jinion.js';
import { workingAtom } from '../../state/turn.js';
import { BUSY } from '../../controllers/context.js';
import { RewindPanel } from './rewind-panel.js';

export function openRewind(jinion: Jinion) {
  const { agent, conversation } = jinion;
  if (!agent.rewind) return jinion.notice(`${agent.name} can't rewind.`, 'warning');
  if (jinion.store.get(workingAtom)) return jinion.notice(BUSY, 'warning');

  const points = conversation.rewindPoints();
  if (points.length === 0) return jinion.notice('There is nothing to rewind yet.', 'muted');

  jinion.screen.openPanel({
    id: 'rewind',
    placement: 'bottom',
    element: (
      <RewindPanel
        points={points}
        preview={(point) => agent.rewindPreview?.(point.promptId) ?? Promise.resolve(undefined)}
        onRewind={(point, scope) => void conversation.rewindTo(point, scope)}
      />
    ),
  });
}
