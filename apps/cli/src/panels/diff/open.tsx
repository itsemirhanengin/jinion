import type { Jinion } from '../../controllers/jinion.js';
import { DiffPanel, type DiffPanelProps } from './diff-panel.js';

export const openDiff = (jinion: Jinion, props: DiffPanelProps = {}) =>
  jinion.screen.openPanel({ id: 'diff', placement: 'fullscreen', element: <DiffPanel {...props} /> });
