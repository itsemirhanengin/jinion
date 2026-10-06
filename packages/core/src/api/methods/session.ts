import { readTail } from '../../lib/tail.js';
import type { Methods } from '../connection.js';
import { supported } from './supported.js';

/** A dev server can write a lot. */
const TASK_OUTPUT_BYTES = 256 * 1024;

/** What the user does in one session. */
export const sessionMethods: Methods = (connection) => {
  const { app } = connection;

  // A command acts on the session the user looks at, and one types into the session they look at.
  const typedIn = (id: string) => {
    const session = connection.find(id);

    if (app.session !== session) app.activate(session);

    return session;
  };

  connection.answer('session/submit', ({ session, ...submission }) => typedIn(session).input.submit(submission));
  connection.answer('session/queue', ({ session, ...submission }) => typedIn(session).input.queue(submission));
  connection.answer('session/unqueue', ({ session, text }) => connection.find(session).turns.unqueue(text));
  connection.answer('session/interrupt', ({ session }) => connection.find(session).turns.interrupt());
  connection.answer('session/notice', ({ session, text, tone }) => connection.find(session).notice(text, tone));
  connection.answer('session/model', ({ session, selection, agent }) => connection.find(session).models.select(selection, agent));
  connection.answer('session/mode', ({ session, mode }) => connection.find(session).modes.select(mode));
  connection.answer('session/worktree', ({ session, on }) => connection.find(session).worktrees.set(on));
  connection.answer('session/stop-task', ({ session, task }) => connection.find(session).tasks.stop(task));
  connection.answer('session/background', ({ session }) => connection.find(session).tasks.sendToBackground());

  connection.answer('session/task-output', ({ session, task }) => {
    const { atoms } = connection.find(session);
    const output = app.store.get(atoms.tasks).find((candidate) => candidate.id === task)?.output;

    return output === undefined ? null : readTail(output, TASK_OUTPUT_BYTES);
  });

  connection.answer('session/context', ({ session }) => {
    const { agent, backend } = connection.find(session);

    return supported(agent.context?.bind(agent), backend.name, 'say what fills its context')();
  });

  connection.answer('session/open-rewind', ({ session }) => connection.find(session).conversation.openRewind());

  connection.answer('session/rewind-preview', async ({ session, prompt }) => {
    const { agent } = connection.find(session);

    return (await agent.rewindPreview?.(prompt)) ?? null;
  });

  connection.answer('session/rewind', ({ session, point, scope }) => connection.find(session).conversation.rewindTo(point, scope));
};
