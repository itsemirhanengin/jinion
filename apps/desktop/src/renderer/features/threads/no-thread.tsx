import { Composer } from '@jinion/ui/chat';
import { useWorkbench } from '@jinion/workbench';
import { useState } from 'react';
import { useCore } from '../../state/session.js';
import { ProjectStatus } from './project-status.js';
import { newThread } from './spare.js';

/** With no thread open, where the project stands and the composer at the foot, as a thread that hasn't started; sending opens the thread. */
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
    <ProjectStatus>
      <Composer value={draft} onChange={setDraft} onSubmit={submit} placeholder="Ask for a change. / for commands" />
    </ProjectStatus>
  );
}
