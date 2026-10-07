import { devScripts } from '../../preview/scripts.js';
import { liveServers } from '../../preview/servers.js';
import type { Methods } from '../connection.js';

/** What a preview of the project's page opens: the servers running in its terminals, and the scripts that start one. */
export const previewMethods: Methods = (connection) => {
  connection.answer('preview/servers', () => liveServers(connection.app.terminals.list()));
  connection.answer('preview/scripts', ({ session }) => devScripts(session ? connection.find(session).folder : connection.app.info.cwd));
};
