import type { ObjectiveStatus } from '@drfocus/contracts';

export interface ObjectiveLike {
  id: string;
  status: ObjectiveStatus;
  dueAt: string | null;
  estimatedMinutes: number;
  remainingMinutes: number;
}

/** Progreso = completados / objetivos no omitidos (TECH_SPEC §5). */
export function progress(objectives: readonly Pick<ObjectiveLike, 'status'>[]): { done: number; total: number; ratio: number } {
  const counted = objectives.filter((o) => o.status !== 'skipped');
  const done = counted.filter((o) => o.status === 'completed').length;
  return { done, total: counted.length, ratio: counted.length ? done / counted.length : 0 };
}

export const isPending = (o: Pick<ObjectiveLike, 'status'>) => o.status === 'todo' || o.status === 'in_progress';

/** «Vencido» es derivado del reloj, no un estado guardado. */
export const isOverdue = (o: Pick<ObjectiveLike, 'status' | 'dueAt'>, nowMs: number) =>
  isPending(o) && o.dueAt !== null && Date.parse(o.dueAt) < nowMs;

/** «Bloqueado» es derivado: alguna dependencia sigue pendiente. */
export function isBlocked(
  objectiveId: string,
  deps: readonly { objectiveId: string; dependsOnId: string }[],
  statusById: ReadonlyMap<string, ObjectiveStatus>,
): boolean {
  return deps.some((d) => d.objectiveId === objectiveId && isPending({ status: statusById.get(d.dependsOnId) ?? 'completed' }));
}

/** Una actividad se completa solo cuando todos sus objetivos no omitidos terminaron. */
export const canCompleteActivity = (objectives: readonly Pick<ObjectiveLike, 'status'>[]) =>
  objectives.length > 0 && objectives.every((o) => o.status === 'completed' || o.status === 'skipped');

/** Registrar avance: actualiza minutos restantes sin completar el objetivo. */
export function logProgress(o: Pick<ObjectiveLike, 'remainingMinutes' | 'status'>, minutesLeft: number) {
  const remainingMinutes = Math.max(0, Math.round(minutesLeft));
  return { remainingMinutes, status: remainingMinutes === 0 ? ('completed' as const) : ('in_progress' as const) };
}
