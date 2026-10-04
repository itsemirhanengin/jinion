import { useMemo } from 'react';
import { Text, useTheme } from '@jinion/tui';
import { Composer } from '@jinion/tui/chat';
import { atom, useAtom, useAtomValue } from 'jotai';
import { modeAtom, busyAtom, sessionAtom } from '@jinion/core/state/active';
import { MODES } from '@jinion/core/agent/modes';
import { fileCompletion } from '@jinion/core/prompt/files';
import { useProjectFiles } from '../ui/use-project-files.js';
import { skillCompletion } from '@jinion/core/prompt/skills';
import { mentionAtom, skillsAtom } from '@jinion/core/state/agent';
import { useAttachments } from '../prompt/attachments.js';
import { draftAtom, historyAtom } from '../prompt/draft.js';
import { usePrompt } from '../prompt/use-prompt.js';
import { modeColor } from '../ui/modes.js';
import { contextWarning } from './activity.js';
import { useJinion } from './context.js';
import { useWorkdir } from '../ui/use-workdir.js';

const contextLeftAtom = atom((get) => contextWarning(get(sessionAtom).usage));

export function PromptArea() {
  const jinion = useJinion();
  const attachments = useAttachments();
  const prompt = usePrompt();
  const [draft, setDraft] = useAtom(draftAtom);
  const history = useAtomValue(historyAtom);
  const busy = useAtomValue(busyAtom);
  const skills = useAtomValue(skillsAtom);
  const mention = useAtomValue(mentionAtom);
  const contextLeft = useAtomValue(contextLeftAtom);
  const files = useProjectFiles(useWorkdir(), !busy);

  const footer = jinion.backend.modes.length > 1 || contextLeft !== undefined;

  const completions = useMemo(
    () => [jinion.commands.completion(), skillCompletion(skills), fileCompletion(files)],
    [skills, files],
  );

  return (
    <Composer
      pastes={attachments.texts}
      onPaste={(text) => attachments.pastePath(text)}
      onPasteKey={() => attachments.pasteClipboard()}
      value={draft}
      onChange={setDraft}
      onSubmit={prompt.submit}
      history={history}
      completions={completions}
      mentions={[mention]}
      placeholder={
        !busy
          ? 'Ask jinion anything · / commands · $ skills · @ files'
          : jinion.session.agent.steer
            ? 'Type to steer · ctrl+q to queue · esc to interrupt'
            : 'Type to queue · esc to interrupt'
      }
      footer={footer && <PromptFooter />}
    />
  );
}

function PromptFooter() {
  const { backend } = useJinion();
  const theme = useTheme();
  const mode = useAtomValue(modeAtom);
  const left = useAtomValue(contextLeftAtom);

  const modes = backend.modes.length > 1;

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
