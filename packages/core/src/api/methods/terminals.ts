import type { Methods } from '../connection.js';
import { ApiCode } from '../protocol.js';
import { RpcError } from '../rpc.js';

/** The project's terminals: opening one, typing in it, and following its output. */
export const terminalMethods: Methods = (connection) => {
  const { terminals } = connection.app;

  const known = (id: string) => {
    if (!terminals.has(id)) throw new RpcError(ApiCode.unknownTerminal, `There is no terminal ${id}.`);

    return id;
  };

  connection.answer('terminals/list', () => terminals.list());

  connection.answer('terminals/open', ({ session, cols, rows }) =>
    terminals.open({ cwd: session ? connection.find(session).folder : connection.app.info.cwd, cols, rows }),
  );

  // Attached before the screen is read, so no output falls between the two; the client skips what the screen has.
  connection.answer('terminals/attach', ({ terminal }) => {
    connection.terminals.add(known(terminal));

    return terminals.screen(terminal);
  });

  connection.answer('terminals/detach', ({ terminal }) => {
    connection.terminals.delete(terminal);
  });

  connection.answer('terminals/write', ({ terminal, data }) => terminals.write(known(terminal), data));
  connection.answer('terminals/resize', ({ terminal, cols, rows }) => terminals.resize(known(terminal), cols, rows));
  connection.answer('terminals/close', ({ terminal }) => terminals.close(known(terminal)));
};
