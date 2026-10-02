import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  AskPanel,
  Box,
  Composer,
  PermissionPanel,
  ScrollView,
  Shell,
  StatusBar,
  Text,
  TodoPanel,
  Working,
  useApp,
  useInput,
  usePanels,
  useTheme,
  useView,
  type ModelOption,
  type ModelSelection,
  type NoticeTone,
  type PermissionDecision,
  type PermissionRequest,
  type Question,
  type QuestionAnswer,
} from '@jinion/tui';
import type { Agent, LimitWindow } from './agent/types.js';
import { builtinCommands } from './commands/builtin.js';
import { agentCommands, CommandRegistry } from './commands/registry.js';
import {
  JinionContext,
  modelLabel,
  type AppActions,
  type AppInfo,
  type Jinion,
  type ModelState,
} from './context.js';
import {
  createSession,
  fromSaved,
  reduce,
  resumeOf,
  toSaved,
  type Action,
  type SavedSession,
  type Session,
} from './session.js';
import type { SessionStore } from './session-store.js';
import { loadSettings, saveModel, saveStatusLine } from './settings.js';
import { useGitStatus } from './status/git.js';
import { DEFAULT_STATUS_LINE, knownItems, renderStatusLine, type StatusItem } from './status/line.js';
import { findSegment, type StatusData } from './status/segments.js';
import { EntryView } from './ui/entry.js';

export interface AppProps {
  agent: Agent;
  info: AppInfo;
  sessions: SessionStore;
  /** A saved conversation to open with, e.g. for `--continue`. The agent is expected to continue it already. */
  initial?: SavedSession;
}

export function App({ agent, info, sessions, initial }: AppProps) {
  const theme = useTheme();
  const { exit } = useApp();
  const { toggleExpanded } = useView();
  const panels = usePanels();
  const [session, dispatch] = useReducer(reduce, initial, (saved) => (saved ? fromSaved(saved) : createSession(200_000)));
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState<string[]>([]);
  const controller = useRef<AbortController>(undefined);
  const busy = session.busySince !== undefined;

  const commands = useMemo(() => new CommandRegistry([...builtinCommands, ...agentCommands(agent.commands)]), [agent]);
  const completions = useMemo(() => [commands.completion()], [commands]);

  const notice = (text: string, tone?: NoticeTone) => dispatch({ type: 'notice', text, tone });

  const [selection, setSelection] = useState(agent.selection);
  const [models, setModels] = useState<ModelOption[]>();
  useEffect(() => {
    agent.models().then(setModels, () => setModels([]));
  }, [agent]);
  const model: ModelState = {
    agent: agent.name,
    selection,
    options: models,
    name: models?.find((option) => option.id === selection.model)?.name ?? selection.model,
  };

  const selectModel = (next: ModelSelection) => {
    agent.select(next).then(
      () => {
        setSelection(next);
        saveModel(agent.name, next);
        const name = models?.find((option) => option.id === next.model)?.name ?? next.model;
        notice(`Switched to ${modelLabel({ ...model, name, selection: next })}.`);
      },
      (error: unknown) => notice(`Couldn't switch the model: ${error instanceof Error ? error.message : error}`, 'error'),
    );
  };

  const [statusItems, setStatusItems] = useState(() => knownItems(loadSettings().statusLine ?? DEFAULT_STATUS_LINE));
  // `/statusline` shows its draft here while it is open.
  const [statusPreview, setStatusPreview] = useState<StatusItem[]>();
  const [limits, setLimits] = useState<LimitWindow[]>();
  const shownItems = statusPreview ?? statusItems;
  const shownSegments = shownItems.map((item) => findSegment(item.id));
  const git = useGitStatus(info.cwd, shownSegments.some((segment) => segment?.git), busy);
  const now = useNow(shownSegments.some((segment) => segment?.ticks));
  const statusData: StatusData = { info, model, session, git, limits, now, theme };
  const statusLine = renderStatusLine(shownItems, statusData);

  const save = () => {
    const saved = toSaved(session);
    if (saved) sessions.save(saved);
  };

  // Saved after every turn, so quitting or a crash loses at most the turn in progress.
  useEffect(() => {
    if (!busy) save();
  }, [busy]);

  const quit = () => {
    save();
    exit();
  };

  const switchSession = (action: Extract<Action, { type: 'clear' | 'load' }>) => {
    if (busy) return notice('Finish or interrupt the current turn first (esc).', 'warning');
    save();
    agent.reset?.(action.type === 'load' ? resumeOf(action.session) : undefined);
    dispatch(action);
  };

  const prompt = async (text: string) => {
    if (busy) return notice('jinion is still working. Press esc to interrupt it first.', 'warning');
    const abort = new AbortController();
    controller.current = abort;
    dispatch({ type: 'submit', text });

    // Parallel tool calls can ask at the same time, so their panels open one after another.
    let queue = Promise.resolve();
    const interact = <T,>(id: string, render: (resolve: (value: T) => void) => ReactNode) => {
      const open = () =>
        new Promise<T>((resolve, reject) => {
          if (abort.signal.aborted) return reject(abort.signal.reason);
          const element = render((value) => {
            panels.close(id);
            resolve(value);
          });
          panels.open({ id, placement: 'bottom', element });
          abort.signal.addEventListener(
            'abort',
            () => {
              panels.close(id);
              reject(abort.signal.reason);
            },
            { once: true },
          );
        });
      const result = queue.then(open);
      queue = result.then(
        () => {},
        () => {},
      );
      return result;
    };

    const ask = (questions: Question[]) =>
      interact<QuestionAnswer[]>('ask', (resolve) => (
        <AskPanel questions={questions} onSubmit={resolve} onCancel={() => abort.abort()} />
      ));
    const approve = (request: PermissionRequest) =>
      interact<PermissionDecision>('permission', (resolve) => (
        <PermissionPanel request={request} onDecide={resolve} onCancel={() => abort.abort()} />
      ));

    try {
      for await (const event of agent.run(text, { signal: abort.signal, ask, approve })) {
        if (event.type === 'limits') setLimits(event.windows);
        dispatch({ type: 'event', event });
      }
      dispatch({ type: 'finish', outcome: 'done' });
    } catch (error) {
      if (abort.signal.aborted) dispatch({ type: 'finish', outcome: 'interrupted' });
      else dispatch({ type: 'finish', outcome: 'failed', message: error instanceof Error ? error.message : String(error) });
    } finally {
      controller.current = undefined;
      panels.close('ask');
      panels.close('permission');
    }
  };

  const actions: AppActions = {
    submit: (value) => {
      const text = value.trim();
      const isCommand = text.startsWith('/');
      if (!text || (busy && !isCommand)) return;
      setDraft('');
      setSubmitted((items) => [...items, text]);
      if (!isCommand) return void prompt(text);

      const [name = '', ...args] = text.slice(1).split(/\s+/);
      const command = commands.find(name);
      if (!command) return notice(`Unknown command /${name}. Type / to see what is available.`, 'error');
      command.run(jinion, args.join(' '));
    },
    prompt: (text) => void prompt(text),
    fill: setDraft,
    notice,
    newSession: () => switchSession({ type: 'clear' }),
    resume: (saved) => switchSession({ type: 'load', session: saved }),
    selectModel,
    previewStatusLine: setStatusPreview,
    saveStatusLine: (items) => {
      setStatusItems(items);
      setStatusPreview(undefined);
      saveStatusLine(items);
    },
    toggleExpanded,
    exit: quit,
  };

  const jinion: Jinion = {
    info,
    model,
    status: { items: statusItems, data: statusData },
    actions,
    panels,
    commands,
    sessions,
    sessionId: session.id,
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'o') return toggleExpanded();
    // Open panels handle their own esc.
    if (key.escape && busy && !panels.top) return controller.current?.abort();
    if (key.ctrl && input === 'c') {
      if (busy) return controller.current?.abort();
      if (panels.top) return panels.close();
      if (draft) return setDraft('');
      return quit();
    }
  });

  const showTodos =
    session.todos.length > 0 && (busy || session.todos.some((group) => group.items.some((item) => item.status !== 'done')));

  return (
    <JinionContext.Provider value={jinion}>
      <Shell
        content={
          <ScrollView key={session.id}>
            {session.entries.map((entry) => (
              <EntryView key={entry.id} entry={entry} />
            ))}
          </ScrollView>
        }
        aside={
          <>
            {busy && (
              <Box marginTop={1}>
                <Working label={activity(session, panels.top?.id)} since={session.busySince!} />
              </Box>
            )}
            {showTodos && (
              <Box marginTop={1} flexDirection="column">
                <TodoPanel groups={session.todos} />
              </Box>
            )}
          </>
        }
        prompt={
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={actions.submit}
            history={submitted}
            completions={completions}
            placeholder={busy ? 'jinion is working… esc to interrupt' : 'Ask jinion anything, or type / for commands'}
          />
        }
        status={
          <StatusBar items={statusLine.left} right={statusLine.right} />
        }
      />
    </JinionContext.Provider>
  );
}

function activity(session: Session, panel: string | undefined) {
  if (panel === 'permission') return 'Waiting for your approval';
  const last = session.entries.at(-1);
  if (last?.kind === 'thinking') return 'Thinking';
  if (last?.kind === 'text') return 'Writing';
  if (last?.kind === 'tool' && last.status === 'running') {
    if (last.run.name === 'ask') return 'Waiting for your answer';
    return `Running ${last.run.name === 'other' ? last.run.input.title : last.run.name}`;
  }
  return 'Working';
}

/** Redraws every `interval` ms while `active`, for segments that change with the clock. */
function useNow(active: boolean, interval = 15_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [active, interval]);
  return now;
}
