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
  useSelection,
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
  type TodoGroup,
} from '@jinion/tui';
import type {
  Agent,
  AgentAccount,
  AgentCommand,
  AgentEvent,
  AgentMode,
  BackgroundTask,
  LimitWindow,
  PlanDecision,
  RewindScope,
  RunContext,
  Usage,
} from './agent/types.js';
import { builtinCommands } from './commands/builtin.js';
import { CommandRegistry } from './commands/registry.js';
import {
  ConversationContext,
  JinionContext,
  modelLabel,
  type AppActions,
  type AppInfo,
  type Jinion,
  type ModelState,
} from './context.js';
import {
  conversationDigest,
  createSession,
  editTurns,
  fromSaved,
  inRunningTurn,
  promptCount,
  reduce,
  resumeOf,
  titleDue,
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
import { backgroundTasks, TaskLine, TasksPanel } from './panels/tasks.js';
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
  const textSelection = useSelection();
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
  const turns = useMemo(() => editTurns(session.entries), [session.entries]);
  const edited = useMemo(
    () => new Set(turns.flatMap((turn) => turn.edits.map((change) => resolve(info.cwd, change.path)))),
    [turns, info.cwd],
  );
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
  // Counts the times the account in use signed in again, which can be another login under the same name.
  const [logins, setLogins] = useState(0);
  // Each account can offer other models, e.g. a team plan next to a personal one.
  useEffect(() => {
    setModels(undefined);
    setIdentity(undefined);
    agent.models().then(setModels, () => setModels([]));
    agent.accounts?.active().then(setIdentity, () => setIdentity(undefined));
  }, [agent, account, logins]);
  // Changes after that, e.g. as MCP servers connect, come as `commands` events.
  useEffect(reloadCommands, [agent, account, logins]);
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

  // The agent's background tasks, which outlive the turn that started them.
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  /** What an event does, whether it comes in a turn or between turns. */
  const apply = (event: AgentEvent) => {
    if (event.type === 'limits') recordLimits(event.windows);
    if (event.type === 'mode') showMode(event.mode);
    if (event.type === 'commands') setSkills(event.commands);
    if (event.type === 'tasks') setTasks(event.tasks);
    if (event.type === 'task-end') {
      const { kind, status, title } = event.task;
      notify(`${kind === 'agent' ? 'Subagent' : 'Background command'} ${status}: ${title.split('\n')[0]}`);
    }
    if (event.type === 'turn-start') return followAgent();
    dispatch({ type: 'event', event });
  };
  const latestApply = useRef(apply);
  latestApply.current = apply;
  // Between turns the agent still has news: commands that change as servers connect, limits that come after a turn,
  // background tasks, and turns it starts itself.
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

  // Saved after every turn, so quitting or a crash loses at most the turn in progress, and once it has a new title.
  useEffect(() => {
    if (!busy) save();
  }, [busy, session.titled]);

  const naming = useRef(false);
  const planAccepted = useRef(false);
  /**
   * A small model names the conversation from what it is about, for finding it in /resume. `fresh` asks for a new name;
   * otherwise the current one stays while it still fits.
   */
  const nameConversation = async (fresh: boolean) => {
    const titleFor = agent.titleFor?.bind(agent);
    if (!titleFor || naming.current) return undefined;
    const { id, entries, title, titled } = session;
    naming.current = true;
    try {
      const named = await titleFor(conversationDigest(entries), fresh || !titled ? undefined : title);
      if (named) dispatch({ type: 'retitle', session: id, title: named, by: 'agent', turns: promptCount(entries) });
      return named;
    } finally {
      naming.current = false;
    }
  };

  // Named after the first turn, and again as the conversation moves on, or after a plan is accepted, as in Claude Code.
  // A name the user gave stays. When naming fails, the first message stays the title and the next turn tries again.
  useEffect(() => {
    if (busy) return;
    const accepted = planAccepted.current;
    planAccepted.current = false;
    if (session.titled?.by === 'user') return;
    if (accepted || titleDue(session)) nameConversation(accepted).catch(() => {});
  }, [busy]);

  const quit = () => {
    save();
    exit();
  };

  /** The conversation carries on under the other login; only between turns, so no request is cut off. */
  const selectAccount = (name: string) => {
    const accounts = agent.accounts;
    if (!accounts) return notice(`${agent.name} has a single login.`, 'warning');
    if (name === account) return notice(`Already using the ${name} account.`, 'muted');
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

  // A new login for the account in use reaches the conversation in a process that starts with it, between turns.
  const loginWaits = useRef(false);
  const startWithNewLogin = () => {
    loginWaits.current = false;
    agent.accounts?.use(agent.accounts.current).then(
      () => setLogins((count) => count + 1),
      (error: unknown) =>
        notice(`Couldn't start over with the new login: ${error instanceof Error ? error.message : error}`, 'error'),
    );
  };
  useEffect(() => {
    if (!busy && loginWaits.current) startWithNewLogin();
  }, [busy]);

  /** Signs an account out and forgets it, with the plan limits last seen for it. */
  const removeAccount = async (name: string) => {
    const accounts = agent.accounts;
    if (!accounts) return notice(`${agent.name} has a single login.`, 'warning');
    try {
      await accounts.remove(name);
    } catch (error) {
      return notice(`Couldn't remove the ${name} account: ${error instanceof Error ? error.message : error}.`, 'error');
    }
    setSeenLimits((current) => {
      const { [limitsKey(agent.name, name)]: _, ...rest } = current;
      saveLimits(rest);
      return rest;
    });
    notice(`Removed the ${name} account and signed it out. Its conversations stay.`, 'success');
  };

  const switchSession = (action: Extract<Action, { type: 'clear' | 'load' }>) => {
    if (busy) return notice('Finish or interrupt the current turn first (esc).', 'warning');
    save();
    const running = backgroundTasks(tasks).filter((task) => task.status === 'running');
    // The conversation's background tasks end with it.
    agent.reset?.(action.type === 'load' ? resumeOf(action.session) : undefined);
    setTasks([]);
    dispatch(action);
    if (running.length > 0) {
      notice(`Stopped what ran in the background of the last conversation: ${running.map((task) => task.title.split('\n')[0]).join(', ')}.`);
    }
  };

  const openTasks = () => panels.open({ id: 'tasks', placement: 'bottom', element: <TasksPanel /> });

  const stopTask = (id: string) => {
    agent.stopTask?.(id).catch((error: unknown) =>
      notice(`Couldn't stop the task: ${error instanceof Error ? error.message : error}`, 'error'),
    );
  };

  /** ctrl+b: the command or subagent the turn waits for goes on in the background, and the turn without it. */
  const sendToBackground = () => {
    if (!agent.background) return;
    if (!tasks.some((task) => task.foreground && task.status === 'running')) {
      return notice('Nothing to send to the background yet: a command or subagent can go there once it has run a few seconds.', 'muted');
    }
    agent.background().catch((error: unknown) =>
      notice(`Couldn't send it to the background: ${error instanceof Error ? error.message : error}`, 'error'),
    );
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
    if (busy) return;
    if (agentTurn.current) {
      agentTurn.current = false;
      return followAgent();
    }
    if (queue.current.length === 0) return;
    const [next, ...rest] = queue.current;
    setQueue(rest);
    void prompt(next!);
  }, [busy]);

  // A turn already on its way, before the render that shows it.
  const working = () => busy || controller.current !== undefined;

  const prompt = async (text: string) => {
    if (working()) return notice('jinion is still working. Press esc to interrupt it first.', 'warning');
    const full = pastes.expand(text);
    dispatch({ type: 'submit', text, prompt: full === text ? undefined : full });
    const sent = { text: full, images: images.in(text) };
    await runTurn(`“${text.split('\n')[0]!.slice(0, 60)}”`, (context) => agent.run(sent, context));
  };

  /** A turn the agent started itself, e.g. to look at a background task that ended; after the one in progress. */
  const agentTurn = useRef(false);
  const followAgent = () => {
    const join = agent.join?.bind(agent);
    if (!join) return;
    if (controller.current) {
      agentTurn.current = true;
      return;
    }
    dispatch({ type: 'agent-turn' });
    void runTurn('the background task', join);
  };

  /**
   * Follows a turn's events: the panels it asks in, esc to interrupt it, a notification when a long one ends, and what
   * was queued for after it. `label` names it in notifications.
   */
  const runTurn = async (label: string, events: (context: RunContext) => AsyncIterable<AgentEvent>) => {
    const abort = new AbortController();
    controller.current = abort;
    const started = Date.now();

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
    const approve = async (request: PermissionRequest, call?: string) => {
      if (call) dispatch({ type: 'approval', id: call, waiting: true });
      try {
        return await interact<PermissionDecision>(
          'permission',
          [request.title, request.command ?? request.subject].filter(Boolean).join(': '),
          (resolve) => <PermissionPanel request={request} onDecide={resolve} onCancel={() => abort.abort()} />,
        );
      } finally {
        if (call) dispatch({ type: 'approval', id: call, waiting: false });
      }
    };
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
            planAccepted.current = true;
            resolve({ approve: true, mode: next });
          }}
          onCancel={() => abort.abort()}
        />
      ));

    // A long turn may have sent the user elsewhere; a short one they likely watched.
    const notifyLong = (body: string) => Date.now() - started >= LONG_TURN_MS && notify(body);
    try {
      for await (const event of events({ signal: abort.signal, ask, approve, approvePlan })) {
        apply(event);
      }
      dispatch({ type: 'finish', outcome: 'done' });
      notifyLong(`Done with ${label} after ${seconds(Date.now() - started)}.`);
    } catch (error) {
      if (abort.signal.aborted) dispatch({ type: 'finish', outcome: 'interrupted' });
      else {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'finish', outcome: 'failed', message });
        notifyLong(`Stopped with an error, working on ${label}: ${message}`);
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
      // As in Claude Code, a message that joined a running turn is no place to go back to.
      .flatMap((entry) => (entry.kind === 'user' && entry.promptId && !entry.steered ? [{ entry: entry.id, promptId: entry.promptId, text: entry.text }] : []))
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
      if (!isCommand) return working() ? steer(text) : void prompt(text);

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
    accountSignedIn: (name) => {
      if (name !== agent.accounts?.current) return;
      if (working()) loginWaits.current = true;
      else startWithNewLogin();
    },
    removeAccount,
    previewStatusLine: setStatusPreview,
    saveStatusLine: (items) => {
      setStatusItems(items);
      setStatusPreview(undefined);
      saveStatusLine(items);
    },
    rewind: openRewind,
    rename: (name) => {
      if (name) {
        dispatch({ type: 'retitle', session: session.id, title: name, by: 'user', turns: promptCount(session.entries) });
        return notice(`Renamed the conversation to “${name}”.`, 'success');
      }
      if (!agent.titleFor) return notice(`${agent.name} can't name conversations. Type /rename and a name.`, 'warning');
      if (promptCount(session.entries) === 0) return notice('There is nothing to name yet.', 'muted');
      nameConversation(true).then(
        (named) =>
          named
            ? notice(`Named the conversation “${named}”. It is named again as it moves on.`, 'success')
            : notice('Couldn’t name the conversation. Type /rename and a name.', 'warning'),
        (error: unknown) =>
          notice(`Couldn't name the conversation: ${error instanceof Error ? error.message : error}`, 'error'),
      );
    },
    openTasks,
    compact: (focus) => {
      const compactWith = agent.compact?.bind(agent);
      if (!compactWith) return notice(`${agent.name} can't compact the conversation.`, 'warning');
      if (working()) return notice('Finish or interrupt the current turn first (esc).', 'warning');
      if (!session.entries.some((entry) => entry.kind === 'user')) return notice('There is nothing to compact yet.', 'muted');
      dispatch({ type: 'agent-turn' });
      void runTurn('the compaction', (context) => compactWith(focus, context));
    },
    stopTask,
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
    usage: { current: agent.usage?.bind(agent), history: agent.history?.bind(agent), context: agent.context?.bind(agent) },
    actions,
    panels,
    commands,
    skills: { list: skills, mention },
    sessions,
    memory,
    edited,
    turns,
    tasks,
    notifications: { on: notifications, method: terminal.method },
    sessionId: session.id,
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'o') return toggleExpanded();
    if (key.ctrl && input === 't' && !panels.top) return openTasks();
    if (key.ctrl && input === 'b' && busy && !panels.top) return sendToBackground();
    if (key.tab && key.shift && !panels.top && agent.modes.length > 1) {
      return selectMode(nextMode(agent.modes, currentMode.current));
    }
    // Open panels handle their own esc.
    if (key.escape && busy && !panels.top) return controller.current?.abort();
    // Esc twice goes back to an earlier message; with something typed, it clears that first, keeping it in the history.
    if (key.escape && !busy && !panels.top) {
      const now = Date.now();
      if (now - lastEscape.current >= DOUBLE_ESCAPE_MS) {
        lastEscape.current = now;
        return;
      }
      lastEscape.current = 0;
      if (!draft) return openRewind();
      setSubmitted((items) => [...items, draft]);
      return setDraft('');
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
      // With text selected, as in Claude Code, ctrl+c copies it rather than stopping anything.
      if (textSelection.copy()) return;
      if (busy) return controller.current?.abort();
      if (panels.top) return panels.close();
      if (draft) return setDraft('');
      return quit();
    }
  });

  const contextLeft = contextWarning(session.usage);

  const showTodos = hasWorkLeft(session.todos);
  const conversation = useMemo(() => ({ mention, tasks }), [mention, tasks]);

  return (
    <JinionContext.Provider value={jinion}>
      <Shell
        content={
          <ConversationContext.Provider value={conversation}>
            <ScrollView key={session.id}>
              {session.entries.map((entry, index) => (
                <EntryView key={entry.id} entry={entry} live={inRunningTurn(session, index)} />
              ))}
            </ScrollView>
          </ConversationContext.Provider>
        }
        aside={
          <>
            {busy && (
              <Box marginTop={1}>
                <Working label={activity(session, panels.top?.id, tasks)} since={session.busySince!} />
              </Box>
            )}
            {showTodos && (
              <Box marginTop={1} flexDirection="column">
                <TodoPanel groups={session.todos} />
              </Box>
            )}
            <TaskLine tasks={tasks} />
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
              (agent.modes.length > 1 || contextLeft !== undefined) && (
              <Text>
                {agent.modes.length > 1 && (
                  <>
                    <Text color={modeColor(theme, mode)}>{MODES[mode].name}</Text>
                    <Text color={theme.muted}> · shift+tab</Text>
                  </>
                )}
                {contextLeft !== undefined && (
                  <Text color={contextLeft < 0.1 ? theme.error : theme.warning}>
                    {agent.modes.length > 1 && <Text color={theme.muted}> · </Text>}
                    {`${Math.max(0, Math.round(contextLeft * 100))}% context left until auto-compact · /compact`}
                  </Text>
                )}
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

/**
 * Whether the task list stays above the prompt: while there is work left on it. Once it is all done, its last state is
 * in the conversation, and later turns don't bring it back.
 */
export const hasWorkLeft = (todos: TodoGroup[]) => todos.some((group) => group.items.some((item) => item.status !== 'done'));

/** How much context is left before auto-compaction when the warning under the prompt shows. */
const CONTEXT_WARNING = 0.2;

/** As in Claude Code, the share of context left until auto-compaction, once it draws near. */
export function contextWarning({ contextTokens, compactAt }: Usage) {
  if (!compactAt) return undefined;
  const left = 1 - contextTokens / compactAt;
  return left <= CONTEXT_WARNING ? left : undefined;
}

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

function activity(session: Session, panel: string | undefined, tasks: BackgroundTask[]) {
  if (panel === 'permission' || panel === 'plan') return 'Waiting for your approval';
  if (session.compacting) return 'Compacting the conversation';
  const last = session.entries.at(-1);
  if (last?.kind === 'thinking') return 'Thinking';
  if (last?.kind === 'text') return 'Writing';
  if (last?.kind === 'task') return 'Looking at the background task that ended';
  if (last?.kind === 'tool' && last.status === 'running') {
    if (last.run.name === 'ask') return 'Waiting for your answer';
    // A long command or subagent can go on in the background once the agent lists it.
    const hint = tasks.some((task) => task.foreground && task.status === 'running') ? ' · ctrl+b to run it in the background' : '';
    if (last.run.name === 'agent') return `A subagent is on it: ${last.run.input.description}${hint}`;
    return `Running ${last.run.name === 'other' ? last.run.input.title : last.run.name}${hint}`;
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
