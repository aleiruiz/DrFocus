import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { ObjectiveDraft, Role } from '@drfocus/contracts';
import { makeParticipantAlias, type PilotEvent } from '@drfocus/domain';
import type { PlannerOutput } from '@drfocus/planner';
import { nowIso, uuid } from '@/lib/ids';
import { db } from './client';
import * as s from './schema';

/** Propuesta guardada en plan_revisions.proposedJson. */
export interface ProposedPlan {
  objectives: ObjectiveDraft[];
  schedule: PlannerOutput;
  assumptions: string[];
  /** Sesiones vigentes antes de la propuesta, para comparar en replanificación. */
  before?: { key: string; title: string; sessionStart: string | null; dueAt: string | null }[];
}

export class StaleRevisionError extends Error {
  constructor() {
    super('El plan cambió mientras lo revisabas. Vuelve a generar la vista previa.');
  }
}

// ---------- Eventos locales (base de la exportación del piloto) ----------
export function logEvent(eventType: PilotEvent, entityId: string | null, properties: Record<string, unknown> = {}) {
  db.insert(s.localEvents).values({ id: uuid(), eventType, entityId, occurredAt: nowIso(), propertiesJson: JSON.stringify(properties) }).run();
}

// ---------- Preferencias y disponibilidad ----------
export const getPrefs = () => db.select().from(s.preferences).where(eq(s.preferences.singletonId, 1)).get();

export function ensurePrefs(role: Role, timezone: string) {
  const current = getPrefs();
  if (current) {
    db.update(s.preferences).set({ role }).where(eq(s.preferences.singletonId, 1)).run();
    return;
  }
  db.insert(s.preferences).values({ singletonId: 1, role, timezone, participantAlias: makeParticipantAlias() }).run();
}

export function updatePrefs(patch: Partial<Omit<s.Preferences, 'singletonId'>>) {
  db.update(s.preferences).set(patch).where(eq(s.preferences.singletonId, 1)).run();
}

export const getRules = () => db.select().from(s.availabilityRules).orderBy(asc(s.availabilityRules.weekday), asc(s.availabilityRules.startLocal)).all();

export function replaceRules(rules: { weekday: number; startLocal: string; endLocal: string }[], timezone: string) {
  db.transaction((tx) => {
    tx.delete(s.availabilityRules).run();
    for (const r of rules) tx.insert(s.availabilityRules).values({ id: uuid(), timezone, ...r }).run();
  });
}

// ---------- Actividades ----------
export interface NewActivity {
  role: Role;
  typeId: string;
  templateVersion: number;
  title: string;
  description: string;
  expectedResult: string;
  requirements: Record<string, unknown>;
  deadlineAt: string;
  deadlineZone: string;
}

export function createDraftActivity(a: NewActivity): string {
  const id = uuid();
  const t = nowIso();
  const { requirements, ...rest } = a;
  db.insert(s.activities)
    .values({ id, ...rest, requirementsJson: JSON.stringify(requirements), status: 'draft', revision: 0, createdAt: t, updatedAt: t })
    .run();
  logEvent('activity_created', id, { typeId: a.typeId, templateVersion: a.templateVersion });
  return id;
}

export const getActivity = (id: string) => db.select().from(s.activities).where(eq(s.activities.id, id)).get();

export function updateActivity(id: string, patch: Partial<Pick<s.Activity, 'title' | 'description' | 'expectedResult' | 'status'>>) {
  db.update(s.activities).set({ ...patch, updatedAt: nowIso() }).where(eq(s.activities.id, id)).run();
}

/** Borra la actividad: se conserva solo el registro mínimo sin texto para la exportación del piloto. */
export function deleteActivity(id: string) {
  db.transaction((tx) => {
    tx.delete(s.objectives).where(eq(s.objectives.activityId, id)).run();
    tx.delete(s.planRevisions).where(eq(s.planRevisions.activityId, id)).run();
    tx.update(s.activities).set({ deletedAt: nowIso(), status: 'archived', title: '', description: '', expectedResult: '', requirementsJson: '{}' }).where(eq(s.activities.id, id)).run();
  });
}

export const getObjectives = (activityId: string) =>
  db.select().from(s.objectives).where(eq(s.objectives.activityId, activityId)).orderBy(asc(s.objectives.orderIndex)).all();

export function getDependencies(objectiveIds: string[]) {
  if (!objectiveIds.length) return [];
  return db.select().from(s.objectiveDependencies).where(inArray(s.objectiveDependencies.objectiveId, objectiveIds)).all();
}

export function getSessionsFor(objectiveIds: string[]) {
  if (!objectiveIds.length) return [];
  return db.select().from(s.workSessions).where(inArray(s.workSessions.objectiveId, objectiveIds)).orderBy(asc(s.workSessions.startsAt)).all();
}

/** Sesiones planeadas de las demás actividades activas (el planificador no las mueve). */
export function busySessionsExcept(activityId: string) {
  return db
    .select({ startsAt: s.workSessions.startsAt, endsAt: s.workSessions.endsAt })
    .from(s.workSessions)
    .innerJoin(s.objectives, eq(s.objectives.id, s.workSessions.objectiveId))
    .innerJoin(s.activities, eq(s.activities.id, s.objectives.activityId))
    .where(and(ne(s.activities.id, activityId), eq(s.activities.status, 'active'), eq(s.workSessions.status, 'planned'), inArray(s.objectives.status, ['todo', 'in_progress'])))
    .all();
}

/** Convierte los objetivos guardados en borradores de plan (para replanificar o dividir). */
export function currentPlanDrafts(activityId: string): ObjectiveDraft[] {
  const objs = getObjectives(activityId);
  const deps = getDependencies(objs.map((o) => o.id));
  return objs.map((o) => ({
    key: o.id,
    existingId: o.id,
    title: o.title,
    expectedResult: o.expectedResult,
    estimatedMinutes: o.estimatedMinutes,
    remainingMinutes: o.remainingMinutes,
    dependsOn: deps.filter((d) => d.objectiveId === o.id).map((d) => d.dependsOnId),
    status: o.status,
    source: o.source,
    isReview: o.isReview,
    dueAt: o.status === 'completed' || o.status === 'skipped' ? o.dueAt : null,
  }));
}

// ---------- Revisiones del plan ----------
export function saveRevisionDraft(activityId: string, kind: s.PlanRevision['kind'], plan: ProposedPlan): string {
  const activity = getActivity(activityId);
  if (!activity) throw new Error('La actividad ya no existe');
  const existing = latestDraft(activityId);
  const json = JSON.stringify(plan);
  if (existing && existing.kind === kind) {
    db.update(s.planRevisions).set({ proposedJson: json, assumptionsJson: JSON.stringify(plan.assumptions), baseRevision: activity.revision }).where(eq(s.planRevisions.id, existing.id)).run();
    return existing.id;
  }
  const id = uuid();
  db.transaction((tx) => {
    tx.update(s.planRevisions).set({ state: 'rejected' }).where(and(eq(s.planRevisions.activityId, activityId), eq(s.planRevisions.state, 'draft'))).run();
    tx.insert(s.planRevisions)
      .values({ id, activityId, kind, baseRevision: activity.revision, proposedJson: json, assumptionsJson: JSON.stringify(plan.assumptions), createdAt: nowIso(), state: 'draft' })
      .run();
  });
  return id;
}

export const latestDraft = (activityId: string) =>
  db
    .select()
    .from(s.planRevisions)
    .where(and(eq(s.planRevisions.activityId, activityId), eq(s.planRevisions.state, 'draft')))
    .orderBy(desc(s.planRevisions.createdAt))
    .get();

export function discardDraft(revisionId: string) {
  db.update(s.planRevisions).set({ state: 'rejected' }).where(eq(s.planRevisions.id, revisionId)).run();
}

/**
 * Aplica una revisión en una transacción, solo si sigue vigente (TECH_SPEC §6, punto 9).
 * No toca objetivos completados ni registra avances inexistentes.
 */
export function acceptRevision(revisionId: string, timezone: string): { activityId: string; firstPlan: boolean } {
  return db.transaction((tx) => {
    const rev = tx.select().from(s.planRevisions).where(eq(s.planRevisions.id, revisionId)).get();
    if (!rev || rev.state !== 'draft') throw new StaleRevisionError();
    const activity = tx.select().from(s.activities).where(eq(s.activities.id, rev.activityId)).get();
    if (!activity || activity.revision !== rev.baseRevision) throw new StaleRevisionError();
    const plan = JSON.parse(rev.proposedJson) as ProposedPlan;
    if (!plan.schedule.feasible) throw new Error('El plan todavía tiene conflictos de tiempo.');

    const t = nowIso();
    const existing = tx.select().from(s.objectives).where(eq(s.objectives.activityId, activity.id)).all();
    const existingById = new Map(existing.map((o) => [o.id, o]));
    const idByKey = new Map(plan.objectives.map((o) => [o.key, o.existingId && existingById.has(o.existingId) ? o.existingId : uuid()]));
    const keepIds = new Set(idByKey.values());

    // Objetivos eliminados o reemplazados (por ejemplo, al dividir). Los completados nunca se borran.
    const removed = existing.filter((o) => !keepIds.has(o.id) && o.status !== 'completed').map((o) => o.id);
    if (removed.length) tx.delete(s.objectives).where(inArray(s.objectives.id, removed)).run();
    const ids = [...keepIds];
    tx.delete(s.objectiveDependencies).where(inArray(s.objectiveDependencies.objectiveId, ids)).run();
    tx.delete(s.workSessions).where(and(inArray(s.workSessions.objectiveId, ids), eq(s.workSessions.status, 'planned'), eq(s.workSessions.locked, false))).run();

    plan.objectives.forEach((o, i) => {
      const id = idByKey.get(o.key)!;
      const prev = existingById.get(id);
      const frozen = prev && (prev.status === 'completed' || prev.status === 'skipped');
      const dueAt = frozen ? prev.dueAt : (plan.schedule.objectiveDueAt[o.key] ?? o.dueAt ?? null);
      const values = {
        activityId: activity.id,
        title: o.title,
        expectedResult: o.expectedResult,
        estimatedMinutes: o.estimatedMinutes,
        remainingMinutes: frozen ? prev.remainingMinutes : o.remainingMinutes,
        dueAt,
        status: frozen ? prev.status : o.status,
        orderIndex: i,
        source: o.source,
        isReview: o.isReview ?? false,
        updatedAt: t,
      };
      if (prev) tx.update(s.objectives).set(values).where(eq(s.objectives.id, id)).run();
      else tx.insert(s.objectives).values({ id, ...values, completedAt: null }).run();
    });
    for (const o of plan.objectives) {
      for (const d of o.dependsOn) {
        const dep = idByKey.get(d);
        if (dep) tx.insert(s.objectiveDependencies).values({ objectiveId: idByKey.get(o.key)!, dependsOnId: dep }).run();
      }
    }
    for (const sess of plan.schedule.sessions) {
      if (sess.locked) continue;
      const objectiveId = idByKey.get(sess.objectiveKey);
      if (objectiveId) tx.insert(s.workSessions).values({ id: uuid(), objectiveId, startsAt: sess.startsAt, endsAt: sess.endsAt, timezone, locked: false, status: 'planned' }).run();
    }

    const firstPlan = !tx.select({ id: s.planRevisions.id }).from(s.planRevisions).where(eq(s.planRevisions.state, 'accepted')).get();
    tx.update(s.activities).set({ status: 'active', revision: activity.revision + 1, updatedAt: t }).where(eq(s.activities.id, activity.id)).run();
    tx.update(s.planRevisions).set({ state: 'accepted', acceptedAt: t }).where(eq(s.planRevisions.id, rev.id)).run();
    tx.insert(s.localEvents)
      .values({
        id: uuid(),
        eventType: rev.kind === 'initial' ? 'plan_accepted' : 'replan_accepted',
        entityId: activity.id,
        occurredAt: t,
        propertiesJson: JSON.stringify({ revision: activity.revision + 1, objectives: plan.objectives.length, kind: rev.kind, sessions: plan.schedule.sessions.length }),
      })
      .run();
    return { activityId: activity.id, firstPlan };
  });
}

// ---------- Objetivos ----------
export const getObjective = (id: string) => db.select().from(s.objectives).where(eq(s.objectives.id, id)).get();

function refreshActivityStatus(activityId: string) {
  const objs = getObjectives(activityId);
  const done = objs.length > 0 && objs.every((o) => o.status === 'completed' || o.status === 'skipped');
  const activity = getActivity(activityId);
  if (!activity || activity.status === 'draft') return false;
  const status = done ? 'completed' : 'active';
  if (activity.status !== status) updateActivity(activityId, { status });
  return done;
}

/** Completa el objetivo; devuelve si con esto terminó la actividad. */
export function completeObjective(id: string): { activityDone: boolean } {
  const o = getObjective(id);
  if (!o) throw new Error('El objetivo ya no existe');
  const t = nowIso();
  db.transaction((tx) => {
    tx.update(s.objectives).set({ status: 'completed', remainingMinutes: 0, completedAt: t, updatedAt: t }).where(eq(s.objectives.id, id)).run();
    tx.update(s.workSessions).set({ status: 'cancelled' }).where(and(eq(s.workSessions.objectiveId, id), eq(s.workSessions.status, 'planned'))).run();
  });
  logEvent('objective_completed', id, { activityId: o.activityId, estimatedMinutes: o.estimatedMinutes, dueAt: o.dueAt, completedAt: t });
  return { activityDone: refreshActivityStatus(o.activityId) };
}

export function reopenObjective(id: string) {
  const o = getObjective(id);
  if (!o) return;
  db.update(s.objectives).set({ status: 'todo', remainingMinutes: o.estimatedMinutes, completedAt: null, updatedAt: nowIso() }).where(eq(s.objectives.id, id)).run();
  logEvent('objective_edited', id, { change: 'reopened' });
  refreshActivityStatus(o.activityId);
}

export function logObjectiveProgress(id: string, remainingMinutes: number, status: 'in_progress' | 'completed') {
  const o = getObjective(id);
  if (!o) throw new Error('El objetivo ya no existe');
  if (status === 'completed') return completeObjective(id);
  db.update(s.objectives).set({ remainingMinutes, status, updatedAt: nowIso() }).where(eq(s.objectives.id, id)).run();
  logEvent('progress_logged', id, { activityId: o.activityId, before: o.remainingMinutes, after: remainingMinutes });
  return { activityDone: false };
}

export function editObjective(id: string, patch: { title: string; expectedResult: string; estimatedMinutes: number }) {
  const o = getObjective(id);
  if (!o) throw new Error('El objetivo ya no existe');
  const remaining = o.status === 'todo' ? patch.estimatedMinutes : Math.min(o.remainingMinutes, patch.estimatedMinutes);
  db.update(s.objectives).set({ ...patch, remainingMinutes: remaining, updatedAt: nowIso() }).where(eq(s.objectives.id, id)).run();
  logEvent('objective_edited', id, { activityId: o.activityId, minutesBefore: o.estimatedMinutes, minutesAfter: patch.estimatedMinutes });
}

/** Elimina un objetivo; quien dependía de él hereda sus dependencias. */
export function deleteObjective(id: string) {
  const o = getObjective(id);
  if (!o) return;
  db.transaction((tx) => {
    const incoming = tx.select().from(s.objectiveDependencies).where(eq(s.objectiveDependencies.dependsOnId, id)).all();
    const outgoing = tx.select().from(s.objectiveDependencies).where(eq(s.objectiveDependencies.objectiveId, id)).all();
    tx.delete(s.objectives).where(eq(s.objectives.id, id)).run();
    for (const inc of incoming)
      for (const out of outgoing)
        if (inc.objectiveId !== out.dependsOnId)
          tx.insert(s.objectiveDependencies).values({ objectiveId: inc.objectiveId, dependsOnId: out.dependsOnId }).onConflictDoNothing().run();
  });
  logEvent('objective_edited', id, { activityId: o.activityId, change: 'deleted' });
  refreshActivityStatus(o.activityId);
}

// ---------- Recordatorios ----------
export function replaceScheduledReminders(rows: (typeof s.scheduledReminders.$inferInsert)[]) {
  db.transaction((tx) => {
    tx.delete(s.scheduledReminders).run();
    for (const r of rows) tx.insert(s.scheduledReminders).values(r).run();
  });
}

/** Datos para calcular avisos: objetivos pendientes de actividades activas. */
export function reminderSources() {
  const rows = db
    .select({ o: s.objectives, a: s.activities })
    .from(s.objectives)
    .innerJoin(s.activities, eq(s.activities.id, s.objectives.activityId))
    .where(and(eq(s.activities.status, 'active'), isNull(s.activities.deletedAt), inArray(s.objectives.status, ['todo', 'in_progress'])))
    .all();
  const sessions = getSessionsFor(rows.map((r) => r.o.id)).filter((x) => x.status === 'planned');
  return { rows, sessions };
}

// ---------- Borrado total ----------
export function wipeAll() {
  db.transaction((tx) => {
    for (const t of [s.workSessions, s.objectiveDependencies, s.objectives, s.planRevisions, s.activities, s.agentDrafts, s.formDrafts, s.scheduledReminders, s.localEvents, s.availabilityRules, s.availabilityExceptions, s.preferences])
      tx.delete(t).run();
  });
}

// ---------- Borradores del formulario ----------
export const getFormDraft = (typeId: string) => db.select().from(s.formDrafts).where(eq(s.formDrafts.typeId, typeId)).get();
export function saveFormDraft(typeId: string, value: unknown) {
  db.insert(s.formDrafts)
    .values({ typeId, json: JSON.stringify(value), updatedAt: nowIso() })
    .onConflictDoUpdate({ target: s.formDrafts.typeId, set: { json: JSON.stringify(value), updatedAt: nowIso() } })
    .run();
}
export const clearFormDraft = (typeId: string) => db.delete(s.formDrafts).where(eq(s.formDrafts.typeId, typeId)).run();

// ---------- Agente ----------
export function saveAgentDraft(id: string, requestId: string, input: unknown, proposed: unknown, activityId: string | null = null) {
  const values = { id, activityId, requestId, inputJson: JSON.stringify(input), proposedJson: proposed ? JSON.stringify(proposed) : null, updatedAt: nowIso() };
  db.insert(s.agentDrafts).values(values).onConflictDoUpdate({ target: s.agentDrafts.id, set: values }).run();
}
export const getAgentDraft = (id: string) => db.select().from(s.agentDrafts).where(eq(s.agentDrafts.id, id)).get();
export const clearAgentDraft = (id: string) => db.delete(s.agentDrafts).where(eq(s.agentDrafts.id, id)).run();
