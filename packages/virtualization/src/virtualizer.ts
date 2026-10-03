export type ItemKey = string | number;

export interface View {
  height: number;
  /** `undefined` follows the newest row at the bottom. */
  top?: number;
}

export interface Slot {
  key: ItemKey;
  index: number;
  start: number;
  size: number;
  /**
   * `false` for an item never measured while scrolled: it is laid out out of sight first and stands in as empty
   * space, so putting it in place doesn't move what is in view.
   */
  ready: boolean;
}

export interface VirtualWindow {
  before: number;
  after: number;
  slots: Slot[];
  total: number;
  follows: boolean;
  first: number;
  maxTop: number;
}

export interface VirtualizerOptions {
  estimate?: number;
}

export class Virtualizer {
  private readonly heights = new Map<ItemKey, number>();
  private readonly estimate: number;
  private width: number | undefined;

  constructor({ estimate = 2 }: VirtualizerOptions = {}) {
    this.estimate = estimate;
  }

  window(keys: readonly ItemKey[], { height, top }: View): VirtualWindow {
    const sizes = keys.map((key) => this.heights.get(key) ?? this.estimate);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    const maxTop = Math.max(0, total - height);
    const follows = top === undefined;
    const first = Math.min(top ?? maxTop, maxTop);
    const from = first - height;
    const to = first + height + (follows ? 0 : height);

    const slots: Slot[] = [];
    let before = 0;
    let after = 0;
    let start = 0;
    keys.forEach((key, index) => {
      const size = sizes[index]!;
      const end = start + size;
      if (end <= from) before += size;
      else if (start >= to) after += size;
      // Following the newest row, items settle from the bottom up, out of sight above it, so they go straight in.
      else slots.push({ key, index, start, size, ready: follows || this.heights.has(key) });
      start = end;
    });
    return { before, after, slots, total, follows, first, maxTop };
  }

  measure(window: VirtualWindow, measured: ReadonlyMap<ItemKey, number>, width: number) {
    // Heights at another width are of no use: text wraps differently.
    if (width !== this.width) {
      this.heights.clear();
      this.width = width;
    }
    const starts = new Map(window.slots.map((slot) => [slot.key, slot.start]));
    let changed = false;
    let shift = 0;
    for (const [key, height] of measured) {
      const known = this.heights.get(key);
      if (height === known) continue;
      const assumed = known ?? this.estimate;
      const start = starts.get(key);
      if (!window.follows && start !== undefined && start + assumed <= window.first) shift += height - assumed;
      this.heights.set(key, height);
      changed = true;
    }
    return { changed, shift };
  }
}
