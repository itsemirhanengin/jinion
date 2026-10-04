import { useMemo } from 'react';
import { Text, useTheme } from '@jinion/tui';
import { Composer } from '@jinion/tui/chat';
import { atom, useAtom, useAtomValue } from 'jotai';
import { MODES } from '@jinion/core/agent/modes';
import { fileCompletion } from '@jinion/core/prompt/files';
import { useProjectFiles } from '../ui/use-project-files.js';
import { skillCompletion } from '@jinion/core/prompt/skills';
import { mentionAtom, modeAtom, skillsAtom } from '@jinion/core/state/agent';
import { draftAtom, historyAtom } from '@jinion/core/state/prompt';
import { busyAtom, sessionAtom } from '@jinion/core/state/session';
import { modeColor } from '../ui/modes.js';
import { contextWarning } from './activity.js';
import { useJinion } from './context.js';
import { useWorkdir } from '../ui/use-workdir.js';

const contextLeftAtom = atom((get) => contextWarning(get(sessionAtom).usage));

export function PromptArea() {
  const jinion = useJinion();
  const [draft, setDraft] = useAtom(draftAtom);
  const history = useAtomValue(historyAtom);
  const busy = useAtomValue(busyAtom);
  const skills = useAtomValue(skillsAtom);
  const mention = useAtomValue(mentionAtom);
  const contextLeft = useAtomValue(contextLeftAtom);
  const files = useProjectFiles(useWorkdir(), !busy);

  const footer = jinion.agent.modes.length > 1 || contextLeft !== undefined;

  const completions = useMemo(
    () => [jinion.commands.completion(), skillCompletion(skills), fileCompletion(files)],
    [skills, files],
  );

  return (
    <Composer
      pastes={jinion.attachments.texts}
      onPaste={(text) => jinion.attachments.pastePath(text)}
      onPasteKey={() => jinion.attachments.pasteClipboard()}
      value={draft}
      onChange={setDraft}
      onSubmit={(value) => jinion.input.submit(value)}
      history={history}
      completions={completions}
      mentions={[mention]}
      placeholder={
        !busy
          ? 'Ask jinion anything · / commands · $ skills · @ files'
          : jinion.agent.steer
            ? 'Type to steer · ctrl+q to queue · esc to interrupt'
            : 'Type to queue · esc to interrupt'
      }
      footer={footer && <PromptFooter />}
    />
  );
}

function PromptFooter() {
  const { agent } = useJinion();
  const theme = useTheme();
  const mode = useAtomValue(modeAtom);
  const left = useAtomValue(contextLeftAtom);

  const modes = agent.modes.length > 1;

  return (
    <Text>
      {modes && (
        <>
          <Text color={modeColor(theme, mode)}>{MODES[mode].name}</Text>
          <Text color={theme.muted}> · shift+tab</Text>
        </>
      )}
      {left !== undefined && (
        <Text color={left < 0.1 ? theme.error : theme.warning}>
          {modes && <Text color={theme.muted}> · </Text>}
          {`${Math.max(0, Math.round(left * 100))}% context left until auto-compact · /compact`}
        </Text>
      )}
    </Text>
  );
}
