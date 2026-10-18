import { LIMITS, type ObjectiveDraft } from '@drfocus/contracts';
import type { ActivityTemplate, Answers, BuildContext, Step } from './types.ts';

export const num = (v: unknown, fallback: number, min = 1, max = 1000): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= min ? Math.min(Math.round(n), max) : fallback;
};
export const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
export const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const clampMinutes = (m: number): number =>
  Math.max(LIMITS.objectiveMinutesMin, Math.min(LIMITS.objectiveMinutesMax, Math.round(m)));

/**
 * Reparte `total` elementos en lotes según el tiempo por elemento y el bloque preferido (TECH_SPEC §4):
 * itemsPerBlock = max(1, floor(preferredBlockMinutes / minutesPerItem)). Nunca pierde elementos.
 */
export function batches(total: number, minutesPerItem: number, preferredBlockMinutes: number, maxBatches = 24): number[] {
  if (total <= 0) return [];
  let perBlock = Math.max(1, Math.floor(preferredBlockMinutes / minutesPerItem));
  // Respeta el tope de objetivos y de 120 minutos por objetivo.
  perBlock = Math.max(perBlock, Math.ceil(total / maxBatches));
  perBlock = Math.min(perBlock, Math.max(1, Math.floor(LIMITS.objectiveMinutesMax / minutesPerItem)));
  const count = Math.ceil(total / perBlock);
  const base = Math.floor(total / count);
  const extra = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Rangos 1–5, 6–10… a partir de tamaños de lote. */
export function ranges(sizes: readonly number[]): [number, number][] {
  let start = 1;
  return sizes.map((n) => {
    const r: [number, number] = [start, start + n - 1];
    start += n;
    return r;
  });
}

export const rangeLabel = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}–${b}`);

/** Divide en partes un paso que excede 120 minutos. */
function expandLong(steps: Step[]): Step[] {
  const out: Step[] = [];
  for (const s of steps) {
    if (s.minutes <= LIMITS.objectiveMinutesMax) {
      out.push(s);
      continue;
    }
    const parts = Math.ceil(s.minutes / LIMITS.objectiveMinutesMax);
    for (let i = 0; i < parts; i++) {
      out.push({
        ...s,
        id: `${s.id}-${i + 1}`,
        title: `${s.title} (parte ${i + 1} de ${parts})`,
        minutes: Math.round(s.minutes / parts),
        after: i === 0 ? s.after : 'prev',
      });
    }
  }
  return out;
}

/** Convierte los pasos de una plantilla en objetivos del plan, omitiendo los ya hechos. */
export function buildObjectives(template: ActivityTemplate, answers: Answers, ctx: BuildContext): ObjectiveDraft[] {
  const done = new Set(list(answers.alreadyDone));
  const steps = expandLong(template.steps(answers, ctx));
  const kept = new Set(steps.filter((s) => !done.has(s.id)).map((s) => s.id));
  const result: ObjectiveDraft[] = [];
  let prevAny: string | null = null;
  // Resuelve dependencias: si el paso del que dependía se omitió, hereda sus dependencias.
  const resolved = new Map<string, string[]>();
  for (const s of steps) {
    const raw = s.after === 'prev' ? (prevAny ? [prevAny] : []) : [...(s.after ?? [])];
    const deps = new Set<string>();
    for (const d of raw) {
      if (kept.has(d)) deps.add(d);
      else for (const x of resolved.get(d) ?? []) deps.add(x);
    }
    resolved.set(s.id, [...deps]);
    prevAny = s.id;
    if (!kept.has(s.id)) continue;
    result.push({
      key: s.id,
      existingId: null,
      title: s.title.slice(0, LIMITS.titleMax),
      expectedResult: s.expectedResult,
      estimatedMinutes: clampMinutes(s.minutes),
      remainingMinutes: clampMinutes(s.minutes),
      dependsOn: [...deps],
      status: 'todo',
      source: 'template',
      isReview: s.review ?? false,
      dueAt: null,
    });
  }
  return result;
}
