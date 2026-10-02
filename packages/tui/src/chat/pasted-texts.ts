/** `[Pasted text #1 +42 lines]` or `[Pasted text #2 1200 chars]`. */
export const PASTED_TEXT = /\[Pasted text #(\d+) (?:\+\d+ lines|\d+ chars)\]/g;

/**
 * Keeps long pastes out of the prompt: they go in as a placeholder, and `expand` puts them back when the prompt is
 * sent. Placeholders stay valid for the life of the store, so prompts recalled from history still expand.
 */
export class PastedTexts {
  private readonly texts = new Map<number, string>();
  private count = 0;

  constructor(
    /** Pastes with at least this many lines become placeholders. */
    private readonly minLines = 2,
    /** And so do single lines at least this long. */
    private readonly minLength = 800,
  ) {}

  /** What to insert for `text`: a placeholder for a long paste, the text itself otherwise. */
  add(text: string) {
    const lines = text.split('\n').length;
    if (lines < this.minLines && text.length < this.minLength) return text;
    const id = ++this.count;
    this.texts.set(id, text);
    return lines > 1 ? `[Pasted text #${id} +${lines} lines]` : `[Pasted text #${id} ${text.length} chars]`;
  }

  /** `value` with each placeholder replaced by the text it stands for. */
  expand(value: string) {
    return value.replace(PASTED_TEXT, (placeholder, id: string) => this.texts.get(Number(id)) ?? placeholder);
  }
}
