import type { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentAccount, AgentAccounts, SignInOptions } from '../accounts.js';
import { accountNames, checkName, DEFAULT_ACCOUNT, planName } from './accounts.js';
import { accountStatus, removeAccount, signIn } from './auth.js';

export interface AccountsOptions {
  account?: string;
  running(): ReturnType<typeof query>;
  onSwitch(): void;
}

export class ClaudeAccounts implements AgentAccounts {
  private name: string;
  private info?: Promise<AgentAccount>;

  constructor(private readonly options: AccountsOptions) {
    const { account } = options;
    this.name = account && accountNames().includes(account) ? account : DEFAULT_ACCOUNT;
  }

  get current() {
    return this.name;
  }

  active() {
    const name = this.name;
    this.info ??= (async () => {
      const info = await this.options.running().accountInfo();
      return {
        name,
        signedIn: info.email !== undefined,
        email: info.email,
        plan: planName(info.subscriptionType),
        organization: info.organization,
      };
    })().catch((error: unknown) => {
      this.info = undefined;
      throw error;
    });
    return this.info;
  }

  list() {
    return Promise.all(accountNames().map(accountStatus));
  }

  async use(name: string) {
    if (!accountNames().includes(name)) throw new Error(`There is no account called ${name}.`);
    // The transcript is shared between accounts, so the conversation goes on under the new login, in a new process.
    this.name = name;
    this.info = undefined;
    this.options.onSwitch();
  }

  signIn(name: string, options: SignInOptions) {
    const problem = checkName(name);
    return problem ? Promise.reject(new Error(problem)) : signIn(name, options);
  }

  async remove(name: string) {
    if (name === this.name) throw new Error('it is in use. Switch to another account first');
    await removeAccount(name);
  }
}
