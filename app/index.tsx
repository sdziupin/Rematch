import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { getProfile } from '../src/db/repository';
import { getActiveSession } from '../src/services/sessionService';

export default function Index() {
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const active = await getActiveSession();
      const profile = await getProfile();
      const next: Href = active ? '/workout/recovery' : !profile?.onboardingComplete ? '/onboarding' : '/today';
      if (!cancelled) setTarget(next);
    })().catch(() => {
      if (!cancelled) setTarget('/today');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}
