import type { AgentMode } from '@jinion/core/agent/agent';
import { MODES } from '@jinion/core/agent/modes';
import type { SessionSnapshot } from '@jinion/core/api/schemas';
import { skillMention } from '@jinion/core/prompt/skills';
import { ChoiceMenu, classNames, ImageViewer, Pill } from '@jinion/ui';
import { Composer as ComposerBox, ComposerFooter } from '@jinion/ui/chat';
import { useAtom, useAtomValue, useStore } from 'jotai';
import { GitBranch, GitFork, Laptop } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { type DraftImage, draftImagesAtom, draftsAtom } from '../../state/app.js';
import { useCore } from '../../state/session.js';
import { completions } from './completions.js';
import { ContextUsage } from './context-usage.js';
import { imagePattern, imageSource, readImage, submissionOf, uniqueName } from './draft.js';

/** How much the mode lets the agent do on its own, from asking for everything to asking for nothing. */
const MODE_DOTS: Record<AgentMode, string> = { manual: 'bg-faint', plan: 'bg-accent', edits: 'bg-added', auto: 'bg-warning' };

const NO_IMAGES: DraftImage[] = [];

/** A file after `@`, as the completion puts it in, quoted when its path has a space. */
const FILE_MENTION = /(?<=^|\s)@(?:"[^"\n]+"|[^\s"]+)/;

/** What a slash command opens in the composer itself rather than elsewhere in the window. */
type Opened = 'mode' | 'model' | 'context';

/** `large` stands alone in the middle of a thread that hasn't started. */
export function Composer({ id, snapshot, large, header }: { id: string; snapshot: SessionSnapshot; large?: boolean; header?: ReactNode }) {
  const core = useCore();
  const store = useStore();
  const [drafts, setDrafts] = useAtom(draftsAtom);
  const [allImages, setAllImages] = useAtom(draftImagesAtom);
  const [asked, setAsked] = useAtom(core.viewAtom);
  const shown = useAtomValue(core.client.shownAtom);
  const app = useAtomValue(core.appAtom);
  const branch = useAtomValue(core.branchAtom);
  const files = useAtomValue(core.filesAtom);

  const [opened, setOpened] = useState<Opened>();
  const [viewing, setViewing] = useState<DraftImage>();

  const { fields, state } = snapshot;
  const draft = drafts[id] ?? '';
  const images = allImages[id] ?? NO_IMAGES;
  const modes = app?.agents.find((agent) => agent.name === fields.agent)?.modes ?? [fields.mode];
  const models = app?.models ?? {};
  const model = models[fields.agent]?.find((option) => option.id === fields.selection.model);
  const skills = app?.skills[fields.agent];
  const { contextTokens, contextWindow } = state.usage;
  const full = contextWindow > 0 ? Math.round((contextTokens / contextWindow) * 100) : 0;
  const sources = useMemo(() => completions(core.commands, skills ?? [], files), [core, skills, files]);

  // A turn may have added files, so `@` lists them once it ends.
  useEffect(() => {
    if (fields.working) return;

    void core.refreshBranch(id);
    core.act(core.refreshFiles(id));
  }, [id, fields.working]);

  useEffect(() => {
    const view = asked?.view.id;
    if (shown !== id || (view !== 'mode' && view !== 'model' && view !== 'context')) return;

    setAsked(undefined);
    setOpened(view);
  }, [asked, shown, id]);

  const setDraft = (text: string) => setDrafts((all) => ({ ...all, [id]: text }));
  const setImages = (change: (images: DraftImage[]) => DraftImage[]) => setAllImages((all) => ({ ...all, [id]: change(all[id] ?? []) }));
  const opener = (menu: Opened) => (open: boolean) => setOpened(open ? menu : undefined);

  const take = (text: string) => {
    const submission = submissionOf(text, images);

    setDraft('');
    setImages(() => []);

    return submission;
  };

  const attach = async (picked: File[]) => {
    const names: string[] = [];

    for (const file of picked) {
      try {
        const image = await readImage(file);
        const name = uniqueName(file.name || 'image.png', (store.get(draftImagesAtom)[id] ?? []).map((each) => each.name));

        setImages((all) => [...all, { name, ...image }]);
        names.push(name);
      } catch (error) {
        core.act(core.notice(id, (error as Error).message, 'warning'));
      }
    }

    return names.join(' ');
  };

  const chips = useMemo(() => {
    const pattern = imagePattern(images);
    const skill = skillMention(skills ?? []);

    return [
      ...(pattern ? [{ pattern, tone: 'gray' as const, whole: true, onClick: (name: string) => setViewing(images.find((image) => image.name === name)) }] : []),
      { pattern: FILE_MENTION, tone: 'blue' as const },
      ...(skill ? [{ pattern: skill, tone: 'violet' as const }] : []),
    ];
  }, [images, skills]);

  return (
    <>
      <ImageViewer image={viewing && { src: imageSource(viewing), name: viewing.name }} onClose={() => setViewing(undefined)} />
      <ComposerBox
        value={draft}
        onChange={setDraft}
        onSubmit={(text) => core.act(core.submit(id, take(text)))}
        onQueue={() => core.act(core.queue(id, take(draft)))}
        completions={sources}
        onImages={attach}
        chips={chips}
        placeholder={fields.working ? 'Tell the agent something while it works. Tab to send it after the turn' : 'Ask for a change. / for commands, @ for files'}
        busy={fields.working}
        large={large}
        header={header}
        focusOnShow
        onStop={() => core.act(core.interrupt(id))}
        controls={
          <>
            <ChoiceMenu
              side="top"
              open={opened === 'mode'}
              onOpenChange={opener('mode')}
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
              open={opened === 'model'}
              onOpenChange={opener('model')}
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
        end={(full > 0 || opened === 'context') && <ContextUsage id={id} full={full} open={opened === 'context'} onOpenChange={opener('context')} />}
      />
    </>
  );
}
