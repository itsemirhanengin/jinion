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
    const { agent, store } = this.context;

    store.set(identityAtom, undefined);

    agent.accounts?.active().then(
      (identity) => store.set(identityAtom, identity),
      () => store.set(identityAtom, undefined),
    );
  }

  recordLimits(windows: LimitWindow[]) {
    const { agent, store } = this.context;
    const key = limitsKey(agent.name, store.get(accountAtom));

    store.set(seenLimitsAtom, (seen) => ({ ...seen, [key]: { windows, at: Date.now() } }));
  }

  select(name: string) {
    const { agent, store, notice } = this.context;
    const accounts = agent.accounts;
    if (!accounts) return notice(`${agent.name} has a single login.`, 'warning');
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
          saveAccount(agent.name, name);
          this.switched();

          const carries = store.get(sessionAtom).agentSession ? '; the conversation carries on there' : '';

          notice(`Switched to the ${name} account${carries}.`);
        },
        (error: unknown) => notice(`Couldn't switch the account: ${errorMessage(error)}`, 'error'),
      );
  }

  async remove(name: string) {
    const { agent, store, notice } = this.context;
    if (!agent.accounts) return notice(`${agent.name} has a single login.`, 'warning');

    try {
      await agent.accounts.remove(name);
    } catch (error) {
      return notice(`Couldn't remove the ${name} account: ${errorMessage(error)}.`, 'error');
    }

    store.set(seenLimitsAtom, ({ [limitsKey(agent.name, name)]: _, ...rest }) => rest);
    notice(`Removed the ${name} account and signed it out. Its conversations stay.`, 'success');
  }

  signedIn(name: string) {
    if (name !== this.context.agent.accounts?.current) return;

    if (this.context.store.get(workingAtom)) this.loginWaits = true;
    else this.startWithNewLogin();
  }

  turnEnded() {
    if (this.loginWaits) this.startWithNewLogin();
  }

  /** A new login reaches the conversation in a process that starts with it. */
  private startWithNewLogin() {
    const { agent, notice } = this.context;

    this.loginWaits = false;

    agent.accounts?.use(agent.accounts.current).then(this.switched, (error: unknown) =>
      notice(`Couldn't start over with the new login: ${errorMessage(error)}`, 'error'),
    );
  }
}
