import { describeGraphIssue } from '@drfocus/contracts';
import { diffPlans } from '@drfocus/domain';
import type { PlannerConflict } from '@drfocus/planner';
import type { ProposedPlan } from '@/db/repo';
import { fmtDur } from '@/lib/format';

type Point = { key: string; title: string; sessionStart: string | null; dueAt: string | null };

export type CompareKind = 'moved' | 'added' | 'same' | 'done';

export interface CompareRow {
  key: string;
  title: string;
  kind: CompareKind;
  minutes: number;
  before: Point | null;
  after: Point;
}

const finished = (status: string) => status === 'completed' || status === 'skipped';

/** Arma la comparación antes/después de una propuesta de replanificación (S10). */
export function comparePlan(plan: ProposedPlan) {
  const after: Point[] = plan.objectives.map((o) => {
    const first = plan.schedule.sessions.filter((x) => x.objectiveKey === o.key).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    return {
      key: o.key,
      title: o.title,
      sessionStart: finished(o.status) ? null : (first?.startsAt ?? null),
      dueAt: finished(o.status) ? (o.dueAt ?? null) : (plan.schedule.objectiveDueAt[o.key] ?? o.dueAt ?? null),
    };
  });
  const before = plan.before ?? [];
  const diff = diffPlans(before, after);
  const added = new Set(diff.added.map((x) => x.key));
  const moved = new Set(diff.moved.map((m) => m.after.key));
  const beforeByKey = new Map(before.map((x) => [x.key, x]));

  const rows: CompareRow[] = plan.objectives.map((o, i) => ({
    key: o.key,
    title: o.title,
    minutes: o.remainingMinutes,
    kind: finished(o.status) ? 'done' : added.has(o.key) ? 'added' : moved.has(o.key) ? 'moved' : 'same',
    before: beforeByKey.get(o.key) ?? null,
    after: after[i]!,
  }));
  return {
    pending: rows.filter((r) => r.kind !== 'done'),
    done: rows.filter((r) => r.kind === 'done'),
    removed: diff.removed,
    changes: diff.added.length + diff.moved.length + diff.removed.length,
    totalBefore: before.length,
    totalAfter: plan.objectives.length,
  };
}

/** Texto claro para cada conflicto del planificador. */
export function describeConflict(c: PlannerConflict, titleOf: (key: string) => string): string {
  switch (c.kind) {
    case 'insufficient_time':
      return `Faltan ${fmtDur(c.missingMinutes)} de tiempo libre antes de la fecha límite.`;
    case 'deadline_past':
      return 'La fecha límite ya pasó. Marca lo que ya hiciste o elimina los pasos que ya no harás.';
    case 'beyond_horizon':
      return `La fecha límite está a más de ${c.horizonDays} días; el plan solo cubre ese periodo.`;
    case 'graph':
      return describeGraphIssue(c.issue);
    case 'objective_due_missed':
      return `«${titleOf(c.objectiveKey)}» no cabe antes de su propia fecha límite.`;
  }
}
