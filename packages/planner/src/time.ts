import { DateTime } from 'luxon';

export interface Span {
  start: number; // epoch ms
  end: number;
}

export const MINUTE = 60_000;

export function toMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Instante inválido: ${iso}`);
  return ms;
}

export const toIso = (ms: number): string => new Date(ms).toISOString();

/**
 * Convierte una fecha y hora locales en un instante dentro de la zona IANA.
 * Devuelve `ambiguous` o `nonexistent` cuando el cambio de horario lo requiere (TECH_SPEC §6).
 */
export function localToInstant(
  localDate: string,
  localTime: string,
  zone: string,
): { ms: number; issue: null | 'nonexistent' | 'ambiguous' } {
  const dt = DateTime.fromISO(`${localDate}T${localTime}`, { zone });
  if (!dt.isValid) throw new Error(`Fecha u hora inválida: ${localDate} ${localTime} (${zone})`);
  let issue: null | 'nonexistent' | 'ambiguous' = null;
  if (dt.toFormat('HH:mm') !== localTime) issue = 'nonexistent';
  else {
    const earlier = dt.minus({ hours: 1 });
    const later = dt.plus({ hours: 1 });
    if (earlier.toFormat('HH:mm') === localTime || later.toFormat('HH:mm') === localTime) issue = 'ambiguous';
  }
  return { ms: dt.toMillis(), issue };
}

/** Día ISO de la semana (1 = lunes … 7 = domingo) y fecha local de un instante. */
export function localParts(ms: number, zone: string): { weekday: number; date: string; time: string } {
  const dt = DateTime.fromMillis(ms, { zone });
  return { weekday: dt.weekday, date: dt.toISODate()!, time: dt.toFormat('HH:mm') };
}

export function addDays(localDate: string, days: number): string {
  return DateTime.fromISO(localDate, { zone: 'UTC' }).plus({ days }).toISODate()!;
}

export function weekdayOf(localDate: string): number {
  return DateTime.fromISO(localDate, { zone: 'UTC' }).weekday;
}

/** Une intervalos que se tocan o se solapan; devuelve una lista ordenada. */
export function mergeSpans(spans: readonly Span[]): Span[] {
  const sorted = spans.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/** Resta `cut` de cada intervalo de `base`. */
export function subtractSpans(base: readonly Span[], cut: readonly Span[]): Span[] {
  let current = mergeSpans(base);
  for (const c of mergeSpans(cut)) {
    const next: Span[] = [];
    for (const s of current) {
      if (c.end <= s.start || c.start >= s.end) next.push(s);
      else {
        if (c.start > s.start) next.push({ start: s.start, end: c.start });
        if (c.end < s.end) next.push({ start: c.end, end: s.end });
      }
    }
    current = next;
  }
  return current;
}

export function clipSpans(spans: readonly Span[], from: number, to: number): Span[] {
  return spans
    .map((s) => ({ start: Math.max(s.start, from), end: Math.min(s.end, to) }))
    .filter((s) => s.end > s.start);
}

export const spanMinutes = (s: Span): number => Math.floor((s.end - s.start) / MINUTE);

