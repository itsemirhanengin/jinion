export const PASTED_IMAGE = /\[Image #(\d+)\]/g;

export interface ImageData {
  mediaType: string;
  data: string;
}

export class PastedImages {
  private readonly images = new Map<number, ImageData>();
  private count = 0;

  add(image: ImageData) {
    const id = ++this.count;

    this.images.set(id, image);

    return `[Image #${id}]`;
  }

  in(text: string): ImageData[] {
    const ids = new Set([...text.matchAll(PASTED_IMAGE)].map((match) => Number(match[1])));

    return [...ids].flatMap((id) => this.images.get(id) ?? []);
  }
}
