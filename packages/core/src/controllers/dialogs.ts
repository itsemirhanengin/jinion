import type { Dialog, DialogAnswer, DialogAnswers } from '../conversation/dialogs.js';
import type { SessionContext } from './context.js';

export class DialogCancelled extends Error {
  constructor() {
    super('The user cancelled the dialog.');
  }
}

interface Pending {
  resolve(answer: DialogAnswer): void;
  reject(error: unknown): void;
}

/** What a session asks the user, one dialog at a time, since parallel tool calls can ask at once. */
export class DialogController {
  private line: Promise<void> = Promise.resolve();
  private pending?: Pending;

  constructor(private readonly context: SessionContext) {}

  /** Shows `dialog` once those before it are answered. Rejects with `DialogCancelled`, or with `signal`'s reason. */
  open<K extends Dialog['id']>(dialog: Extract<Dialog, { id: K }>, { message, signal }: { message?: string; signal?: AbortSignal } = {}) {
    const show = () =>
      new Promise<DialogAnswers[K]>((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);

        const aborted = () => this.take()?.reject(signal!.reason);

        signal?.addEventListener('abort', aborted, { once: true });

        const settled = () => signal?.removeEventListener('abort', aborted);

        this.pending = {
          resolve: (answer) => {
            settled();
            resolve(answer as DialogAnswers[K]);
          },
          reject: (error) => {
            settled();
            reject(error);
          },
        };

        this.context.store.set(this.context.atoms.dialog, dialog);
        if (message) this.context.notify(message);
      });

    const result = this.line.then(show);

    this.line = result.then(
      () => {},
      () => {},
    );

    return result;
  }

  /** Answers the dialog that shows; the client knows which one it drew. */
  answer(answer: DialogAnswer) {
    this.take()?.resolve(answer);
  }

  cancel() {
    this.take()?.reject(new DialogCancelled());
  }

  private take() {
    const pending = this.pending;

    this.pending = undefined;
    this.context.store.set(this.context.atoms.dialog, undefined);

    return pending;
  }
}
