import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { getProfile } from '../src/db/seed';
import { getActiveSession } from '../src/services/sessionService';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const active = await getActiveSession();
      if (active) {
        setTarget('/workout/recovery');
        return;
      }
      const profile = await getProfile();
      if (!profile?.onboardingComplete) {
        setTarget('/onboarding');
        return;
      }
      setTarget('/(tabs)/today');
    })();
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}
