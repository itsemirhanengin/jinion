import type { CommandRegistry } from '../commands/registry.js';
import { promptOf, type Submission } from '../prompt/submission.js';
import { skillsAtom } from '../state/agent.js';
import type { SessionContext } from './context.js';
import type { Jinion } from './jinion.js';
import type { TurnController } from './turns.js';

/** What the user sends from one session's prompt. */
export class InputController {
  constructor(
    private readonly context: SessionContext,
    private readonly jinion: Jinion,
    private readonly commands: CommandRegistry,
    private readonly turns: TurnController,
  ) {}

  submit(submission: Submission) {
    const { store, backend, notice, fillPrompt } = this.context;
    const text = submission.text.trim();
    if (!text) return;
    if (!text.startsWith('/')) return this.turns.working ? this.turns.steer(submission) : void this.turns.prompt(submission);

    const [name = ''] = text.slice(1).split(/\s+/, 1);
    const command = this.commands.find(name);

    if (!command && store.get(skillsAtom)[backend.name]?.some((skill) => skill.name === name)) {
      // Typed out of habit: it goes back in the prompt the new way, to send as it is or to add to.
      fillPrompt(`$${text.slice(1)}`, 'replace');

      return notice(`Skills go after $ now, anywhere in the message: $${name}. Press enter to send it.`, 'muted');
    }

    if (!command) return notice(`Unknown command /${name}. Type / to see what is available.`, 'error');

    command.run(this.jinion, promptOf(submission).text.trim().slice(name.length + 1).trim());
  }

  /** Sent at once when nothing runs; otherwise after the turn, as `ctrl+q` does. */
  queue(submission: Submission) {
    if (!submission.text.trim()) return;
    if (!this.context.store.get(this.context.atoms.busy)) return this.submit(submission);

    this.turns.enqueue(submission);
  }
}
