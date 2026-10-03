export type ItemKey = string | number;

/** A view onto items stacked top to bottom, counted in rows. */
export interface View {
  /** Rows in view. */
  height: number;
  /** The first row in view, counted from the top of all items; `undefined` follows the newest row at the bottom. */
  top?: number;
}

/** Where one item goes. */
export interface Slot {
  key: ItemKey;
  index: number;
  /** The item's first row, counted from the top of all items. */
  start: number;
  /** Its height: as measured, or the estimate until it is. */
  size: number;
  /**
   * `false` for an item never measured while the view is scrolled: it is laid out out of sight first and stands in as
   * `size` rows of empty space, so that putting it in place doesn't move what is in view.
   */
  ready: boolean;
}

/** The items to mount for a view: those in it and a screen around it. The rest stand in as empty space. */
export interface VirtualWindow {
  /** Rows of the items before the first slot and after the last one. */
  before: number;
  after: number;
  slots: Slot[];
  /** Rows of all items, measured or estimated. */
  total: number;
  /** Whether the view follows the newest row. */
  follows: boolean;
  /** The first row in view: `top` within bounds, or the one that shows the newest row last. */
  first: number;
  /** The largest `top` there is; further down, the view follows the newest row. */
  maxTop: number;
}

export interface VirtualizerOptions {
  /** Rows an item is taken to have until it is measured. */
  estimate?: number;
}

/**
 * Decides which of many items of different heights to mount, and keeps the view still as their heights become known.
 * It knows nothing of how items are drawn: the renderer lays out what `window` asks for, then hands the heights it got
 * to `measure`.
 */
export class Virtualizer {
  private readonly heights = new Map<ItemKey, number>();
  private readonly estimate: number;
  private width: number | undefined;

  constructor({ estimate = 2 }: VirtualizerOptions = {}) {
    this.estimate = estimate;
  }

  /** The items in view and a screen above it, and below it too unless the view follows the newest row. */
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

  /**
   * Takes the heights the renderer laid out the items of `window` at, `width` columns wide. Says whether any changed,
   * so the window is worked out again, and how many rows the view has to move to keep still: an item above it that
   * turned out taller or shorter than it was taken to be moves everything below it.
   */
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
