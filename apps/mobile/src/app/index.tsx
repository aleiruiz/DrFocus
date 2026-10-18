import { Redirect } from 'expo-router';
import * as repo from '@/db/repo';
import { ONBOARDING_VERSION } from '@/lib/constants';

export default function Index() {
  const prefs = repo.getPrefs();
  if (!prefs || prefs.onboardingVersion < ONBOARDING_VERSION) return <Redirect href="/onboarding" />;
  return <Redirect href="/today" />;
}
