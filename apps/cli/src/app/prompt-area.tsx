import { useMemo } from 'react';
import { Text, useTheme } from '@jinion/tui';
import { Composer } from '@jinion/tui/chat';
import { atom, useAtom, useAtomValue } from 'jotai';
import { MODES } from '@jinion/core/agent/modes';
import { commandCompletion } from '@jinion/core/commands/registry';
import { fileCompletion } from '@jinion/core/prompt/files';
import { skillCompletion } from '@jinion/core/prompt/skills';
import { useAttachments } from '../prompt/attachments.js';
import { draftAtom, historyAtom } from '../prompt/draft.js';
import { usePrompt } from '../prompt/use-prompt.js';
import { agentAtom, busyAtom, mentionAtom, modeAtom, sessionAtom, skillsAtom } from '../state/session.js';
import { modeColor } from '../ui/modes.js';
import { useProjectFiles } from '../ui/use-project-files.js';
import { contextWarning } from './activity.js';
import { useApi } from './api.js';

const contextLeftAtom = atom((get) => contextWarning(get(sessionAtom).usage));

export function PromptArea() {
  const { initialized } = useApi();
  const agent = useAtomValue(agentAtom);
  const attachments = useAttachments();
  const prompt = usePrompt();
  const [draft, setDraft] = useAtom(draftAtom);
  const history = useAtomValue(historyAtom);
  const busy = useAtomValue(busyAtom);
  const skills = useAtomValue(skillsAtom);
  const mention = useAtomValue(mentionAtom);
  const contextLeft = useAtomValue(contextLeftAtom);
  const files = useProjectFiles(busy);

  const { commands } = initialized;
  const footer = agent.modes.length > 1 || contextLeft !== undefined;

  const completions = useMemo(
    () => [commandCompletion(commands), skillCompletion(skills), fileCompletion(files)],
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
          : agent.features.steer
            ? 'Type to steer · ctrl+q to queue · esc to interrupt'
            : 'Type to queue · esc to interrupt'
      }
      footer={footer && <PromptFooter />}
    />
  );
}

function PromptFooter() {
  const theme = useTheme();
  const mode = useAtomValue(modeAtom);
  const left = useAtomValue(contextLeftAtom);
  const agent = useAtomValue(agentAtom);

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
