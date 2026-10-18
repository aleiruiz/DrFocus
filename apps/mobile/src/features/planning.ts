import type { ObjectiveDraft } from '@drfocus/contracts';
import { toPlannerObjectives } from '@drfocus/domain';
import { planSchedule, type PlannerOutput } from '@drfocus/planner';
import * as repo from '@/db/repo';

/** Calcula el calendario de una actividad con la disponibilidad y las sesiones de las demás. */
export function schedulePlan(activityId: string, objectives: ObjectiveDraft[], nowIso = new Date().toISOString()): PlannerOutput {
  const prefs = repo.getPrefs();
  const activity = repo.getActivity(activityId);
  if (!prefs || !activity) throw new Error('Faltan datos para planear');
  const rules = repo.getRules().map((r) => ({ weekday: r.weekday, startLocal: r.startLocal, endLocal: r.endLocal }));
  return planSchedule({
    now: nowIso,
    timezone: prefs.timezone,
    rules,
    busy: repo.busySessionsExcept(activityId),
    objectives: toPlannerObjectives(objectives),
    deadlineAt: activity.deadlineAt,
    preferredBlockMinutes: prefs.preferredBlockMinutes,
  });
}

/** Guarda la propuesta inicial como borrador y devuelve el id de la actividad para la vista previa. */
export function proposeInitialPlan(activityId: string, objectives: ObjectiveDraft[], assumptions: string[] = []) {
  const schedule = schedulePlan(activityId, objectives);
  repo.saveRevisionDraft(activityId, 'initial', { objectives, schedule, assumptions });
  repo.logEvent('plan_previewed', activityId, { objectives: objectives.length, feasible: schedule.feasible, unassignedMinutes: schedule.unassignedMinutes });
  return schedule;
}

/** Propuesta de replanificación (o tras «Dividir más») con comparación antes/después. */
export function proposeReplan(activityId: string, objectives: ObjectiveDraft[], kind: 'replan' | 'split', assumptions: string[] = []) {
  const current = repo.getObjectives(activityId);
  const sessions = repo.getSessionsFor(current.map((o) => o.id)).filter((x) => x.status === 'planned');
  const before = current.map((o) => ({
    key: o.id,
    title: o.title,
    sessionStart: sessions.find((x) => x.objectiveId === o.id)?.startsAt ?? null,
    dueAt: o.dueAt,
  }));
  const schedule = schedulePlan(activityId, objectives);
  repo.saveRevisionDraft(activityId, kind, { objectives, schedule, assumptions, before });
  return schedule;
}
