import * as Notifications from 'expo-notifications';
import { computeReminders } from '@drfocus/domain';
import * as repo from '@/db/repo';

export const CHANNEL_ID = 'recordatorios';
export const HORIZON_DAYS = 7;
export const MAX_REMINDERS = 48;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function ensureChannel() {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios',
    description: 'Avisos de tus objetivos de Doctor Focus',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#1FA39C',
  });
}

export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<boolean> {
  await ensureChannel();
  const p = await Notifications.requestPermissionsAsync();
  return p.granted;
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Reprogramación completa y serializada (TECH_SPEC §8): cancela todo, calcula los próximos 7 días
 * desde SQLite y programa hasta 48 avisos. Si algo falla, la siguiente llamada lo corrige.
 */
export function rescheduleReminders(): Promise<{ count: number; coveredUntil: string | null }> {
  const run = chain.then(doReschedule, doReschedule);
  chain = run.catch(() => undefined);
  return run;
}

async function doReschedule() {
  const prefs = repo.getPrefs();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs || !prefs.remindersEnabled || (await permissionStatus()) !== 'granted') {
    repo.replaceScheduledReminders([]);
    repo.updatePrefs({ remindersCoveredUntil: null });
    return { count: 0, coveredUntil: null };
  }
  await ensureChannel();
  const now = new Date().toISOString();
  const { rows, sessions } = repo.reminderSources();
  const dayStarts: Record<number, string> = {};
  for (const r of repo.getRules()) if (!dayStarts[r.weekday] || r.startLocal < dayStarts[r.weekday]!) dayStarts[r.weekday] = r.startLocal;

  const plans = computeReminders({
    now,
    timezone: prefs.timezone,
    objectives: rows.map(({ o, a }) => ({ id: o.id, activityId: a.id, activityTitle: a.title, title: o.title, dueAt: o.dueAt, status: o.status, planRevision: a.revision })),
    sessions: sessions.map((x) => ({ objectiveId: x.objectiveId, startsAt: x.startsAt })),
    dayStarts,
    quietStart: prefs.quietStart,
    quietEnd: prefs.quietEnd,
    dailyCap: prefs.dailyCap,
    horizonDays: HORIZON_DAYS,
    max: MAX_REMINDERS,
  });

  const stored: { nativeId: string; activityId: string; objectiveId: string | null; kind: string; fireAt: string }[] = [];
  for (const p of plans) {
    const nativeId = await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: p.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(p.fireAt), channelId: CHANNEL_ID },
    });
    stored.push({ nativeId, activityId: p.activityId, objectiveId: p.objectiveId, kind: p.kind, fireAt: p.fireAt });
  }
  repo.replaceScheduledReminders(stored);
  const coveredUntil = new Date(Date.parse(now) + HORIZON_DAYS * 86_400_000).toISOString();
  repo.updatePrefs({ remindersCoveredUntil: coveredUntil });
  return { count: stored.length, coveredUntil };
}
