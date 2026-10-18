import { checkGraph, type AgentObjective, type ObjectiveDraft } from '@drfocus/contracts';
import { uuid } from '@/lib/ids';

/** Ediciones de la vista previa (S07). Funciones puras sobre la lista de borradores. */

export const isPendingDraft = (o: ObjectiveDraft) => o.status === 'todo' || o.status === 'in_progress';

export function newDraft(after: ObjectiveDraft | undefined, fields: { title: string; expectedResult: string; estimatedMinutes: number }): ObjectiveDraft {
  return {
    key: uuid(),
    existingId: null,
    title: fields.title,
    expectedResult: fields.expectedResult,
    estimatedMinutes: fields.estimatedMinutes,
    remainingMinutes: fields.estimatedMinutes,
    dependsOn: after ? [after.key] : [],
    status: 'todo',
    source: 'manual',
    isReview: false,
    dueAt: null,
  };
}

export function updateDraft(list: readonly ObjectiveDraft[], key: string, fields: { title: string; expectedResult: string; estimatedMinutes: number }): ObjectiveDraft[] {
  return list.map((o) => (o.key === key ? { ...o, ...fields, remainingMinutes: fields.estimatedMinutes } : o));
}

/** Quita un paso; quien dependía de él hereda sus dependencias (igual que al borrar un objetivo guardado). */
export function removeDraft(list: readonly ObjectiveDraft[], key: string): ObjectiveDraft[] {
  const gone = list.find((o) => o.key === key);
  if (!gone) return [...list];
  return list
    .filter((o) => o.key !== key)
    .map((o) => (o.dependsOn.includes(key) ? { ...o, dependsOn: [...new Set(o.dependsOn.flatMap((d) => (d === key ? gone.dependsOn : [d])))] } : o));
}

/**
 * Mueve un paso una posición. Si el paso dependía del que salta, intercambian el orden de la cadena:
 * el que sube toma las dependencias del otro y el otro pasa a depender de él. Devuelve null si
 * el cambio dejaría dependencias inválidas.
 */
export function moveDraft(list: readonly ObjectiveDraft[], key: string, dir: -1 | 1): ObjectiveDraft[] | null {
  const i = list.findIndex((o) => o.key === key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return null;
  const [upper, lower] = dir === -1 ? [list[j]!, list[i]!] : [list[i]!, list[j]!];
  let out = [...list];
  out[i] = list[j]!;
  out[j] = list[i]!;
  if (lower.dependsOn.includes(upper.key)) {
    const newUpper = { ...lower, dependsOn: [...new Set([...upper.dependsOn, ...lower.dependsOn.filter((d) => d !== upper.key)])] };
    const newLower = { ...upper, dependsOn: [lower.key] };
    // Los que dependían del último de los dos ahora dependen del nuevo último.
    out = out.map((o) => {
      if (o.key === lower.key) return newUpper;
      if (o.key === upper.key) return newLower;
      return o.dependsOn.includes(lower.key) && !o.dependsOn.includes(upper.key)
        ? { ...o, dependsOn: o.dependsOn.map((d) => (d === lower.key ? upper.key : d)) }
        : o;
    });
  }
  return checkGraph(out).length ? null : out;
}

/** «Ajustar el alcance»: versiones más cortas de cada paso pendiente (≈ 25 % menos, múltiplos de 5). */
export function reduceScope(list: readonly ObjectiveDraft[], factor = 0.75): ObjectiveDraft[] {
  return list.map((o) => {
    if (!isPendingDraft(o)) return o;
    const m = Math.max(5, Math.round((o.estimatedMinutes * factor) / 5) * 5);
    return { ...o, estimatedMinutes: m, remainingMinutes: Math.min(o.remainingMinutes, m) };
  });
}

/** Propuesta del agente → borradores. Las claves se cambian por UUID locales (TECH_SPEC §7). */
export function draftsFromAgent(objectives: readonly AgentObjective[]): ObjectiveDraft[] {
  const ids = new Map(objectives.map((o) => [o.localId, uuid()]));
  return objectives.map((o) => ({
    key: ids.get(o.localId)!,
    existingId: null,
    title: o.title,
    expectedResult: o.expectedResult,
    estimatedMinutes: o.estimatedMinutes,
    remainingMinutes: o.estimatedMinutes,
    dependsOn: o.dependsOn.map((d) => ids.get(d)).filter((x): x is string => !!x),
    status: 'todo',
    source: 'agent',
    isReview: false,
    dueAt: null,
  }));
}
