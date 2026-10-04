import type { NoticeTone } from '../conversation/entries.js';
import { promptCount } from '../conversation/entries.js';
import type { SavedSession } from '../conversation/session.js';
import { createWorktree, removeWorktree, type Worktree, worktreeExists, worktreeWork, type WorktreeWork } from '../git/worktrees.js';
import { errorMessage } from '../lib/errors.js';
import { plural } from '../lib/format.js';
import { tildify } from '../lib/paths.js';
import { worktreesAtom } from '../state/preferences.js';
import { dispatchAtom, sessionAtom } from '../state/session.js';
import type { Context } from './context.js';

/** What to tell the user once the next conversation shows. */
export interface Left {
  notice?: { text: string; tone: NoticeTone };
}

export class WorktreeController {
  constructor(private readonly context: Context) {}

  get on() {
    return this.context.store.get(worktreesAtom);
  }

  get current() {
    return this.context.store.get(sessionAtom).worktree;
  }

  toggle() {
    this.set(!this.on);
  }

  set(on: boolean) {
    const { store, backend, agent, notice } = this.context;
    if (!agent.reset) return notice(`${backend.name} can't work in another folder, so it can't use worktrees.`, 'warning');

    store.set(worktreesAtom, on);

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
    const { agent, info, notice } = this.context;
    // The prompt that starts the conversation is already in it.
    if (!this.on || !agent.reset || this.current || this.prompts() > 1 || this.context.store.get(sessionAtom).agentSession) return;

    try {
      const worktree = await createWorktree(info.cwd);

      this.dispatch(worktree);
      agent.reset(undefined, worktree.folder);
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

  /** Where a resumed conversation works; its worktree, unless that is gone. */
  folderOf(saved: SavedSession) {
    const worktree = saved.worktree;
    if (!worktree) return undefined;
    if (worktreeExists(worktree)) return worktree.folder;

    this.dispatch(undefined);
    this.context.notice(`Your worktree ${tildify(worktree.path)} no longer exists. The conversation continues in the project folder.`, 'warning');

    return undefined;
  }

  private prompts() {
    return promptCount(this.context.store.get(sessionAtom).entries);
  }

  private ask(worktree: Worktree, work: WorktreeWork | undefined) {
    const holds = work
      ? [work.changed > 0 && plural(work.changed, 'changed file'), work.commits > 0 && plural(work.commits, 'commit')].filter(Boolean).join(' and ')
      : 'work that couldn’t be checked';

    return new Promise<'keep' | 'remove' | undefined>((resolve) => {
      this.context.screen.showDialog({
        id: 'ask',
        questions: [
          {
            id: 'worktree',
            prompt: `The worktree ${worktree.name} has ${holds}. Keep it?`,
            other: false,
            options: [
              { label: 'Keep it', description: `the folder and the branch ${worktree.branch} stay; /resume brings the conversation back to it` },
              { label: 'Remove it', description: 'deletes the folder and the branch, with the work in them' },
            ],
          },
        ],
        onSubmit: ([answer]) => {
          this.context.screen.closeDialog('ask');
          resolve(answer?.options[0] === 1 ? 'remove' : 'keep');
        },
        onCancel: () => {
          this.context.screen.closeDialog('ask');
          resolve(undefined);
        },
      });
    });
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
    this.context.store.set(dispatchAtom, { type: 'worktree', worktree });
  }
}
