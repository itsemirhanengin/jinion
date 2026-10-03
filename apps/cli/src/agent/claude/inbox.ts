/** A queue read with `for await`, which waits for the next item until it is closed. */
export class Inbox<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private wake?: () => void;
  private closed = false;

  push(item: T) {
    this.items.push(item);
    this.wake?.();
  }

  close() {
    this.closed = true;
    this.wake?.();
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      const item = this.items.shift();
      if (item !== undefined) {
        yield item;
        continue;
      }
      if (this.closed) return;
      await new Promise<void>((resolve) => (this.wake = resolve));
      this.wake = undefined;
    }
  }
}
