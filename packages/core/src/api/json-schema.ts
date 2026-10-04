import { z } from 'zod';
import * as accounts from '../agent/accounts.js';
import * as agent from '../agent/agent.js';
import * as events from '../agent/events.js';
import * as mcp from '../agent/mcp.js';
import * as models from '../agent/models.js';
import * as permissions from '../agent/permissions.js';
import * as questions from '../agent/questions.js';
import * as tasks from '../agent/tasks.js';
import * as todos from '../agent/todos.js';
import * as tools from '../agent/tools.js';
import * as usage from '../agent/usage.js';
import * as commands from '../commands/registry.js';
import * as context from '../controllers/context.js';
import * as dialogs from '../conversation/dialogs.js';
import * as entries from '../conversation/entries.js';
import * as reducer from '../conversation/reducer.js';
import * as session from '../conversation/session.js';
import * as git from '../git/types.js';
import * as memory from '../memory/types.js';
import * as submission from '../prompt/submission.js';
import { notificationsToClient, notificationsToServer, PROTOCOL_VERSION, requests } from './protocol.js';
import * as schemas from './schemas.js';

const MODULES = [
  accounts,
  agent,
  events,
  mcp,
  models,
  permissions,
  questions,
  tasks,
  todos,
  tools,
  usage,
  commands,
  context,
  dialogs,
  entries,
  reducer,
  session,
  git,
  memory,
  submission,
  schemas,
];

/**
 * The whole API as one JSON Schema, for clients in other languages: each method's params and result, and each
 * notification's params. Every schema the core exports is a definition under its own name. Objects allow fields they
 * don't name, since a newer server may send some.
 */
export function apiJsonSchema() {
  const names = z.registry<{ id: string }>();

  for (const module of MODULES) {
    for (const [name, value] of Object.entries(module)) if (value instanceof z.ZodType) names.add(value, { id: name });
  }

  const document = z.object({
    requests: z.object(
      Object.fromEntries(Object.entries(requests).map(([method, { params, result }]) => [method, z.object({ params, result })])),
    ),
    notificationsToClient: z.object(notificationsToClient),
    notificationsToServer: z.object(notificationsToServer),
  });

  return {
    title: 'Jinion API',
    description: `JSON-RPC 2.0. Protocol version ${PROTOCOL_VERSION}: what a client sends in initialize, and what the server answers with.`,
    ...z.toJSONSchema(document, { metadata: names, io: 'input', target: 'draft-2020-12' }),
  };
}
