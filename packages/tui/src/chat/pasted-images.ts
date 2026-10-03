/** `[Image #1]`. */
export const PASTED_IMAGE = /\[Image #(\d+)\]/g;

export interface ImageData {
  /** e.g. `image/png`. */
  mediaType: string;
  /** Base64. */
  data: string;
}

/**
 * Images in the prompt, which go in as placeholders the way long pastes do. Placeholders stay valid for the life of
 * the store, so prompts recalled from history still carry their images.
 */
export class PastedImages {
  private readonly images = new Map<number, ImageData>();
  private count = 0;

  /** The placeholder to insert for `image`. */
  add(image: ImageData) {
    const id = ++this.count;
    this.images.set(id, image);
    return `[Image #${id}]`;
  }

  /** The images `text` shows placeholders for, once each, in the order they come. */
  in(text: string): ImageData[] {
    const ids = new Set([...text.matchAll(PASTED_IMAGE)].map((match) => Number(match[1])));
    return [...ids].flatMap((id) => this.images.get(id) ?? []);
  }
}
