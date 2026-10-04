/** What a transport hands each message to, in the order they came. */
export interface Receiver {
  message(text: string): void;
  closed(): void;
}

/** Carries text messages to the other side and back: in process, over stdio or over a WebSocket. */
export interface Transport {
  /** Messages that came before go to `receiver` first. */
  start(receiver: Receiver): void;
  send(text: string): void;
  close(): void;
}

/** Two ends that talk to each other in this process, e.g. the terminal app and its own server. */
export function inProcessTransports(): [Transport, Transport] {
  const one = new InProcessTransport();
  const other = new InProcessTransport();

  one.other = other;
  other.other = one;

  return [one, other];
}

class InProcessTransport implements Transport {
  other?: InProcessTransport;
  private receiver?: Receiver;
  private readonly inbox: string[] = [];
  private open = true;

  start(receiver: Receiver) {
    this.receiver = receiver;
    for (const text of this.inbox.splice(0)) receiver.message(text);
    if (!this.open) receiver.closed();
  }

  send(text: string) {
    if (!this.open) throw new Error('The connection is closed.');

    const other = this.other!;

    // Delivered a moment later, as over a wire, so neither side counts on the other answering at once.
    queueMicrotask(() => other.deliver(text));
  }

  close() {
    if (!this.open) return;

    this.open = false;

    queueMicrotask(() => {
      this.receiver?.closed();
      this.other!.ended();
    });
  }

  private deliver(text: string) {
    if (!this.open) return;

    if (this.receiver) this.receiver.message(text);
    else this.inbox.push(text);
  }

  private ended() {
    if (!this.open) return;

    this.open = false;
    this.receiver?.closed();
  }
}
