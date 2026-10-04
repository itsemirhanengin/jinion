import type { NoticeTone } from '../conversation/entries.js';
import { promptCount } from '../conversation/entries.js';
import { createWorktree, removeWorktree, type Worktree, worktreeWork, type WorktreeWork } from '../git/worktrees.js';
import { errorMessage } from '../lib/errors.js';
import { plural } from '../lib/format.js';
import { tildify } from '../lib/paths.js';
import { worktreesAtom } from '../state/preferences.js';
import type { SessionContext } from './context.js';
import type { DialogController } from './dialogs.js';

/** What to tell the user once the next conversation shows. */
export interface Left {
  notice?: { text: string; tone: NoticeTone };
}

export class WorktreeController {
  constructor(
    private readonly context: SessionContext,
    private readonly dialogs: DialogController,
  ) {}

  /** The default for new sessions, which `ctrl+g` and `/worktree` change. */
  get on() {
    return this.context.store.get(worktreesAtom);
  }

  get current() {
    return this.context.store.get(this.context.atoms.worktree);
  }

  toggle() {
    this.set(!this.on);
  }

  /** Sets the default, and this conversation's choice while it hasn't started. */
  set(on: boolean) {
    const { store, backend, agent, atoms, notice } = this.context;
    if (!agent.moveTo) return notice(`${backend.name} can't work in another folder, so it can't use worktrees.`, 'warning');

    store.set(worktreesAtom, on);
    if (this.prompts() === 0) store.set(atoms.wantsWorktree, on);

    if (on) {
      const when = this.prompts() > 0 ? 'The next conversation gets' : 'This conversation gets';

      return notice(`Worktrees are on. ${when} its own git worktree with its first message, on a new branch. ctrl+g or /worktree off turns them off.`, 'success');
    }

    const current = this.current;

    notice(
      current
        ? `Worktrees are off from the next conversation. This one stays in its worktree, ${current.name}.`
        : 'Worktrees are off. Conversations work in the project folder.',
      'muted',
    );
  }

  /** Before the first prompt of a conversation goes to the agent, while the turn already shows as running. */
  async prepare() {
    const { agent, atoms, info, notice, store } = this.context;
    if (!store.get(atoms.wantsWorktree) || !agent.moveTo || this.current) return;
    // The prompt that starts the conversation is already in it.
    if (this.prompts() > 1 || store.get(atoms.state).agentSession) return;

    try {
      const worktree = await createWorktree(info.cwd);

      this.dispatch(worktree);
      agent.moveTo(worktree.folder);
      notice(`Working in the worktree ${worktree.name}, on branch ${worktree.branch}, at ${tildify(worktree.path)}.`, 'muted');
    } catch (error) {
      notice(`Couldn't make a worktree, so this conversation works in the project folder: ${errorMessage(error)}`, 'warning');
    }
  }

  /** Before switching away: a worktree nothing changed in goes, one with work is kept or removed as the user says; `undefined` when they cancelled. */
  async leave(): Promise<Left | undefined> {
    const worktree = this.current;
    if (!worktree) return {};

    const work = await worktreeWork(worktree);
    if (work && work.changed === 0 && work.commits === 0) return this.remove(worktree, 'since nothing changed in it');

    const choice = await this.ask(worktree, work);
    if (choice === undefined) return undefined;
    if (choice === 'remove') return this.remove(worktree, 'with the work in it');

    return { notice: { text: `Kept the worktree ${worktree.name}. /resume brings its conversation back to it.`, tone: 'muted' } };
  }

  /** On quit nobody is asked: a worktree with work stays, and the line printed after the screen says where. */
  async quit(): Promise<string | undefined> {
    const worktree = this.current;
    if (!worktree) return undefined;

    const work = await worktreeWork(worktree);

    if (work && work.changed === 0 && work.commits === 0) {
      await removeWorktree(worktree).then(() => this.dispatch(undefined), () => {});

      return undefined;
    }

    return `The worktree ${worktree.name} is kept at ${tildify(worktree.path)}, on branch ${worktree.branch}. jinion --continue goes back to it.`;
  }

  private prompts() {
    return promptCount(this.context.store.get(this.context.atoms.entries));
  }

  /** `undefined` when the user cancelled. */
  private async ask(worktree: Worktree, work: WorktreeWork | undefined) {
    const holds = work
      ? [work.changed > 0 && plural(work.changed, 'changed file'), work.commits > 0 && plural(work.commits, 'commit')].filter(Boolean).join(' and ')
      : 'work that couldn’t be checked';

    const question = {
      id: 'worktree',
      prompt: `The worktree ${worktree.name} has ${holds}. Keep it?`,
      other: false,
      options: [
        { label: 'Keep it', description: `the folder and the branch ${worktree.branch} stay; /resume brings the conversation back to it` },
        { label: 'Remove it', description: 'deletes the folder and the branch, with the work in them' },
      ],
    };

    try {
      const [answer] = await this.dialogs.open({ id: 'ask', questions: [question] });

      return answer?.options[0] === 1 ? 'remove' : 'keep';
    } catch {
      return undefined;
    }
  }

  private async remove(worktree: Worktree, why: string): Promise<Left> {
    try {
      await removeWorktree(worktree);
      this.dispatch(undefined);

      return { notice: { text: `Removed the worktree ${worktree.name} and its branch, ${why}.`, tone: 'muted' } };
    } catch (error) {
      return { notice: { text: `Couldn't remove the worktree ${worktree.name}: ${errorMessage(error)}`, tone: 'error' } };
    }
  }

  private dispatch(worktree: Worktree | undefined) {
    this.context.store.set(this.context.atoms.dispatch, { type: 'worktree', worktree });
  }
}
