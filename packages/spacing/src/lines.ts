export class Lines {
  private readonly starts: number[] = [0];

  constructor(source: string) {
    for (let index = 0; index < source.length; index++) {
      if (source[index] === '\n') this.starts.push(index + 1);
    }
  }

  /** The zero-based line `offset` is on. */
  of(offset: number) {
    let low = 0;
    let high = this.starts.length - 1;

    while (low < high) {
      const middle = (low + high + 1) >> 1;

      if (this.starts[middle]! <= offset) low = middle;
      else high = middle - 1;
    }

    return low;
  }
}
