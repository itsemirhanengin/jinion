import { useEffect, useState } from 'react';
import { ScrollView, useApp, useTerminal } from '@jinion/tui';
import { Shell } from '@jinion/tui/chat';
import { Provider, useAtomValue } from 'jotai';
import { JinionClient } from '@jinion/core/api/client';
import type { Transport } from '@jinion/core/api/transport';
import { inRunningTurn } from '@jinion/core/conversation/session';
import { Attachments, AttachmentsContext } from '../prompt/attachments.js';
import { clientAtom, sessionAtom } from '../state/session.js';
import { EntryView } from '../ui/entries/entry-view.js';
import { type Api, ApiContext, createApi } from './api.js';
import { Aside } from './aside.js';
import { useDialogs } from './dialogs.js';
import { useKeys } from './keys.js';
import { PromptArea } from './prompt-area.js';
import { useSidebar } from './sidebar.js';
import { StatusLine } from './status-line.js';
import { useScreen } from './use-screen.js';

export interface AppProps {
  /** A transport to the core, in this process or not. */
  connect(): Transport;
  version: string;
  /** To a core that serves other clients too: quitting leaves it running. */
  attached?: boolean;
  /** The connection went without the app asking, e.g. as the server stopped. */
  onLost?(): void;
}

/** The terminal app: a client of the core, drawing the session it shows once `initialize` answered. */
export function App({ connect, version, attached, onLost }: AppProps) {
  const terminal = useTerminal();
  const tui = useApp();
  // The screen is made before the client it serves, and only reaches its store once the client is there.
  const screen = useScreen(() => client.store);

  const [client] = useState(() => {
    const created = new JinionClient(connect(), {
      name: 'jinion',
      version,
      notifications: terminal.method === 'bell' ? 'bell' : 'desktop',
      screen,
      followAll: true,
    });

    created.store.set(clientAtom, created);

    return created;
  });

  const [api, setApi] = useState<Api>();

  useEffect(() => {
    let leaving = false;

    void client.initialize().then((initialized) => setApi(createApi(client, initialized, attached ? () => tui.exit() : undefined)));

    const stopFocus = terminal.onFocus((focused) => client.focus(focused));

    const stopClose = client.onClose(() => {
      if (leaving) return;

      onLost?.();
      tui.exit();
    });

    return () => {
      leaving = true;
      stopFocus();
      stopClose();
      client.close();
    };
  }, [client]);

  return <Provider store={client.store}>{api && <Ready api={api} />}</Provider>;
}

function Ready({ api }: { api: Api }) {
  const [attachments] = useState(() => new Attachments((text, tone) => api.act(api.inSession('session/notice', { text, tone }))));

  return (
    <ApiContext.Provider value={api}>
      <AttachmentsContext.Provider value={attachments}>
        <Layout />
      </AttachmentsContext.Provider>
    </ApiContext.Provider>
  );
}

function Layout() {
  useKeys();
  useDialogs();
  const sidebar = useSidebar();

  return <Shell sidebar={sidebar} content={<Conversation />} aside={<Aside />} prompt={<PromptArea />} status={<StatusLine />} />;
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
