import type { AgentPrompt } from '../agent/agent.js';
import { errorMessage } from '../lib/errors.js';
import { clipboardImage, imageFromPaste } from '../prompt/images.js';
import { PastedImages } from '../prompt/pasted-images.js';
import { PastedTexts } from '../prompt/pasted-texts.js';
import type { AppContext } from './context.js';

/** Kept for the whole run, so a message recalled from history still carries its pastes and images. */
export class Attachments {
  readonly texts = new PastedTexts();
  readonly images = new PastedImages();

  constructor(private readonly context: Pick<AppContext, 'notice'>) {}

  resolve(text: string): AgentPrompt {
    return { text: this.texts.expand(text), images: this.images.in(text) };
  }

  pastePath(text: string) {
    try {
      const image = imageFromPaste(text);

      return image && this.images.add(image);
    } catch (error) {
      this.context.notice(errorMessage(error), 'warning');

      return undefined;
    }
  }

  async pasteClipboard() {
    try {
      const image = await clipboardImage();
      if (image) return this.images.add(image);

      this.context.notice('There is no image on the clipboard. Text pastes with your terminal’s paste, e.g. cmd+v.', 'muted');
    } catch (error) {
      this.context.notice(errorMessage(error), 'warning');
    }

    return undefined;
  }
}
