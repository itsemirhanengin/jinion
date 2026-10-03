import { notificationsAtom } from '../state/preferences.js';
import type { Command } from './registry.js';

export const notifications: Command = {
  name: 'notifications',
  description: 'Turn on or off notifications when jinion waits for you or ends a long turn in another window',
  argumentHint: '[on | off]',
  run: (jinion, args) => {
    const wanted = args.trim().toLowerCase();
    if (wanted && wanted !== 'on' && wanted !== 'off') return jinion.notice('Type /notifications on or /notifications off.', 'error');

    const on = wanted ? wanted === 'on' : !jinion.store.get(notificationsAtom);

    jinion.store.set(notificationsAtom, on);
    if (!on) return jinion.notice('Notifications are off. /notifications on turns them back on.', 'muted');

    const how =
      jinion.screen.notificationMethod === 'bell'
        ? 'the terminal bell rings, since this terminal has no desktop notifications jinion knows of'
        : 'your terminal shows a desktop notification';

    jinion.notice(
      `Notifications are on: when jinion waits for you, or ends a turn of 15s or more, while this window isn't focused, ${how}.`,
      'success',
    );
  },
};
