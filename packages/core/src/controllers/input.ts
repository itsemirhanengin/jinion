import type { CommandRegistry } from '../commands/registry.js';
import { historyAtom } from '../state/prompt.js';
import { skillsAtom } from '../state/agent.js';
import type { Attachments } from './attachments.js';
import type { SessionContext } from './context.js';
import type { Jinion } from './jinion.js';
import type { TurnController } from './turns.js';

/** What the user types into one session's prompt. */
export class InputController {
  constructor(
    private readonly context: SessionContext,
    private readonly jinion: Jinion,
    private readonly commands: CommandRegistry,
    private readonly attachments: Attachments,
    private readonly turns: TurnController,
  ) {}

  submit(value: string) {
    const { store, atoms, notice } = this.context;
    const text = value.trim();
    if (!text) return;

    this.sent(text);
    if (!text.startsWith('/')) return this.turns.working ? this.turns.steer(text) : void this.turns.prompt(text);

    const [name = '', ...args] = text.slice(1).split(/\s+/);
    const command = this.commands.find(name);

    if (!command && store.get(skillsAtom).some((skill) => skill.name === name)) {
      // Typed out of habit: it goes back in the prompt the new way, to send as it is or to add to.
      store.set(atoms.draft, `$${text.slice(1)}`);

      return notice(`Skills go after $ now, anywhere in the message: $${name}. Press enter to send it.`, 'muted');
    }

    if (!command) return notice(`Unknown command /${name}. Type / to see what is available.`, 'error');

    command.run(this.jinion, this.attachments.texts.expand(args.join(' ')));
  }

  queue() {
    const { store, atoms } = this.context;
    const text = store.get(atoms.draft).trim();
    if (!text) return;
    if (!store.get(atoms.busy)) return this.submit(text);

    this.sent(text);
    this.turns.enqueue(text);
  }

  fill(text: string) {
    this.context.store.set(this.context.atoms.draft, text);
  }

  clear() {
    const draft = this.context.store.get(this.context.atoms.draft);

    if (draft) this.sent(draft);
  }

  private sent(text: string) {
    this.context.store.set(this.context.atoms.draft, '');
    this.context.store.set(historyAtom, (history) => [...history, text]);
  }
}
