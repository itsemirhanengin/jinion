import { Button } from '@jinion/ui';
import { useAtom, useStore } from 'jotai';
import { counted } from '../../lib/numbers.js';
import { draftCommentsAtom } from '../../state/comments.js';
import { useCore, useSession } from '../../state/session.js';
import { withComments } from './comments.js';
import { rememberQueued } from './queued.js';

/** The thread's comments in a diff tab's header, sent from there as a message of their own, after the turn if one runs. */
export function CommentsBar({ session }: { session: string }) {
  const core = useCore();
  const snapshot = useSession(core, session);
  const store = useStore();
  const [all, setAll] = useAtom(draftCommentsAtom);

  const comments = all[session] ?? [];

  if (comments.length === 0 || !snapshot) return null;

  const send = () => {
    const submission = withComments({ text: '' }, comments);

    setAll((drafts) => ({ ...drafts, [session]: [] }));
    if (!snapshot.fields.working) return core.act(core.submit(session, submission));

    rememberQueued(store, session, snapshot.fields.queue, { text: submission.text, typed: '', comments });
    core.act(core.queue(session, submission));
  };

  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-(--tint-blue-ink)">{counted(comments.length, 'comment')}</span>
      <Button size="small" variant="primary" onClick={send} title={snapshot.fields.working ? 'Sent once the turn ends' : 'Send them to the agent'}>
        Send
      </Button>
    </span>
  );
}
