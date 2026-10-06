import type { AgentBackend } from '../agent/agent.js';
import type { SignInOptions } from '../agent/accounts.js';
import type { LimitWindow } from '../agent/usage.js';
import { errorMessage } from '../lib/errors.js';
import { limitsKey } from '../agent/usage.js';
import { saveAccount } from '../settings/user.js';
import { accountsAtom, identitiesAtom, seenLimitsAtom } from '../state/agent.js';
import { type AppContext, BUSY } from './context.js';

export interface AccountHooks {
  /** After a switch, to read the backend's models and skills again. */
  switched(backend: AgentBackend): void;
  /** Whether a session runs a turn, which a switch waits for. */
  working(): boolean;
  /** Whether the conversation the user looks at has started, so it carries on under the new login. */
  started(): boolean;
}

/**
 * The accounts of the backend the user looks at, or of another one named. A switch happens between turns only, so no
 * request is cut off.
 */
export class AccountController {
  /** The backends whose new login waits for the running turn to end. */
  private readonly loginWaits = new Set<AgentBackend>();

  constructor(
    private readonly context: AppContext,
    private readonly hooks: AccountHooks,
  ) {}

  loadIdentity(backend: AgentBackend) {
    const { store } = this.context;
    const forget = () => store.set(identitiesAtom, ({ [backend.name]: _, ...rest }) => rest);

    forget();
    store.set(accountsAtom, (accounts) => (backend.accounts ? { ...accounts, [backend.name]: backend.accounts.current } : accounts));

    backend.accounts?.active().then((identity) => store.set(identitiesAtom, (identities) => ({ ...identities, [backend.name]: identity })), forget);
  }

  recordLimits(backend: AgentBackend, windows: LimitWindow[]) {
    const { store } = this.context;
    const key = limitsKey(backend.name, store.get(accountsAtom)[backend.name]);

    store.set(seenLimitsAtom, (seen) => ({ ...seen, [key]: { windows, at: Date.now() } }));
  }

  select(name: string, backend = this.context.activeBackend()) {
    const { store, notice } = this.context;
    const accounts = backend.accounts;
    if (!accounts) return notice(`${backend.name} has a single login.`, 'warning');
    if (name === store.get(accountsAtom)[backend.name]) return notice(`Already using the ${name} account.`, 'muted');
    if (this.hooks.working()) return notice(BUSY, 'warning');

    accounts
      .list()
      .then((all) => {
        const target = all.find((candidate) => candidate.name === name);
        if (!target) throw new Error(`there is no account called ${name}. Type /account to see them`);
        if (!target.signedIn) throw new Error(`${name} isn't signed in. Type /account to sign in`);

        return accounts.use(name);
      })
      .then(
        () => {
          saveAccount(backend.name, name);
          this.hooks.switched(backend);

          const carries = this.hooks.started() ? '; the conversation carries on there' : '';

          notice(`Switched to the ${name} account${carries}.`);
        },
        (error: unknown) => notice(`Couldn't switch the account: ${errorMessage(error)}`, 'error'),
      );
  }

  async remove(name: string, backend = this.context.activeBackend()) {
    const { store, notice } = this.context;
    if (!backend.accounts) return notice(`${backend.name} has a single login.`, 'warning');

    try {
      await backend.accounts.remove(name);
    } catch (error) {
      return notice(`Couldn't remove the ${name} account: ${errorMessage(error)}.`, 'error');
    }

    store.set(seenLimitsAtom, ({ [limitsKey(backend.name, name)]: _, ...rest }) => rest);
    notice(`Removed the ${name} account and signed it out. Its conversations stay.`, 'success');
  }

  /** Resolves whether the account is signed in now; a cancelled sign-in says nothing. */
  async signIn(name: string, options: SignInOptions, backend = this.context.activeBackend()) {
    const { notice } = this.context;
    if (!backend.accounts) return false;

    try {
      const account = await backend.accounts.signIn(name, options);
      const as = account.email ? ` as ${account.email}` : '';

      notice(
        !account.signedIn
          ? `${name} isn't signed in yet. Try again from /account.`
          : name === backend.accounts.current
            ? `Signed in to ${name} again${as}. The conversation carries on with the new login.`
            : `Signed in to ${name}${as}. Pick it here to switch.`,
        account.signedIn ? 'success' : 'warning',
      );

      if (account.signedIn) this.signedIn(backend, name);

      return account.signedIn;
    } catch (error) {
      if (!options.signal.aborted) notice(`Couldn't sign in to ${name}: ${errorMessage(error)}`, 'error');

      return false;
    }
  }

  turnEnded() {
    for (const backend of this.loginWaits) this.startWithNewLogin(backend);
  }

  private signedIn(backend: AgentBackend, name: string) {
    if (name !== backend.accounts?.current) return;

    if (this.hooks.working()) this.loginWaits.add(backend);
    else this.startWithNewLogin(backend);
  }

  /** A new login reaches the conversation in a process that starts with it. */
  private startWithNewLogin(backend: AgentBackend) {
    this.loginWaits.delete(backend);

    backend.accounts?.use(backend.accounts.current).then(
      () => this.hooks.switched(backend),
      (error: unknown) => this.context.notice(`Couldn't start over with the new login: ${errorMessage(error)}`, 'error'),
    );
  }
}
