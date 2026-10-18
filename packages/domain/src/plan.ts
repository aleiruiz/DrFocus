import { checkGraph, type ObjectiveDraft } from '@drfocus/contracts';
import type { PlannerObjective } from '@drfocus/planner';

export interface SplitChild {
  localId?: string;
  title: string;
  expectedResult: string;
  estimatedMinutes: number;
  dependsOn?: readonly string[];
}

let counter = 0;
const newKey = (base: string) => `${base}.${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * «Dividir más»: reemplaza un objetivo pendiente por sus hijos y redirige dependencias (TECH_SPEC §6).
 * Los hijos sin dependencias internas heredan las del padre; quien dependía del padre pasa a depender
 * de los hijos finales. Devuelve la diferencia de minutos respecto al padre para mostrarla.
 */
export function splitObjective(
  list: readonly ObjectiveDraft[],
  key: string,
  children: readonly SplitChild[],
  makeKey: (base: string) => string = newKey,
): { objectives: ObjectiveDraft[]; minutesDelta: number } {
  const parent = list.find((o) => o.key === key);
  if (!parent) throw new Error('El objetivo ya no existe');
  if (parent.status === 'completed' || parent.status === 'skipped') throw new Error('Solo se dividen objetivos pendientes');
  if (children.length < 2) throw new Error('Se necesitan al menos dos partes');

  const idMap = new Map<string, string>();
  children.forEach((c, i) => idMap.set(c.localId ?? `__${i}`, makeKey(parent.key)));
  const sequential = children.every((c) => c.dependsOn === undefined);
  const kids: ObjectiveDraft[] = children.map((c, i) => {
    const k = idMap.get(c.localId ?? `__${i}`)!;
    const internal = sequential
      ? i === 0
        ? []
        : [idMap.get(children[i - 1]!.localId ?? `__${i - 1}`)!]
      : (c.dependsOn ?? []).map((d) => idMap.get(d)).filter((x): x is string => !!x);
    return {
      key: k,
      existingId: null,
      title: c.title,
      expectedResult: c.expectedResult,
      estimatedMinutes: c.estimatedMinutes,
      remainingMinutes: c.estimatedMinutes,
      dependsOn: internal.length ? internal : [...parent.dependsOn],
      status: 'todo',
      source: parent.source === 'template' ? 'manual' : parent.source,
      isReview: parent.isReview ?? false,
      dueAt: parent.dueAt ?? null,
    };
  });
  const sinks = kids.filter((k) => !kids.some((o) => o.dependsOn.includes(k.key))).map((k) => k.key);

  const out: ObjectiveDraft[] = [];
  for (const o of list) {
    if (o.key === key) {
      out.push(...kids);
      continue;
    }
    out.push(o.dependsOn.includes(key) ? { ...o, dependsOn: [...new Set(o.dependsOn.flatMap((d) => (d === key ? sinks : [d])))] } : o);
  }
  if (checkGraph(out).length) throw new Error('La división crearía dependencias inválidas');
  const delta = kids.reduce((n, k) => n + k.remainingMinutes, 0) - parent.remainingMinutes;
  return { objectives: out, minutesDelta: delta };
}

/** División manual en dos mitades, sin agente. */
export function splitInHalves(o: ObjectiveDraft): SplitChild[] {
  const first = Math.max(5, Math.round(o.remainingMinutes / 2 / 5) * 5);
  const second = Math.max(5, o.remainingMinutes - first);
  return [
    { title: `${o.title} (primera parte)`, expectedResult: `Primera mitad de: ${o.expectedResult}`, estimatedMinutes: first },
    { title: `${o.title} (segunda parte)`, expectedResult: o.expectedResult, estimatedMinutes: second },
  ];
}

export function toPlannerObjectives(
  list: readonly ObjectiveDraft[],
  locked: ReadonlyMap<string, readonly { startsAt: string; endsAt: string }[]> = new Map(),
): PlannerObjective[] {
  return list.map((o) => ({
    key: o.key,
    remainingMinutes: o.remainingMinutes,
    dependsOn: o.dependsOn,
    status: o.status,
    dueAt: o.dueAt ?? null,
    lockedSessions: locked.get(o.key) ?? [],
  }));
}

/** Diferencias entre el plan vigente y la propuesta, para la pantalla de replanificación. */
export function diffPlans(
  before: readonly { key: string; title: string; sessionStart: string | null; dueAt: string | null }[],
  after: readonly { key: string; title: string; sessionStart: string | null; dueAt: string | null }[],
) {
  const b = new Map(before.map((x) => [x.key, x]));
  const a = new Map(after.map((x) => [x.key, x]));
  return {
    added: after.filter((x) => !b.has(x.key)),
    removed: before.filter((x) => !a.has(x.key)),
    moved: after.filter((x) => b.has(x.key) && (b.get(x.key)!.sessionStart !== x.sessionStart || b.get(x.key)!.dueAt !== x.dueAt)).map((x) => ({ before: b.get(x.key)!, after: x })),
  };
}
