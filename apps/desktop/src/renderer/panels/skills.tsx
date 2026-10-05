import type { AgentCommand } from '@jinion/core/agent/agent';
import { Empty, List, Page } from '@jinion/ui';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plug, Shapes } from 'lucide-react';
import { draftsAtom, viewAtom } from '../state/app.js';
import { useActiveSession, useCore } from '../state/session.js';

/** The skills and MCP prompts the agent has, each sent as a slash command; picking one starts a message with it. */
export function Skills() {
  const core = useCore();
  const session = useActiveSession();
  const app = useAtomValue(core.appAtom);
  const setDrafts = useSetAtom(draftsAtom);
  const setView = useSetAtom(viewAtom);

  // A backend lists its skills once its first session has started, so they are the active session's backend's.
  const skills = (session && app?.skills[session.fields.agent]) ?? [];
  const groups = Map.groupBy(skills, (skill) => skill.group);

  const use = async (skill: AgentCommand) => {
    const id = session?.id ?? (await core.open());

    setDrafts((drafts) => ({ ...drafts, [id]: `/${skill.name} ` }));
    setView('thread');
  };

  return (
    <Page title="Skills" description="What the agent can do on a slash command: the project's skills, yours, and prompts from MCP servers. Pick one to start a message with it.">
      {skills.length === 0 && <Empty>The agent lists its skills once a conversation has started. Send a first message, then come back.</Empty>}
      {[...groups].map(([group, list]) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="text-small font-medium text-muted">{group}</h2>
          <List>
            {list.map((skill) => (
              <button key={skill.name} type="button" onClick={() => void use(skill)} className="flex cursor-default items-center gap-3 px-4 py-3 text-left hover:bg-hover/50">
                {skill.source === 'mcp' ? <Plug className="size-4 shrink-0 text-faint" /> : <Shapes className="size-4 shrink-0 text-faint" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono text-code">
                    /{skill.name}
                    {skill.argumentHint && <span className="text-faint"> {skill.argumentHint}</span>}
                  </span>
                  <span className="truncate text-muted">{skill.description}</span>
                </span>
                <span className="shrink-0 text-small text-faint">{skill.source === 'mcp' ? 'MCP' : 'Skill'}</span>
              </button>
            ))}
          </List>
        </section>
      ))}
    </Page>
  );
}
