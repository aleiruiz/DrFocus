import { DateTime } from 'luxon';

/** Formatos en español de México sin depender de Intl (Hermes). */
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_C = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const WEEKDAYS = DIAS.map((name, i) => ({ weekday: i + 1, name, short: DIAS_C[i]! }));

const dt = (iso: string, zone: string) => DateTime.fromISO(iso, { zone });

export function fmtTime(iso: string, zone: string): string {
  const d = dt(iso, zone);
  return fmtClock(d.hour, d.minute);
}

export function fmtClock(hour: number, minute: number): string {
  const suf = hour < 12 ? 'a. m.' : 'p. m.';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${suf}`;
}

export const fmtLocal = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return fmtClock(h, m);
};

export function fmtDate(iso: string, zone: string): string {
  const d = dt(iso, zone);
  return `${DIAS_C[d.weekday - 1]} ${d.day} ${MESES_C[d.month - 1]}`;
}

export function fmtLong(iso: string, zone: string): string {
  const d = dt(iso, zone);
  return `${DIAS[d.weekday - 1]} ${d.day} de ${MESES[d.month - 1]}`;
}

export function fmtDay(iso: string, zone: string, nowMs = Date.now()): string {
  const d = dt(iso, zone).startOf('day');
  const today = DateTime.fromMillis(nowMs, { zone }).startOf('day');
  const k = Math.round(d.diff(today, 'days').days);
  if (k === 0) return 'hoy';
  if (k === 1) return 'mañana';
  if (k === -1) return 'ayer';
  return fmtDate(iso, zone);
}

export const fmtDayTime = (iso: string, zone: string) => `${fmtDay(iso, zone)}, ${fmtTime(iso, zone)}`;

export function fmtRange(startIso: string, endIso: string, zone: string): string {
  return `${fmtDay(startIso, zone)}, ${fmtTime(startIso, zone)}–${fmtTime(endIso, zone)}`;
}

export function fmtDur(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function endOfLocalDay(nowMs: number, zone: string): number {
  return DateTime.fromMillis(nowMs, { zone }).endOf('day').toMillis();
}

/** Fecha y hora locales (aaaa-mm-dd, HH:mm) → instante ISO en la zona. */
export function localToIso(date: string, time: string, zone: string): string | null {
  const d = DateTime.fromISO(`${date}T${time}`, { zone });
  return d.isValid ? d.toUTC().toISO() : null;
}

export function isoToLocalParts(iso: string, zone: string): { date: string; time: string } {
  const d = dt(iso, zone);
  return { date: d.toISODate()!, time: d.toFormat('HH:mm') };
}
