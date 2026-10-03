import { accountLabel, type AgentAccount } from '../../agent/accounts.js';
import { ago } from '../../lib/format.js';
import type { SeenLimit } from '../../settings/limits.js';

export function describeAccount(account: AgentAccount, seen: SeenLimit | undefined) {
  if (!account.signedIn) return 'Not signed in; press enter to sign in';
  // The email is in the label for a personal plan; a shared one shows it next to the organization.
  const shared = account.plan === 'Team' || account.plan === 'Enterprise';
  const who = [accountLabel(account), shared ? account.email : undefined].filter(Boolean).join(' · ');
  if (!seen) return who;
  const usage = seen.windows.map((window) => `${window.label} ${Math.round(window.used * 100)}%`).join(' · ');
  return `${who} · ${usage} ${ago(seen.at)}`;
}
