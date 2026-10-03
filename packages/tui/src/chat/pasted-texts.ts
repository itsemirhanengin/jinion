import { printable } from '../utils/printable.js';

export const PASTED_TEXT = /\[Pasted text #(\d+) (?:\+\d+ lines|\d+ chars)\]/g;

export class PastedTexts {
  private readonly texts = new Map<number, string>();
  private count = 0;

  constructor(
    private readonly minLines = 2,
    private readonly minLength = 800,
  ) {}

  add(text: string) {
    const lines = text.split('\n').length;
    // A tab or a control character would throw the prompt's layout off; as a placeholder, the text goes out as it is.
    if (lines < this.minLines && text.length < this.minLength && printable(text) === text) return text;
    const id = ++this.count;
    this.texts.set(id, text);
    return lines > 1 ? `[Pasted text #${id} +${lines} lines]` : `[Pasted text #${id} ${text.length} chars]`;
  }

  expand(value: string) {
    return value.replace(PASTED_TEXT, (placeholder, id: string) => this.texts.get(Number(id)) ?? placeholder);
  }
}
