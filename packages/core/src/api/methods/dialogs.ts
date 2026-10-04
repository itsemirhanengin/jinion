import type { Methods } from '../connection.js';
import { ApiCode } from '../protocol.js';
import { RpcError } from '../rpc.js';

/** Answers to what a session asks the user. */
export const dialogMethods: Methods = (connection) => {
  connection.answer('dialog/answer', ({ session, dialog, answer }) => {
    const target = connection.find(session);
    if (connection.app.store.get(target.atoms.dialog)?.id !== dialog) throw new RpcError(ApiCode.dialogGone, 'That dialog is no longer open.');

    target.dialogs.answer(answer);
  });

  connection.answer('dialog/cancel', ({ session }) => connection.find(session).dialogs.cancel());
};
