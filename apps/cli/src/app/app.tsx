import { useEffect, useState } from 'react';
import { ScrollView } from '@jinion/tui';
import { Shell } from '@jinion/tui/chat';
import { Provider, useAtomValue } from 'jotai';
import { sessionAtom } from '@jinion/core/state/active';
import { builtinCommands } from '@jinion/core/commands/builtin';
import { CommandRegistry } from '@jinion/core/commands/registry';
import { Jinion, type JinionOptions } from '@jinion/core/controllers/jinion';
import { inRunningTurn } from '@jinion/core/conversation/session';
import { EntryView } from '../ui/entries/entry-view.js';
import { Aside } from './aside.js';
import { JinionContext } from './context.js';
import { useDialogs } from './dialogs.js';
import { useKeys } from './keys.js';
import { PromptArea } from './prompt-area.js';
import { StatusLine } from './status-line.js';
import { useScreen } from './use-screen.js';

export type AppProps = Omit<JinionOptions, 'commands'>;

export function App(props: AppProps) {
  const screen = useScreen();
  const [jinion] = useState(() => new Jinion({ ...props, commands: new CommandRegistry(builtinCommands) }, screen));

  useEffect(() => jinion.start(), [jinion]);

  return (
    <Provider store={jinion.store}>
      <JinionContext.Provider value={jinion}>
        <Layout />
      </JinionContext.Provider>
    </Provider>
  );
}

function Layout() {
  useKeys();
  useDialogs();

  return <Shell content={<Conversation />} aside={<Aside />} prompt={<PromptArea />} status={<StatusLine />} />;
}

function Conversation() {
  const session = useAtomValue(sessionAtom);

  return (
    <ScrollView key={session.id}>
      {session.entries.map((entry, index) => (
        <EntryView key={entry.id} entry={entry} live={inRunningTurn(session, index)} />
      ))}
    </ScrollView>
  );
}
