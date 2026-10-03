import { basename, resolve } from 'node:path';
import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  AskPanel,
  Box,
  Composer,
  PermissionPanel,
  PlanPanel,
  ScrollView,
  Shell,
  StatusBar,
  Text,
  TodoPanel,
  Working,
  useApp,
  useInput,
  usePanels,
  useTerminal,
  useTheme,
  useView,
  PastedImages,
  PastedTexts,
  type ModelOption,
  type ModelSelection,
  type NoticeTone,
  type PermissionDecision,
  type PermissionRequest,
  type Question,
  type QuestionAnswer,
} from '@jinion/tui';
import type {
  Agent,
  AgentAccount,
  AgentCommand,
  AgentEvent,
  AgentMode,
  LimitWindow,
  PlanDecision,
  RewindScope,
} from './agent/types.js';
import { builtinCommands } from './commands/builtin.js';
import { CommandRegistry } from './commands/registry.js';
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
import type { MemoryStore } from './memory/store.js';
import type { SessionStore } from './session-store.js';
import { modeColor, MODES, nextMode } from './modes.js';
import {
  limitsKey,
  loadLimits,
  loadSettings,
  saveAccount,
  saveLimits,
  saveModel,
  saveNotifications,
  saveProjectSettings,
  saveStatusLine,
} from './settings.js';
import { useGitStatus } from './status/git.js';
import { DEFAULT_STATUS_LINE, knownItems, renderStatusLine, type StatusItem } from './status/line.js';
import { findSegment, type StatusData } from './status/segments.js';
import { EntryView } from './ui/entry.js';
import { fileCompletion, useProjectFiles } from './files.js';
import { clipboardImage, imageFromPaste } from './images.js';
import { RewindPanel, type RewindPoint } from './panels/rewind.js';
import { skillCompletion, skillMention } from './skills.js';

export interface AppProps {
  agent: Agent;
  info: AppInfo;
  sessions: SessionStore;
  /** The notes the agent keeps across conversations. */
  memory: MemoryStore;
  /** A saved conversation to open with, e.g. for `--continue`. The agent is expected to continue it already. */
  initial?: SavedSession;
}

export function App({ agent, info, sessions, memory, initial }: AppProps) {
  const theme = useTheme();
  const { exit } = useApp();
  const { toggleExpanded } = useView();
  const panels = usePanels();
  const [session, dispatch] = useReducer(reduce, initial, (saved) => (saved ? fromSaved(saved) : createSession(200_000)));
  const [draft, setDraft] = useState('');
  // Long pastes sit in the prompt as placeholders; they expand when sent, also when recalled from history.
  const pastes = useMemo(() => new PastedTexts(), []);
  // So do images, from the clipboard (ctrl+v) or dragged in as files.
  const images = useMemo(() => new PastedImages(), []);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const controller = useRef<AbortController>(undefined);
  const lastEscape = useRef(0);
  const busy = session.busySince !== undefined;

  const commands = useMemo(() => new CommandRegistry(builtinCommands), []);
  // Skills and MCP prompts are mentioned with `$`, apart from Jinion's own commands.
  const [skills, setSkills] = useState<AgentCommand[]>([]);
  const reloadCommands = () => void agent.commands().then(setSkills, () => {});
  const mention = useMemo(() => skillMention(skills), [skills]);
  // For `/diff`, which marks the files the agent changed in this conversation.
  const edited = useMemo(() => {
    const calls = session.entries.flatMap((entry) => (entry.kind === 'tool' ? [entry, ...(entry.children ?? [])] : []));
    return new Set(calls.flatMap((call) => (call.run.name === 'edit' ? [resolve(info.cwd, call.run.input.path)] : [])));
  }, [session.entries, info.cwd]);
  // Listed again after each turn, which may have added or removed files.
  const files = useProjectFiles(info.cwd, session.busySince === undefined);
  const completions = useMemo(
    () => [commands.completion(), skillCompletion(skills), fileCompletion(files)],
    [commands, skills, files],
  );

  const notice = (text: string, tone?: NoticeTone) => dispatch({ type: 'notice', text, tone });

  const terminal = useTerminal();
  const [notifications, setNotifications] = useState(() => loadSettings().notifications !== false);
  // Read when a turn that started earlier notifies.
  const notificationsOn = useRef(notifications);
  notificationsOn.current = notifications;
  /** Reaches the user in another window when jinion needs them or is done; nothing while they look at it. */
  const notify = (body: string) => {
    if (notificationsOn.current && !terminal.focused()) terminal.notify(`jinion · ${basename(info.cwd)}`, body);
  };

  const [selection, setSelection] = useState(agent.selection);
  const [account, setAccount] = useState(agent.accounts?.current);
  const [models, setModels] = useState<ModelOption[]>();
  const [identity, setIdentity] = useState<AgentAccount>();
  // Each account can offer other models, e.g. a team plan next to a personal one.
  useEffect(() => {
    setModels(undefined);
    setIdentity(undefined);
    agent.models().then(setModels, () => setModels([]));
    agent.accounts?.active().then(setIdentity, () => setIdentity(undefined));
  }, [agent, account]);
  // Changes after that, e.g. as MCP servers connect, come as `commands` events.
  useEffect(reloadCommands, [agent, account]);
  const model: ModelState = {
    agent: agent.name,
    selection,
    options: models,
    name: models?.find((option) => option.id === selection.model)?.name ?? selection.model,
  };

  const [mode, setModeState] = useState(agent.mode);
  // The latest mode, for key presses that come faster than renders.
  const currentMode = useRef(agent.mode);
  const modeSwitches = useRef(Promise.resolve());
  const showMode = (next: AgentMode) => {
    currentMode.current = next;
    setModeState(next);
  };

  /** A mode the user picked shows at once; the agent follows in order, and the project starts in it next time. */
  const selectMode = (next: AgentMode) => {
    if (!agent.modes.includes(next)) return notice(`${agent.name} has no ${MODES[next].name} mode.`, 'warning');
    showMode(next);
    saveProjectSettings(info.cwd, { mode: next });
    modeSwitches.current = modeSwitches.current
      .then(() => agent.setMode(next))
      .catch((error: unknown) =>
        notice(`Couldn't switch the mode: ${error instanceof Error ? error.message : error}`, 'error'),
      );
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
  const [seenLimits, setSeenLimits] = useState(loadLimits);
  const limits = seenLimits[limitsKey(agent.name, account)]?.windows;
  const recordLimits = (windows: LimitWindow[]) => {
    setSeenLimits((current) => {
      const next = { ...current, [limitsKey(agent.name, agent.accounts?.current)]: { windows, at: Date.now() } };
      saveLimits(next);
      return next;
    });
  };

  /** What an event does, whether it comes in a turn or between turns. */
  const apply = (event: AgentEvent) => {
    if (event.type === 'limits') recordLimits(event.windows);
    if (event.type === 'mode') showMode(event.mode);
    if (event.type === 'commands') setSkills(event.commands);
    dispatch({ type: 'event', event });
  };
  const latestApply = useRef(apply);
  latestApply.current = apply;
  // Between turns the agent still has news: commands that change as servers connect, limits that come after a turn.
  useEffect(() => agent.subscribe?.((event) => latestApply.current(event)), [agent]);

  const shownItems = statusPreview ?? statusItems;
  const shownSegments = shownItems.map((item) => findSegment(item.id));
  const git = useGitStatus(info.cwd, shownSegments.some((segment) => segment?.git), busy);
  const now = useNow(shownSegments.some((segment) => segment?.ticks));
  const statusData: StatusData = { info, model, mode, account: identity, session, git, limits, now, theme };
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

  /** The conversation carries on under the other login; only between turns, so no request is cut off. */
  const selectAccount = (name: string) => {
    const accounts = agent.accounts;
    if (!accounts) return notice(`${agent.name} has a single login.`, 'warning');
    if (busy) return notice('Finish or interrupt the current turn first (esc).', 'warning');
    accounts
      .list()
      .then((all) => {
        const target = all.find((candidate) => candidate.name === name);
        if (!target) throw new Error(`there is no account called ${name}. Type /account to see them`);
        if (!target.signedIn) throw new Error(`${name} isn't signed in. Type /account to sign in`);
        return accounts.use(name);
      })
      .then(
        () => {
          setAccount(name);
          saveAccount(agent.name, name);
          notice(`Switched to the ${name} account${session.agentSession ? '; the conversation carries on there' : ''}.`);
        },
        (error: unknown) =>
          notice(`Couldn't switch the account: ${error instanceof Error ? error.message : error}`, 'error'),
      );
  };

  const switchSession = (action: Extract<Action, { type: 'clear' | 'load' }>) => {
    if (busy) return notice('Finish or interrupt the current turn first (esc).', 'warning');
    save();
    agent.reset?.(action.type === 'load' ? resumeOf(action.session) : undefined);
    dispatch(action);
  };

  /** A pasted path of an image file, e.g. one dragged into the terminal, goes in as the image. */
  const pasteImage = (text: string) => {
    try {
      const image = imageFromPaste(text);
      return image && images.add(image);
    } catch (error) {
      notice(error instanceof Error ? error.message : String(error), 'warning');
      return undefined;
    }
  };

  const pasteClipboardImage = async () => {
    try {
      const image = await clipboardImage();
      if (image) return images.add(image);
      notice('There is no image on the clipboard. Text pastes with your terminal’s paste, e.g. cmd+v.', 'muted');
    } catch (error) {
      notice(error instanceof Error ? error.message : String(error), 'warning');
    }
    return undefined;
  };

  // Messages that wait for the turn in progress, sent one after another once it is done.
  const [queued, setQueued] = useState<string[]>([]);
  const queue = useRef<string[]>([]);
  const setQueue = (items: string[]) => {
    queue.current = items;
    setQueued(items);
  };
  const enqueue = (text: string) => setQueue([...queue.current, text]);

  /** A message typed while the agent works goes into its turn, or waits for it when the agent can't take it. */
  const steer = (text: string) => {
    const full = pastes.expand(text);
    const id = agent.steer?.({ text: full, images: images.in(text) });
    if (id !== undefined) dispatch({ type: 'steer', text, prompt: full === text ? undefined : full, id });
    else enqueue(text);
  };

  useEffect(() => {
    if (busy || queue.current.length === 0) return;
    const [next, ...rest] = queue.current;
    setQueue(rest);
    void prompt(next!);
  }, [busy]);

  const prompt = async (text: string) => {
    if (busy) return notice('jinion is still working. Press esc to interrupt it first.', 'warning');
    const abort = new AbortController();
    controller.current = abort;
    const full = pastes.expand(text);
    const started = Date.now();
    dispatch({ type: 'submit', text, prompt: full === text ? undefined : full });

    // Parallel tool calls can ask at the same time, so their panels open one after another.
    let panelsInLine = Promise.resolve();
    const interact = <T,>(id: string, message: string, render: (resolve: (value: T) => void) => ReactNode) => {
      const open = () =>
        new Promise<T>((resolve, reject) => {
          if (abort.signal.aborted) return reject(abort.signal.reason);
          const element = render((value) => {
            panels.close(id);
            resolve(value);
          });
          panels.open({ id, placement: 'bottom', element });
          notify(message);
          abort.signal.addEventListener(
            'abort',
            () => {
              panels.close(id);
              reject(abort.signal.reason);
            },
            { once: true },
          );
        });
      const result = panelsInLine.then(open);
      panelsInLine = result.then(
        () => {},
        () => {},
      );
      return result;
    };

    const ask = (questions: Question[]) =>
      interact<QuestionAnswer[]>('ask', `jinion asks: ${questions[0]?.prompt ?? 'a question'}`, (resolve) => (
        <AskPanel questions={questions} onSubmit={resolve} onCancel={() => abort.abort()} />
      ));
    const approve = (request: PermissionRequest) =>
      interact<PermissionDecision>('permission', [request.title, request.command ?? request.subject].filter(Boolean).join(': '), (resolve) => (
        <PermissionPanel request={request} onDecide={resolve} onCancel={() => abort.abort()} />
      ));
    const approvePlan = (modes: AgentMode[]) =>
      interact<PlanDecision>('plan', 'The plan is ready for you to review.', (resolve) => (
        <PlanPanel
          options={modes.map((option) => ({ id: option, label: PLAN_CHOICES[option], description: MODES[option].description }))}
          onDecide={(decision) => {
            if (!decision.approve) return resolve(decision);
            const next = decision.option as AgentMode;
            // The agent switches itself; the project remembers the pick.
            showMode(next);
            saveProjectSettings(info.cwd, { mode: next });
            resolve({ approve: true, mode: next });
          }}
          onCancel={() => abort.abort()}
        />
      ));

    // A long turn may have sent the user elsewhere; a short one they likely watched.
    const quoted = `“${text.split('\n')[0]!.slice(0, 60)}”`;
    const notifyLong = (body: string) => Date.now() - started >= LONG_TURN_MS && notify(body);
    try {
      const sent = { text: full, images: images.in(text) };
      for await (const event of agent.run(sent, { signal: abort.signal, ask, approve, approvePlan })) {
        apply(event);
      }
      dispatch({ type: 'finish', outcome: 'done' });
      notifyLong(`Done with ${quoted} after ${seconds(Date.now() - started)}.`);
    } catch (error) {
      if (abort.signal.aborted) dispatch({ type: 'finish', outcome: 'interrupted' });
      else {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'finish', outcome: 'failed', message });
        notifyLong(`${quoted} stopped with an error: ${message}`);
      }
      // What waited for a turn that didn't finish comes back into the prompt, for the user to send or drop.
      const waiting = queue.current;
      if (waiting.length > 0) {
        setQueue([]);
        setDraft((current) => [...waiting, current].filter(Boolean).join('\n'));
      }
    } finally {
      controller.current = undefined;
      panels.close('ask');
      panels.close('permission');
    }
  };

  /** Goes back to before a message: its files, the conversation, or both; a message taken back returns to the prompt. */
  const rewindTo = async (point: RewindPoint, scope: RewindScope) => {
    const quoted = `“${point.text.split('\n')[0]!.slice(0, 60)}”`;
    try {
      await agent.rewind!(point.promptId, scope);
    } catch (error) {
      return notice(`Couldn't rewind: ${error instanceof Error ? error.message : error}`, 'error');
    }
    if (scope.conversation) {
      dispatch({ type: 'rewind', entry: point.entry });
      setDraft(point.text);
    }
    notice(
      scope.code && scope.conversation
        ? `Went back to before ${quoted}, files and conversation.`
        : scope.conversation
          ? `The conversation went back to before ${quoted}; the files stay as they are.`
          : `The files went back to how they were before ${quoted}; the conversation goes on.`,
      'success',
    );
  };

  const openRewind = () => {
    if (!agent.rewind) return notice(`${agent.name} can't rewind.`, 'warning');
    if (busy) return notice('Finish or interrupt the current turn first (esc).', 'warning');
    const points = session.entries
      .flatMap((entry) => (entry.kind === 'user' && entry.promptId ? [{ entry: entry.id, promptId: entry.promptId, text: entry.text, steered: entry.steered }] : []))
      .reverse();
    if (points.length === 0) return notice('There is nothing to rewind yet.', 'muted');
    panels.open({
      id: 'rewind',
      placement: 'bottom',
      element: (
        <RewindPanel
          points={points}
          preview={(point) => agent.rewindPreview?.(point.promptId) ?? Promise.resolve(undefined)}
          onRewind={(point, scope) => void rewindTo(point, scope)}
        />
      ),
    });
  };

  const actions: AppActions = {
    submit: (value) => {
      const text = value.trim();
      const isCommand = text.startsWith('/');
      if (!text) return;
      setDraft('');
      setSubmitted((items) => [...items, text]);
      if (!isCommand) return busy ? steer(text) : void prompt(text);

      const [name = '', ...args] = text.slice(1).split(/\s+/);
      const command = commands.find(name);
      if (!command && skills.some((skill) => skill.name === name)) {
        // Typed out of habit: it goes back in the prompt the new way, to send as it is or to add to.
        setDraft(`$${text.slice(1)}`);
        return notice(`Skills go after $ now, anywhere in the message: $${name}. Press enter to send it.`, 'muted');
      }
      if (!command) return notice(`Unknown command /${name}. Type / to see what is available.`, 'error');
      command.run(jinion, pastes.expand(args.join(' ')));
    },
    prompt: (text) => void prompt(text),
    fill: setDraft,
    notice,
    newSession: () => switchSession({ type: 'clear' }),
    resume: (saved) => switchSession({ type: 'load', session: saved }),
    selectModel,
    selectMode,
    selectAccount,
    previewStatusLine: setStatusPreview,
    saveStatusLine: (items) => {
      setStatusItems(items);
      setStatusPreview(undefined);
      saveStatusLine(items);
    },
    rewind: openRewind,
    setNotifications: (on) => {
      setNotifications(on);
      saveNotifications(on);
    },
    reloadCommands,
    toggleExpanded,
    exit: quit,
  };

  const jinion: Jinion = {
    info,
    model,
    modes: { current: mode, available: agent.modes },
    status: { items: statusItems, data: statusData },
    accounts: { manager: agent.accounts, current: account, identity, seen: seenLimits },
    mcp: agent.mcp,
    actions,
    panels,
    commands,
    skills: { list: skills, mention },
    sessions,
    memory,
    edited,
    notifications: { on: notifications, method: terminal.method },
    sessionId: session.id,
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'o') return toggleExpanded();
    if (key.tab && key.shift && !panels.top && agent.modes.length > 1) {
      return selectMode(nextMode(agent.modes, currentMode.current));
    }
    // Open panels handle their own esc.
    if (key.escape && busy && !panels.top) return controller.current?.abort();
    // Esc twice on an empty prompt goes back to an earlier message.
    if (key.escape && !busy && !panels.top && !draft) {
      const now = Date.now();
      if (now - lastEscape.current < DOUBLE_ESCAPE_MS) {
        lastEscape.current = 0;
        return openRewind();
      }
      lastEscape.current = now;
      return;
    }
    // Sends the message after the turn in progress rather than into it; with nothing running, right away.
    if (key.ctrl && input === 'q' && !panels.top) {
      const text = draft.trim();
      if (!text) return;
      if (!busy) return actions.submit(text);
      setDraft('');
      setSubmitted((items) => [...items, text]);
      return enqueue(text);
    }
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
            {queued.length > 0 && (
              <Box marginTop={1} flexDirection="column" paddingX={1}>
                {queued.map((text, index) => (
                  <Text key={index} color={theme.muted} wrap="truncate-end">
                    queued: {text}
                  </Text>
                ))}
              </Box>
            )}
          </>
        }
        prompt={
          <Composer
            pastes={pastes}
            onPaste={pasteImage}
            onPasteKey={pasteClipboardImage}
            value={draft}
            onChange={setDraft}
            onSubmit={actions.submit}
            history={submitted}
            completions={completions}
            mentions={[mention]}
            placeholder={
              !busy
                ? 'Ask jinion anything · / commands · $ skills · @ files'
                : agent.steer
                  ? 'Type to steer · ctrl+q to queue · esc to interrupt'
                  : 'Type to queue · esc to interrupt'
            }
            footer={
              agent.modes.length > 1 && (
                <Text>
                  <Text color={modeColor(theme, mode)}>{MODES[mode].name}</Text>
                  <Text color={theme.muted}> · shift+tab</Text>
                </Text>
              )
            }
          />
        }
        status={
          <StatusBar items={statusLine.left} right={statusLine.right} />
        }
      />
    </JinionContext.Provider>
  );
}

/** Two presses of esc this close together open the rewind panel. */
const DOUBLE_ESCAPE_MS = 600;

/** A turn this long notifies when it ends, should the user have gone to another window meanwhile. */
const LONG_TURN_MS = 15_000;

/** `42s`, or `3m 5s`. */
function seconds(ms: number) {
  const total = Math.round(ms / 1000);
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${total % 60}s`;
}

/** What each mode reads as in the plan panel. */
const PLAN_CHOICES: Record<AgentMode, string> = {
  auto: 'Yes, and use auto mode',
  edits: 'Yes, and accept edits',
  manual: 'Yes, and approve each edit',
  plan: 'Yes, and keep planning mode',
};

function activity(session: Session, panel: string | undefined) {
  if (panel === 'permission' || panel === 'plan') return 'Waiting for your approval';
  const last = session.entries.at(-1);
  if (last?.kind === 'thinking') return 'Thinking';
  if (last?.kind === 'text') return 'Writing';
  if (last?.kind === 'tool' && last.status === 'running') {
    if (last.run.name === 'ask') return 'Waiting for your answer';
    if (last.run.name === 'agent') return `A subagent is on it: ${last.run.input.description}`;
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
