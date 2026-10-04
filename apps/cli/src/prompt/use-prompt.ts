import { useStore } from 'jotai';
import { useApi } from '../app/api.js';
import { useAttachments } from './attachments.js';
import { draftAtom, historyAtom } from './draft.js';

/** Sends the draft of the session the user looks at; what is sent goes to the history and leaves the prompt. */
export function usePrompt() {
  const api = useApi();
  const attachments = useAttachments();
  const store = useStore();

  const take = (value = store.get(draftAtom)) => {
    const text = value.trim();
    if (!text) return undefined;

    store.set(historyAtom, (history) => [...history, text]);
    store.set(draftAtom, '');

    return attachments.submission(text);
  };

  return {
    submit(value: string) {
      const submission = take(value);

      if (submission) api.act(api.inSession('session/submit', submission));
    },
    queue() {
      const submission = take();

      if (submission) api.act(api.inSession('session/queue', submission));
    },
    /** Kept in the history, so `up` brings it back. */
    clear() {
      take();
    },
  };
}
