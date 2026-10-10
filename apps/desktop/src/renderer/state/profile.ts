import type { UsageProfile } from '@jinion/core/agent/usage';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { useCore } from './session.js';

/** The user as Jinion knows them, read once a component asks: their name, and what they did with every backend over time. */
export function useProfile() {
  const core = useCore();
  const app = useAtomValue(core.appAtom);

  const [profile, setProfile] = useState<{ name?: string; usage: UsageProfile }>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    core.client.request('profile/read', {}).then(setProfile, (error: Error) => setProblem(error.message));
  }, [core]);

  const email = Object.values(app?.identities ?? {}).find((identity) => identity.email)?.email;
  const name = profile?.name ?? email?.split('@')[0] ?? 'You';

  return { name, email, usage: profile?.usage, problem };
}
