import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where Jinion keeps its data: `$JINION_HOME`, or `~/.jinion`. */
export const jinionHome = () => process.env.JINION_HOME ?? join(homedir(), '.jinion');

/** Data that belongs to one project, such as its conversations and permission rules. */
export const projectDir = (cwd: string) => join(jinionHome(), 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
