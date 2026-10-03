export interface AgentAccount {
  name: string;
  signedIn: boolean;
  email?: string;
  plan?: string;
  organization?: string;
  /** The backend's own login: it can sign in again, but isn't removed. */
  own?: boolean;
}

export function accountLabel(account: AgentAccount) {
  const shared = account.plan === 'Team' || account.plan === 'Enterprise';
  const who = shared ? (account.organization ?? account.email) : (account.email ?? account.organization);
  return [who, account.plan].filter(Boolean).join(' · ');
}

export interface AgentAccounts {
  readonly current: string;
  active(): Promise<AgentAccount>;
  list(): Promise<AgentAccount[]>;
  /** Takes effect from the next request; a conversation in progress carries on. */
  use(name: string): Promise<void>;
  /** Adds the account when it is new and replaces its login when it isn't. */
  signIn(name: string, options: SignInOptions): Promise<AgentAccount>;
  /** Not the one in use, nor the backend's own login. */
  remove(name: string): Promise<void>;
}

export interface SignInOptions {
  signal: AbortSignal;
  onLink(url: string): void;
  /** `problem` says why it asks again, e.g. a code that didn't work. */
  onPrompt(prompt: string, answer: (text: string) => void, problem?: string): void;
}
