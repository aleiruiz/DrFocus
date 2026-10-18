import type { ObjectiveStatus } from '@drfocus/contracts';

export interface TodayObjective {
  id: string;
  activityId: string;
  status: ObjectiveStatus;
  dueAt: string | null;
  orderIndex: number;
  blocked: boolean;
  nextSessionAt: string | null;
}

/**
 * Organiza «Hoy» (WORK_PLAN §6, punto 10): el siguiente objetivo elegible, lo programado hoy y los vencidos,
 * sin llenar el día automáticamente con todos los atrasos.
 */
export function organizeToday<T extends TodayObjective>(items: readonly T[], nowMs: number, endOfDayMs: number) {
  const pending = items.filter((o) => o.status === 'todo' || o.status === 'in_progress');
  const overdue = pending.filter((o) => o.dueAt && Date.parse(o.dueAt) < nowMs);
  const today = pending.filter((o) => !overdue.includes(o) && o.nextSessionAt && Date.parse(o.nextSessionAt) <= endOfDayMs);
  const eligible = pending
    .filter((o) => !o.blocked)
    .sort((a, b) => key(a) - key(b) || a.orderIndex - b.orderIndex);
  // Lo atrasado se ofrece aparte; el siguiente paso es el próximo a tiempo, si existe.
  const next = eligible.find((o) => !overdue.includes(o)) ?? eligible[0] ?? null;
  return { next, today: today.filter((o) => o !== next), overdue: overdue.filter((o) => o !== next) };
}

const key = (o: TodayObjective) => (o.nextSessionAt ? Date.parse(o.nextSessionAt) : o.dueAt ? Date.parse(o.dueAt) : Number.MAX_SAFE_INTEGER);
