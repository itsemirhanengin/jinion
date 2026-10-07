import { Composer } from '@jinion/ui/chat';
import { useWorkbench } from '@jinion/workbench';
import { useState } from 'react';
import { useCore } from '../../state/session.js';
import { newThread } from './spare.js';

/** With no thread open, the composer alone in the middle, as a thread that hasn't started; sending opens the thread. */
export function NoThread() {
  const core = useCore();
  const workbench = useWorkbench();

  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();

    setDraft('');
    core.act(newThread(core, workbench).then((id) => core.submit(id, { text })));
  };

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-8 pb-[8vh]">
      <div className="w-full max-w-176">
        <Composer value={draft} onChange={setDraft} onSubmit={submit} placeholder="Ask for a change. / for commands" large />
      </div>
    </div>
  );
}
