import type { AgentMode, PlanDecision } from '@jinion/core/agent/agent';
import type { ModelSelection } from '@jinion/core/agent/models';
import type { PermissionDecision } from '@jinion/core/agent/permissions';
import type { QuestionAnswer } from '@jinion/core/agent/questions';
import { JinionClient } from '@jinion/core/api/client';
import { portTransport } from '@jinion/core/api/port-transport';
import type { MemoryNote, SavedSummary } from '@jinion/core/api/schemas';
import { atom } from 'jotai';
import type { RecentProject } from '../../main/bridge.js';
import { waitForPort } from './port.js';

export interface CoreScreen {
  notify(title: string, body: string): void;
  fillPrompt(session: string, text: string): void;
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
  /** Set when the core stopped, so the window can say so instead of waiting. */
  readonly goneAtom = atom(false);
  /** Why the last call the user made failed, such as a thread another Jinion has open; shown until dismissed. */
  readonly problemAtom = atom<string | undefined>(undefined);
  /** Prompts to start with, which the demo backend has. */
  examples: string[] = [];
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
        view: () => {},
        fillPrompt: (session, text) => screen.fillPrompt(session, text),
        notify: (title, body) => screen.notify(title, body),
        expand: () => {},
        exit: () => {},
      },
    });

    this.client.store.sub(this.client.sessionsAtom, () => void this.refreshSaved());
  }

  /** Opens the folder's core, starting it when it isn't running, and follows every session open in it. */
  static async open(path: string, screen: CoreScreen) {
    const port = waitForPort(path);
    const [project, version] = await Promise.all([window.desktop.openProject(path), window.desktop.version()]);
    const core = new Core(project, await port, version, screen);
    const { info } = await core.client.initialize();

    core.examples = info.examples ?? [];
    void core.refreshSaved();

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
  submit(session: string, text: string) {
    return this.client.request('session/submit', { session, text });
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

  private async refreshSaved() {
    this.client.store.set(this.savedAtom, await this.client.request('saved/list', {}));
  }
}
