import type { AgentMode, AgentPrompt, PlanDecision } from '@jinion/core/agent/agent';
import type { ModelSelection } from '@jinion/core/agent/models';
import type { PermissionDecision } from '@jinion/core/agent/permissions';
import type { QuestionAnswer } from '@jinion/core/agent/questions';
import { JinionClient } from '@jinion/core/api/client';
import { portTransport } from '@jinion/core/api/port-transport';
import type { PromptFill, RepoChanges, TerminalInfo, View } from '@jinion/core/api/protocol';
import type { Initialized, MemoryNote, SavedSummary } from '@jinion/core/api/schemas';
import { atom } from 'jotai';
import type { RecentProject } from '../../main/bridge.js';
import { waitForPort } from './port.js';

export interface CoreScreen {
  notify(title: string, body: string): void;
  fillPrompt(session: string, text: string, fill: PromptFill): void;
}

/** What the user sent: `text` as the conversation shows it, `prompt` when the agent gets more, such as images. */
export interface Submission {
  text: string;
  prompt?: AgentPrompt;
}

/**
 * The page's side of one project's core: a `JinionClient` over the port the main process hands it, with the calls the
 * screens make named as they say them. Everything it holds is in the client's store, which the project's window uses.
 */
export class Core {
  readonly client: JinionClient;
  /** Every saved thread, the open ones too: a list leaves those out as it draws, against the sessions open then. */
  readonly savedAtom = atom<SavedSummary[]>([]);
  readonly memoryAtom = atom<MemoryNote[] | undefined>(undefined);
  /** Folders end in `/`, as `files/list` names them. */
  readonly filesAtom = atom<string[]>([]);
  readonly branchAtom = atom<string | undefined>(undefined);
  /** What isn't committed in each repository of the shown thread's folder; undefined until read. */
  readonly gitAtom = atom<RepoChanges[] | undefined>(undefined);
  /** Set when the core stopped, so the window can say so instead of waiting. */
  readonly goneAtom = atom(false);
  /** Why the last call the user made failed, such as a thread another Jinion has open; shown until dismissed. */
  readonly problemAtom = atom<string | undefined>(undefined);
  /** What a slash command asked to show, until the window shows it; a new object each time, so the same view shows again. */
  readonly viewAtom = atom<{ view: View } | undefined>(undefined);
  /** The project's terminals, the agent's among them, as the core lists them. */
  readonly terminalsAtom = atom<TerminalInfo[]>([]);
  /** Prompts to start with, which the demo backend has. */
  examples: string[] = [];
  /** Jinion's own slash commands, as the core listed them. */
  commands: Initialized['commands'] = [];
  private closed?: () => void;

  private constructor(
    readonly project: RecentProject,
    port: MessagePort,
    version: string,
    screen: CoreScreen,
  ) {
    const transport = portTransport({
      post: (text) => port.postMessage(text),
      onMessage: (listener) => {
        port.onmessage = ({ data }) => listener(data as string);
      },
      // A page's port says nothing when the other end goes; the main process does instead, through `gone`.
      onClose: (listener) => {
        this.closed = listener;
      },
      close: () => port.close(),
    });

    this.client = new JinionClient(transport, {
      name: 'jinion-desktop',
      version,
      notifications: 'desktop',
      followAll: true,
      screen: {
        view: (view) => this.client.store.set(this.viewAtom, { view }),
        fillPrompt: (session, text, fill) => screen.fillPrompt(session, text, fill),
        notify: (title, body) => screen.notify(title, body),
        expand: () => {},
        exit: () => {},
      },
    });

    this.client.store.sub(this.client.sessionsAtom, () => void this.refreshSaved());
    this.client.on('terminals/changed', ({ terminals }) => this.client.store.set(this.terminalsAtom, terminals));
  }

  /** Opens the folder's core, starting it when it isn't running, and follows every session open in it. */
  static async open(path: string, screen: CoreScreen) {
    const port = waitForPort(path);
    const [project, version] = await Promise.all([window.desktop.openProject(path), window.desktop.version()]);
    const core = new Core(project, await port, version, screen);
    const { info, commands } = await core.client.initialize();

    core.examples = info.examples ?? [];
    core.commands = commands;
    void core.refreshSaved();
    // A core that ran before this window opened, as after a reload, may have terminals already.
    core.client.store.set(core.terminalsAtom, await core.client.request('terminals/list', {}));

    return core;
  }

  get sessionsAtom() {
    return this.client.sessionsAtom;
  }

  get appAtom() {
    return this.client.appAtom;
  }

  session(id: string) {
    return this.client.session(id);
  }

  gone() {
    this.client.store.set(this.goneAtom, true);
    this.closed?.();
  }

  /** A call nothing waits on, whose failure the window shows rather than drops. */
  act(call: Promise<unknown> | undefined) {
    void call?.catch((error: Error) => this.client.store.set(this.problemAtom, error.message));
  }

  async open() {
    const { session } = await this.client.request('sessions/open', { activate: true });

    return session;
  }

  resume(id: string) {
    return this.client.request('sessions/open', { resume: id, activate: true });
  }

  activate(session: string) {
    return this.client.request('sessions/activate', { session });
  }

  close(session: string) {
    return this.client.request('sessions/close', { session });
  }

  /** A prompt, a message for the turn that runs, or a slash command: the core tells them apart. */
  submit(session: string, submission: Submission) {
    return this.client.request('session/submit', { session, ...submission });
  }

  /** Sent once the running turn ends. */
  queue(session: string, submission: Submission) {
    return this.client.request('session/queue', { session, ...submission });
  }

  /** The queued message back as it was sent, or null when the turn ended and sent it meanwhile. */
  unqueue(session: string, text: string) {
    return this.client.request('session/unqueue', { session, text });
  }

  context(session: string) {
    return this.client.request('session/context', { session });
  }

  /** A line in the thread's conversation, such as why an image couldn't be attached. */
  notice(session: string, text: string, tone: 'muted' | 'warning' = 'muted') {
    return this.client.request('session/notice', { session, text, tone });
  }

  interrupt(session: string) {
    return this.client.request('session/interrupt', { session });
  }

  answerPermission(session: string, answer: PermissionDecision) {
    return this.client.request('dialog/answer', { session, dialog: 'permission', answer });
  }

  answerQuestions(session: string, answer: QuestionAnswer[]) {
    return this.client.request('dialog/answer', { session, dialog: 'ask', answer });
  }

  answerPlan(session: string, answer: PlanDecision) {
    return this.client.request('dialog/answer', { session, dialog: 'plan', answer });
  }

  setMode(session: string, mode: AgentMode) {
    return this.client.request('session/mode', { session, mode });
  }

  setWorktree(session: string, on: boolean) {
    return this.client.request('session/worktree', { session, on });
  }

  setModel(session: string, selection: ModelSelection, agent: string) {
    return this.client.request('session/model', { session, selection, agent });
  }

  stopTask(session: string, task: string) {
    return this.client.request('session/stop-task', { session, task });
  }

  /** Goes back to before a message the backend knows; the core puts its text back in the composer. */
  rewind(session: string, entry: string) {
    const snapshot = this.client.store.get(this.session(session));
    const message = snapshot?.state.entries.find((each) => each.id === entry);
    if (message?.kind !== 'user' || !message.promptId) return;

    const point = { entry, promptId: message.promptId, text: message.text };

    return this.client.request('session/rewind', { session, point, scope: { code: true, conversation: true } });
  }

  async refreshMemory() {
    this.client.store.set(this.memoryAtom, await this.client.request('memory/list', {}));
  }

  async forget(note: MemoryNote) {
    await this.client.request('memory/forget', { scope: note.scope, id: note.id });
    await this.refreshMemory();
  }

  async refreshFiles(session: string) {
    this.client.store.set(this.filesAtom, await this.client.request('files/list', { session }));
  }

  read(session: string, path: string) {
    return this.client.request('files/read', { session, path });
  }

  async refreshBranch(session: string) {
    const status = await this.client.request('git/status', { session });

    this.client.store.set(this.branchAtom, status?.repos[0]?.branch);
  }

  async refreshGit(session: string) {
    this.client.store.set(this.gitAtom, await this.client.request('git/changes', { session, uncommitted: true }));
  }

  /** A changed file's diff against the last commit, by its absolute path. */
  gitDiff(session: string, file: string) {
    return this.client.request('git/diff', { session, file });
  }

  async stage(session: string, files: string[], staged: boolean) {
    await this.client.request(staged ? 'git/stage' : 'git/unstage', { session, files });
    await this.refreshGit(session);
  }

  async commit(session: string, repo: string, message: string) {
    await this.client.request('git/commit', { session, repo, message });
    await this.refreshGit(session);
  }

  /** A shell in the folder the thread works in, or in the project without one. */
  openTerminal(session: string | undefined, cols: number, rows: number) {
    return this.client.request('terminals/open', { session, cols, rows });
  }

  closeTerminal(terminal: string) {
    return this.client.request('terminals/close', { terminal });
  }

  /** The screen as it is, and the output after it from now on, until `detachTerminal`. */
  attachTerminal(terminal: string) {
    return this.client.request('terminals/attach', { terminal });
  }

  detachTerminal(terminal: string) {
    return this.client.request('terminals/detach', { terminal });
  }

  typeInTerminal(terminal: string, data: string) {
    return this.client.request('terminals/write', { terminal, data });
  }

  resizeTerminal(terminal: string, cols: number, rows: number) {
    return this.client.request('terminals/resize', { terminal, cols, rows });
  }

  /** The addresses the terminals printed whose server answers now. */
  devServers() {
    return this.client.request('preview/servers', {});
  }

  /** The scripts that start a server, in the folder the thread works in. */
  devScripts(session: string | undefined) {
    return this.client.request('preview/scripts', { session });
  }

  private async refreshSaved() {
    this.client.store.set(this.savedAtom, await this.client.request('saved/list', {}));
  }
}
