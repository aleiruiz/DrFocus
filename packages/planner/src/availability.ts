import { addDays, clipSpans, localParts, localToInstant, mergeSpans, subtractSpans, weekdayOf, type Span } from './time.ts';

export interface AvailabilityRule {
  /** Día ISO: 1 = lunes … 7 = domingo. */
  weekday: number;
  startLocal: string;
  /** Si es menor o igual que el inicio, la ventana cruza la medianoche. */
  endLocal: string;
}

export interface AvailabilityException {
  localDate: string;
  startLocal: string;
  endLocal: string;
  kind: 'available' | 'blocked';
}

function windowFor(localDate: string, startLocal: string, endLocal: string, zone: string): Span {
  const start = localToInstant(localDate, startLocal, zone).ms;
  const endDate = endLocal <= startLocal ? addDays(localDate, 1) : localDate;
  const end = localToInstant(endDate, endLocal, zone).ms;
  return { start, end };
}

/** Ventanas de disponibilidad entre `from` y `to`, ya convertidas a instantes. */
export function buildWindows(
  rules: readonly AvailabilityRule[],
  exceptions: readonly AvailabilityException[],
  zone: string,
  from: number,
  to: number,
): Span[] {
  const spans: Span[] = [];
  const blocked: Span[] = [];
  // Empieza un día antes para incluir ventanas que cruzan la medianoche.
  let date = addDays(localParts(from, zone).date, -1);
  const lastDate = localParts(to, zone).date;
  while (date <= lastDate) {
    const wd = weekdayOf(date);
    for (const r of rules) if (r.weekday === wd) spans.push(windowFor(date, r.startLocal, r.endLocal, zone));
    for (const e of exceptions) {
      if (e.localDate !== date) continue;
      const w = windowFor(date, e.startLocal, e.endLocal, zone);
      (e.kind === 'available' ? spans : blocked).push(w);
    }
    date = addDays(date, 1);
  }
  return clipSpans(subtractSpans(mergeSpans(spans), blocked), from, to);
}

/** Minutos disponibles por semana según las reglas (para mostrar en onboarding y ajustes). */
export function weeklyMinutes(rules: readonly AvailabilityRule[]): number {
  return rules.reduce((sum, r) => {
    const [sh, sm] = r.startLocal.split(':').map(Number) as [number, number];
    const [eh, em] = r.endLocal.split(':').map(Number) as [number, number];
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    return sum + mins;
  }, 0);
}
