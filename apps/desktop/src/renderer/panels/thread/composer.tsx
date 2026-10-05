import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { ChoiceMenu, Pill } from '@jinion/ui';
import { Composer as ComposerBox, ComposerFooter } from '@jinion/ui/chat';
import { useAtom } from 'jotai';
import { Eye, GitBranch, GitFork, Hand, Laptop, PencilLine, Sparkles } from 'lucide-react';
import { draftsAtom } from '../../state/app.js';
import { useJinion } from '../../state/session.js';

const MODE_ICONS: Record<AgentMode, typeof Hand> = { manual: Hand, edits: PencilLine, plan: Eye, auto: Sparkles };

const ORDER: AgentMode[] = ['manual', 'edits', 'plan', 'auto'];

export function Composer({ id, snapshot }: { id: string; snapshot: SessionSnapshot }) {
  const jinion = useJinion();
  const [drafts, setDrafts] = useAtom(draftsAtom);

  const { fields, state } = snapshot;
  const draft = drafts[id] ?? '';
  const ModeIcon = MODE_ICONS[fields.mode];
  const model = jinion.models[fields.agent]?.find((option) => option.id === fields.selection.model);
  const { contextTokens, contextWindow } = state.usage;
  const full = Math.round((contextTokens / contextWindow) * 100);

  const setDraft = (text: string) => setDrafts((all) => ({ ...all, [id]: text }));

  const submit = () => {
    jinion.submit(id, draft.trim());
    setDraft('');
  };

  return (
    <>
      <ComposerBox
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        placeholder={fields.working ? 'Queue a message for when this turn ends' : 'Ask, plan or build. @ for files, / for commands'}
        busy={fields.working}
        onStop={() => jinion.interrupt(id)}
        onAttach={() => {}}
        controls={
          <>
            <ChoiceMenu
              side="top"
              value={fields.mode}
              onChange={(mode) => jinion.setMode(id, mode as AgentMode)}
              groups={[{ choices: ORDER.map((mode) => ({ value: mode, label: MODES[mode].name, description: MODES[mode].description })) }]}
              trigger={
                <Pill tone="soft" icon={<ModeIcon />}>
                  {MODES[fields.mode].name}
                </Pill>
              }
            />
            <ChoiceMenu
              side="top"
              value={`${fields.agent}/${fields.selection.model}`}
              onChange={(value) => {
                const [agent, model] = value.split('/') as [string, string];

                jinion.setModel(id, { model }, agent);
              }}
              groups={Object.entries(jinion.models).map(([agent, options]) => ({
                label: agent,
                choices: options.map((option) => ({ value: `${agent}/${option.id}`, label: option.name, description: option.description })),
              }))}
              trigger={<Pill>{model?.name ?? fields.selection.model}</Pill>}
            />
          </>
        }
      />
      <ComposerFooter
        start={
          <ChoiceMenu
            side="top"
            value={fields.wantsWorktree ? 'worktree' : 'local'}
            onChange={(where) => jinion.setWorktree(id, where === 'worktree')}
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
        }
        end={
          <>
            {full > 0 && <span className="px-2 text-small text-faint tabular-nums">{full}% context</span>}
            <Pill icon={<GitBranch />} chevron={false}>
              {jinion.project.branch}
            </Pill>
          </>
        }
      />
    </>
  );
}
