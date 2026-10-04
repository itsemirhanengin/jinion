import { createContext, useContext } from 'react';
import { PastedImages, PastedTexts } from '@jinion/tui/chat';
import type { NoticeTone } from '@jinion/core/conversation/entries';
import { errorMessage } from '@jinion/core/lib/errors';
import type { Submission } from '@jinion/core/prompt/submission';
import { clipboardImage, imageFromPaste } from './images.js';

/**
 * What was pasted into the prompt, shown there as placeholders. Kept for the whole run, so a message recalled from
 * history still carries its pastes and images.
 */
export class Attachments {
  readonly texts = new PastedTexts();
  readonly images = new PastedImages();

  constructor(private readonly notice: (text: string, tone: NoticeTone) => void) {}

  /** `text` as typed, with what goes to the agent when the pastes in it make that differ. */
  submission(text: string): Submission {
    const expanded = this.texts.expand(text);
    const images = this.images.in(text);

    return expanded === text && images.length === 0 ? { text } : { text, prompt: { text: expanded, images } };
  }

  pastePath(text: string) {
    try {
      const image = imageFromPaste(text);

      return image && this.images.add(image);
    } catch (error) {
      this.notice(errorMessage(error), 'warning');

      return undefined;
    }
  }

  async pasteClipboard() {
    try {
      const image = await clipboardImage();
      if (image) return this.images.add(image);

      this.notice('There is no image on the clipboard. Text pastes with your terminal’s paste, e.g. cmd+v.', 'muted');
    } catch (error) {
      this.notice(errorMessage(error), 'warning');
    }

    return undefined;
  }
}

export const AttachmentsContext = createContext<Attachments | undefined>(undefined);

export function useAttachments() {
  const attachments = useContext(AttachmentsContext);
  if (!attachments) throw new Error('useAttachments() must be called inside <App>.');

  return attachments;
}
