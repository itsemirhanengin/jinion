import type { Methods } from '../connection.js';
import { ApiCode } from '../protocol.js';
import { RpcError } from '../rpc.js';

/** The sessions open in the app, and following one. */
export const sessionsMethods: Methods = (connection) => {
  const { app } = connection;

  const saved = (id: string | undefined) => {
    if (id === undefined) return undefined;

    const found = app.saved.list().find((session) => session.id === id);
    if (!found) throw new RpcError(ApiCode.unknownSession, `There is no saved conversation ${id}.`);

    return found;
  };

  connection.answer('sessions/open', ({ resume, worktree, activate }) => {
    const session = app.openSession(saved(resume), { worktree });

    if (activate) app.activate(session);

    return { session: session.id };
  });

  // `/clear` and `/resume` replace the session the user looks at, so it becomes that one first.
  connection.answer('sessions/replace', async ({ session, resume }) => {
    const target = connection.find(session);
    const conversation = saved(resume);

    if (app.session !== target) app.activate(target);
    await (conversation ? app.resume(conversation) : app.newSession());
  });

  connection.answer('sessions/activate', ({ session }) => app.activate(connection.find(session)));
  connection.answer('sessions/close', async ({ session }) => ({ closed: await app.close(connection.find(session)) }));
  connection.answer('session/subscribe', ({ session }) => connection.follow(connection.find(session)));
  connection.answer('session/unsubscribe', ({ session }) => connection.unfollow(session));
};
