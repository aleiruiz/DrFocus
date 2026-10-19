import { checkGraph, type GraphIssue } from '@drfocus/contracts';
import { buildWindows, type AvailabilityException, type AvailabilityRule } from './availability.ts';
import { MINUTE, mergeSpans, spanMinutes, subtractSpans, toIso, toMs, type Span } from './time.ts';

export const PLANNER_VERSION = 1;
export const HORIZON_DAYS = 90;

export interface PlannerObjective {
  key: string;
  remainingMinutes: number;
  dependsOn: readonly string[];
  status: 'todo' | 'in_progress' | 'completed' | 'skipped';
  /** Fecha límite explícita elegida por el usuario. */
  dueAt?: string | null;
  /** Sesiones fijadas que el planificador no mueve. */
  lockedSessions?: readonly { startsAt: string; endsAt: string }[];
}

export interface PlannerInput {
  now: string;
  timezone: string;
  rules: readonly AvailabilityRule[];
  exceptions?: readonly AvailabilityException[];
  /** Sesiones ya programadas de otras actividades: no se tocan (TECH_SPEC §6). */
  busy?: readonly { startsAt: string; endsAt: string }[];
  objectives: readonly PlannerObjective[];
  deadlineAt: string;
  preferredBlockMinutes: number;
  minBlockMinutes?: number;
  breakMinutes?: number;
}

export interface PlannedSession {
  objectiveKey: string;
  startsAt: string;
  endsAt: string;
  locked: boolean;
}

export type PlannerConflict =
  | { kind: 'deadline_past' }
  | { kind: 'beyond_horizon'; horizonDays: number }
  | { kind: 'graph'; issue: GraphIssue }
  | { kind: 'insufficient_time'; missingMinutes: number; objectiveKeys: string[] }
  | { kind: 'objective_due_missed'; objectiveKey: string };

export interface PlannerOutput {
  algorithmVersion: number;
  sessions: PlannedSession[];
  /** Fecha límite sugerida o explícita de cada objetivo pendiente. */
  objectiveDueAt: Record<string, string | null>;
  conflicts: PlannerConflict[];
  unassignedMinutes: number;
  availableMinutes: number;
  requiredMinutes: number;
  feasible: boolean;
}

const roundUp = (ms: number, step: number) => Math.ceil(ms / step) * step;

/**
 * Planificador determinista (TECH_SPEC §6). Misma entrada → misma salida; el reloj llega como `now`.
 * Asigna bloques en el primer espacio libre después de sus dependencias, en orden de fecha límite.
 */
export function planSchedule(input: PlannerInput): PlannerOutput {
  const minBlock = input.minBlockMinutes ?? 5;
  const breakMs = (input.breakMinutes ?? 5) * MINUTE;
  const pref = Math.max(minBlock, input.preferredBlockMinutes);
  const shortest = Math.max(minBlock, Math.ceil(pref / 2 / 5) * 5);
  const now = roundUp(toMs(input.now), 5 * MINUTE);
  const deadline = toMs(input.deadlineAt);
  const conflicts: PlannerConflict[] = [];
  const empty = (extra: Partial<PlannerOutput> = {}): PlannerOutput => ({
    algorithmVersion: PLANNER_VERSION,
    sessions: [],
    objectiveDueAt: {},
    conflicts,
    unassignedMinutes: 0,
    availableMinutes: 0,
    requiredMinutes: 0,
    feasible: false,
    ...extra,
  });

  if (deadline <= now) {
    conflicts.push({ kind: 'deadline_past' });
    return empty();
  }
  if (deadline - now > HORIZON_DAYS * 24 * 60 * MINUTE) {
    conflicts.push({ kind: 'beyond_horizon', horizonDays: HORIZON_DAYS });
    return empty();
  }
  for (const issue of checkGraph(input.objectives)) conflicts.push({ kind: 'graph', issue });
  if (conflicts.length) return empty();

  const pending = input.objectives.filter((o) => o.status === 'todo' || o.status === 'in_progress');
  const locked: PlannedSession[] = input.objectives.flatMap((o) =>
    (o.lockedSessions ?? []).map((s) => ({ objectiveKey: o.key, startsAt: s.startsAt, endsAt: s.endsAt, locked: true })),
  );
  const occupied: Span[] = [
    ...(input.busy ?? []).map((b) => ({ start: toMs(b.startsAt), end: toMs(b.endsAt) })),
    ...locked.map((s) => ({ start: toMs(s.startsAt), end: toMs(s.endsAt) })),
  ];
  let free = subtractSpans(buildWindows(input.rules, input.exceptions ?? [], input.timezone, now, deadline), occupied);
  const availableMinutes = free.reduce((n, s) => n + spanMinutes(s), 0);

  // Minutos que faltan por objetivo, descontando sesiones fijadas futuras.
  const remaining = new Map<string, number>();
  for (const o of pending) {
    const lockedMin = (o.lockedSessions ?? []).reduce(
      (n, s) => n + Math.max(0, (toMs(s.endsAt) - Math.max(toMs(s.startsAt), now)) / MINUTE),
      0,
    );
    remaining.set(o.key, Math.max(0, Math.round(o.remainingMinutes - lockedMin)));
  }
  const requiredMinutes = [...remaining.values()].reduce((a, b) => a + b, 0);

  const order = new Map(input.objectives.map((o, i) => [o.key, i]));
  const finishedAt = new Map<string, number>();
  for (const o of input.objectives) if (o.status === 'completed' || o.status === 'skipped') finishedAt.set(o.key, now);
  for (const s of locked) {
    const end = toMs(s.endsAt);
    if ((finishedAt.get(s.objectiveKey) ?? 0) < end && remaining.get(s.objectiveKey) === 0) finishedAt.set(s.objectiveKey, end);
  }

  const sessions: PlannedSession[] = [...locked];
  const objectiveDueAt: Record<string, string | null> = {};
  const missing: string[] = [];
  let unassigned = 0;
  const limitFor = (o: PlannerObjective) => Math.min(deadline, o.dueAt ? toMs(o.dueAt) : deadline);

  const queue = [...pending];
  while (queue.length) {
    const ready = queue.filter((o) => o.dependsOn.every((d) => finishedAt.has(d)));
    // Si un objetivo depende de algo que no se pudo asignar, se procesa igual para medir el faltante.
    const candidates = ready.length ? ready : queue;
    candidates.sort((a, b) => limitFor(a) - limitFor(b) || (order.get(a.key)! - order.get(b.key)!));
    const o = candidates[0]!;
    queue.splice(queue.indexOf(o), 1);

    const depsBlocked = o.dependsOn.some((d) => !finishedAt.has(d));
    const earliest = Math.max(now, ...o.dependsOn.map((d) => finishedAt.get(d) ?? now));
    const limit = limitFor(o);
    let left = remaining.get(o.key) ?? 0;
    let lastEnd = Math.max(earliest, ...locked.filter((s) => s.objectiveKey === o.key).map((s) => toMs(s.endsAt)));

    if (!depsBlocked) {
      const used: Span[] = [];
      for (const span of free) {
        if (left <= 0) break;
        let cursor = Math.max(span.start, earliest);
        const end = Math.min(span.end, limit);
        // No usa huecos menores a la mitad del bloque preferido (salvo para lo último que falte).
        while (left > 0 && end - cursor >= Math.min(left, shortest) * MINUTE) {
          const room = Math.floor((end - cursor) / MINUTE);
          let chunk = Math.min(left, pref, room);
          const rest = left - chunk;
          // Evita dejar un residuo corto: lo absorbe si cabe o recorta este bloque para que el residuo alcance el mínimo.
          if (rest > 0 && rest < shortest) {
            if (room >= left) chunk = left;
            else if (chunk - (shortest - rest) >= minBlock) chunk -= shortest - rest;
          }
          const startMs = cursor;
          const endMs = cursor + chunk * MINUTE;
          sessions.push({ objectiveKey: o.key, startsAt: toIso(startMs), endsAt: toIso(endMs), locked: false });
          used.push({ start: startMs, end: Math.min(endMs + breakMs, span.end) });
          left -= chunk;
          lastEnd = endMs;
          cursor = endMs + breakMs;
        }
      }
      free = mergeSpans(subtractSpans(free, used));
    }

    if (left > 0) {
      unassigned += left;
      missing.push(o.key);
      if (o.dueAt && toMs(o.dueAt) < deadline) conflicts.push({ kind: 'objective_due_missed', objectiveKey: o.key });
      objectiveDueAt[o.key] = o.dueAt ?? null;
      // Marca como terminado al límite para que los dependientes midan su propio faltante.
      if (!depsBlocked) finishedAt.set(o.key, limit);
    } else {
      finishedAt.set(o.key, lastEnd);
      objectiveDueAt[o.key] = o.dueAt ?? toIso(lastEnd);
    }
  }

  if (unassigned > 0) conflicts.push({ kind: 'insufficient_time', missingMinutes: unassigned, objectiveKeys: missing });

  sessions.sort((a, b) => toMs(a.startsAt) - toMs(b.startsAt) || a.objectiveKey.localeCompare(b.objectiveKey));
  return {
    algorithmVersion: PLANNER_VERSION,
    sessions,
    objectiveDueAt,
    conflicts,
    unassignedMinutes: unassigned,
    availableMinutes,
    requiredMinutes,
    feasible: conflicts.length === 0,
  };
}

/** Verificación independiente de la salida (se usa en pruebas y antes de aceptar). */
export function validateSchedule(input: PlannerInput, out: PlannerOutput): string[] {
  const errors: string[] = [];
  const deadline = toMs(input.deadlineAt);
  const spans = out.sessions.map((s) => ({ ...s, start: toMs(s.startsAt), end: toMs(s.endsAt) })).sort((a, b) => a.start - b.start);
  for (let i = 1; i < spans.length; i++) if (spans[i]!.start < spans[i - 1]!.end) errors.push('Sesiones solapadas');
  for (const s of spans) if (s.end > deadline) errors.push('Sesión después de la fecha final');
  for (const b of input.busy ?? [])
    for (const s of spans) if (!s.locked && s.start < toMs(b.endsAt) && toMs(b.startsAt) < s.end) errors.push('Sesión sobre otra actividad');
  const byKey = new Map(input.objectives.map((o) => [o.key, o]));
  for (const s of spans) {
    for (const d of byKey.get(s.objectiveKey)?.dependsOn ?? []) {
      const depEnd = Math.max(0, ...spans.filter((x) => x.objectiveKey === d).map((x) => x.end));
      if (depEnd > s.start) errors.push(`Dependencia violada: ${s.objectiveKey} empieza antes de terminar ${d}`);
    }
  }
  return errors;
}
