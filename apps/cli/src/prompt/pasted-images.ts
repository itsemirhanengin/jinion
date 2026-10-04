import type { AgentImage } from '../agent/agent.js';

const PASTED_IMAGE = /\[Image #(\d+)\]/g;

export class PastedImages {
  private readonly images = new Map<number, AgentImage>();
  private count = 0;

  add(image: AgentImage) {
    const id = ++this.count;

    this.images.set(id, image);

    return `[Image #${id}]`;
  }

  in(text: string): AgentImage[] {
    const ids = new Set([...text.matchAll(PASTED_IMAGE)].map((match) => Number(match[1])));

    return [...ids].flatMap((id) => this.images.get(id) ?? []);
  }
}
