import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { ChoiceMenu, classNames, Pill } from '@jinion/ui';
import { Composer as ComposerBox, ComposerFooter } from '@jinion/ui/chat';
import { useAtom, useAtomValue } from 'jotai';
import { GitBranch, GitFork, Laptop } from 'lucide-react';
import { useEffect } from 'react';
import { draftsAtom } from '../../state/app.js';
import { useCore } from '../../state/session.js';

/** How much the mode lets the agent do on its own, from asking for everything to asking for nothing. */
const MODE_DOTS: Record<AgentMode, string> = { manual: 'bg-faint', plan: 'bg-accent', edits: 'bg-added', auto: 'bg-warning' };

/** `large` stands alone in the middle of a thread that hasn't started. */
export function Composer({ id, snapshot, large }: { id: string; snapshot: SessionSnapshot; large?: boolean }) {
  const core = useCore();
  const [drafts, setDrafts] = useAtom(draftsAtom);
  const app = useAtomValue(core.appAtom);
  const branch = useAtomValue(core.branchAtom);

  const { fields, state } = snapshot;

  useEffect(() => {
    if (!fields.working) void core.refreshBranch(id);
  }, [id, fields.working]);

  const draft = drafts[id] ?? '';
  const modes = app?.agents.find((agent) => agent.name === fields.agent)?.modes ?? [fields.mode];
  const models = app?.models ?? {};
  const model = models[fields.agent]?.find((option) => option.id === fields.selection.model);
  const { contextTokens, contextWindow } = state.usage;
  const full = contextWindow > 0 ? Math.round((contextTokens / contextWindow) * 100) : 0;

  const setDraft = (text: string) => setDrafts((all) => ({ ...all, [id]: text }));

  const submit = () => {
    core.act(core.submit(id, draft.trim()));
    setDraft('');
  };

  return (
    <>
      <ComposerBox
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        placeholder={fields.working ? 'Tell the agent something while it works' : 'Ask for a change. / for commands'}
        busy={fields.working}
        large={large}
        onStop={() => core.act(core.interrupt(id))}
        controls={
          <>
            <ChoiceMenu
              side="top"
              value={fields.mode}
              onChange={(mode) => core.act(core.setMode(id, mode as AgentMode))}
              groups={[{ choices: modes.map((mode) => ({ value: mode, label: MODES[mode].name, description: MODES[mode].description, hint: mode === fields.mode ? undefined : '⇧Tab' })) }]}
              trigger={
                <Pill>
                  <span className={classNames('size-1.5 shrink-0 rounded-full', MODE_DOTS[fields.mode])} />
                  {MODES[fields.mode].name}
                </Pill>
              }
            />
            <ChoiceMenu
              side="top"
              value={`${fields.agent}/${fields.selection.model}`}
              onChange={(value) => {
                const [agent, chosen] = value.split('/') as [string, string];

                core.act(core.setModel(id, { model: chosen }, agent));
              }}
              groups={Object.entries(models).map(([agent, options]) => ({
                label: agent,
                choices: options.map((option) => ({ value: `${agent}/${option.id}`, label: option.name, description: option.description })),
              }))}
              trigger={
                <Pill>
                  {model?.name ?? fields.selection.model}
                  {fields.selection.effort && <span className="text-faint capitalize">{fields.selection.effort}</span>}
                </Pill>
              }
            />
          </>
        }
      />
      <ComposerFooter
        start={
          <>
            {branch && (
              <Pill icon={<GitBranch />} chevron={false}>
                {branch}
              </Pill>
            )}
            <ChoiceMenu
              side="top"
              value={fields.wantsWorktree ? 'worktree' : 'local'}
              onChange={(where) => core.act(core.setWorktree(id, where === 'worktree'))}
              groups={[
                {
                  choices: [
                    { value: 'local', label: 'Local', description: 'Works in the project folder' },
                    { value: 'worktree', label: 'Worktree', description: 'Works on a branch of its own, in a copy under ~/.jinion' },
                  ],
                },
              ]}
              trigger={<Pill icon={fields.wantsWorktree ? <GitFork /> : <Laptop />}>{fields.wantsWorktree ? 'Worktree' : 'Local'}</Pill>}
            />
          </>
        }
        end={full > 0 && <span className="px-2 text-faint tabular-nums">{full}% of context</span>}
      />
    </>
  );
}
