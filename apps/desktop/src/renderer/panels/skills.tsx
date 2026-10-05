import type { AgentCommand } from '@jinion/core/agent/agent';
import { List, Page } from '@jinion/ui';
import { useSetAtom } from 'jotai';
import { Plug, Shapes } from 'lucide-react';
import { draftsAtom, viewAtom } from '../state/app.js';
import { useActiveSession, useJinion } from '../state/session.js';

/** The skills and MCP prompts the agent has, each sent as a slash command; picking one starts a message with it. */
export function Skills() {
  const jinion = useJinion();
  const session = useActiveSession();
  const setDrafts = useSetAtom(draftsAtom);
  const setView = useSetAtom(viewAtom);

  const groups = Map.groupBy(jinion.skills, (skill) => skill.group);

  const use = (skill: AgentCommand) => {
    const id = session?.id ?? jinion.open();

    setDrafts((drafts) => ({ ...drafts, [id]: `/${skill.name} ` }));
    setView('thread');
  };

  return (
    <Page title="Skills" description="What the agent can do on a slash command: the project's skills, yours, and prompts from MCP servers. Pick one to start a message with it.">
      {[...groups].map(([group, skills]) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="text-small font-medium text-muted">{group}</h2>
          <List>
            {skills.map((skill) => (
              <button key={skill.name} type="button" onClick={() => use(skill)} className="flex cursor-default items-center gap-3 px-4 py-3 text-left hover:bg-hover/50">
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
