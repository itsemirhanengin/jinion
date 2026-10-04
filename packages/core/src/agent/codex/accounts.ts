import type { AgentAccount, AgentAccounts, SignInOptions } from '../accounts.js';
import type { CodexConnection } from './connection.js';
import type { Account } from './protocol.js';

const OWN = 'default';

/** Codex keeps one login, its own; signing in again replaces it, in a browser as Codex does. */
export class CodexAccounts implements AgentAccounts {
  readonly current = OWN;

  constructor(private readonly connect: () => CodexConnection) {}

  async active(): Promise<AgentAccount> {
    const { account } = await this.connect().request<{ account: Account | null }>('account/read', {});

    return toAccount(account);
  }

  async list() {
    return [await this.active()];
  }

  async use(name: string) {
    if (name !== OWN) throw new Error('Codex has a single login');
  }

  async signIn(_name: string, { signal, onLink }: SignInOptions) {
    const connection = this.connect();

    const done = new Promise<{ success: boolean; error: string | null }>((resolve) => {
      const stop = connection.onNotification((notification) => {
        if (notification.method !== 'account/login/completed') return;

        stop();
        resolve(notification.params);
      });
    });

    const { loginId, authUrl } = await connection.request<{ loginId: string; authUrl: string }>('account/login/start', { type: 'chatgpt' });
    const cancel = () => void connection.request('account/login/cancel', { loginId }).catch(() => {});

    signal.addEventListener('abort', cancel, { once: true });
    onLink(authUrl);

    try {
      const { success, error } = await done;

      // A sign-in the user cancelled says nothing, as Claude's doesn't.
      signal.throwIfAborted();
      if (!success) throw new Error(error ?? 'the sign-in didn’t finish');
    } finally {
      signal.removeEventListener('abort', cancel);
    }

    return this.active();
  }

  async remove() {
    throw new Error("Codex's own login stays. Sign out with codex logout");
  }
}

function toAccount(account: Account | null): AgentAccount {
  if (!account) return { name: OWN, signedIn: false, own: true };
  if (account.type !== 'chatgpt') return { name: OWN, signedIn: true, plan: account.type === 'apiKey' ? 'API key' : 'Amazon Bedrock', own: true };

  const plan = account.planType.charAt(0).toUpperCase() + account.planType.slice(1);

  return { name: OWN, signedIn: true, email: account.email ?? undefined, plan, own: true };
}
