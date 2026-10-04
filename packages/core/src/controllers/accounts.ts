import type { SignInOptions } from '../agent/accounts.js';
import type { LimitWindow } from '../agent/usage.js';
import { errorMessage } from '../lib/errors.js';
import { limitsKey } from '../settings/limits.js';
import { saveAccount } from '../settings/user.js';
import { accountAtom, identityAtom, seenLimitsAtom } from '../state/agent.js';
import { sessionAtom } from '../state/session.js';
import { workingAtom } from '../state/turn.js';
import { BUSY, type Context } from './context.js';

/** A switch happens between turns only, so no request is cut off. */
export class AccountController {
  private loginWaits = false;

  constructor(
    private readonly context: Context,
    private readonly switched: () => void,
  ) {}

  loadIdentity() {
    const { backend, store } = this.context;

    store.set(identityAtom, undefined);

    backend.accounts?.active().then(
      (identity) => store.set(identityAtom, identity),
      () => store.set(identityAtom, undefined),
    );
  }

  recordLimits(windows: LimitWindow[]) {
    const { backend, store } = this.context;
    const key = limitsKey(backend.name, store.get(accountAtom));

    store.set(seenLimitsAtom, (seen) => ({ ...seen, [key]: { windows, at: Date.now() } }));
  }

  select(name: string) {
    const { backend, store, notice } = this.context;
    const accounts = backend.accounts;
    if (!accounts) return notice(`${backend.name} has a single login.`, 'warning');
    if (name === store.get(accountAtom)) return notice(`Already using the ${name} account.`, 'muted');
    if (store.get(workingAtom)) return notice(BUSY, 'warning');

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
          store.set(accountAtom, name);
          saveAccount(backend.name, name);
          this.switched();

          const carries = store.get(sessionAtom).agentSession ? '; the conversation carries on there' : '';

          notice(`Switched to the ${name} account${carries}.`);
        },
        (error: unknown) => notice(`Couldn't switch the account: ${errorMessage(error)}`, 'error'),
      );
  }

  async remove(name: string) {
    const { backend, store, notice } = this.context;
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
  async signIn(name: string, options: SignInOptions) {
    const { backend, store, notice } = this.context;
    if (!backend.accounts) return false;

    try {
      const account = await backend.accounts.signIn(name, options);
      const as = account.email ? ` as ${account.email}` : '';

      notice(
        !account.signedIn
          ? `${name} isn't signed in yet. Try again from /account.`
          : name === store.get(accountAtom)
            ? `Signed in to ${name} again${as}. The conversation carries on with the new login.`
            : `Signed in to ${name}${as}. Pick it here to switch.`,
        account.signedIn ? 'success' : 'warning',
      );

      if (account.signedIn) this.signedIn(name);

      return account.signedIn;
    } catch (error) {
      if (!options.signal.aborted) notice(`Couldn't sign in to ${name}: ${errorMessage(error)}`, 'error');

      return false;
    }
  }

  turnEnded() {
    if (this.loginWaits) this.startWithNewLogin();
  }

  private signedIn(name: string) {
    if (name !== this.context.backend.accounts?.current) return;

    if (this.context.store.get(workingAtom)) this.loginWaits = true;
    else this.startWithNewLogin();
  }

  /** A new login reaches the conversation in a process that starts with it. */
  private startWithNewLogin() {
    const { backend, notice } = this.context;

    this.loginWaits = false;

    backend.accounts?.use(backend.accounts.current).then(this.switched, (error: unknown) =>
      notice(`Couldn't start over with the new login: ${errorMessage(error)}`, 'error'),
    );
  }
}
