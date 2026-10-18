import { DateTime } from 'luxon';
import type { ObjectiveStatus } from '@drfocus/contracts';

export type ReminderKind = 'daily_summary' | 'before_24h' | 'before_1h' | 'overdue';

export interface ReminderObjective {
  id: string;
  activityId: string;
  activityTitle: string;
  title: string;
  dueAt: string | null;
  status: ObjectiveStatus;
  planRevision: number;
}

export interface ReminderInput {
  now: string;
  timezone: string;
  objectives: readonly ReminderObjective[];
  sessions: readonly { objectiveId: string; startsAt: string }[];
  /** Inicio de la disponibilidad por día ISO (1–7), para el resumen diario. */
  dayStarts: Readonly<Record<number, string>>;
  quietStart: string;
  quietEnd: string;
  dailyCap?: number;
  horizonDays?: number;
  max?: number;
}

export interface ReminderPlan {
  kind: ReminderKind;
  fireAt: string;
  activityId: string;
  objectiveId: string | null;
  objectiveIds: string[];
  title: string;
  body: string;
  data: { activityId: string; objectiveId: string | null; planRevision: number };
}

const PRIORITY: Record<ReminderKind, number> = { before_1h: 0, before_24h: 1, overdue: 2, daily_summary: 3 };
const HOUR = 3_600_000;
const MINUTE = 60_000;

/** Calcula los avisos de los próximos días (TECH_SPEC §8). Pura y determinista. */
export function computeReminders(input: ReminderInput): ReminderPlan[] {
  const zone = input.timezone;
  const now = Date.parse(input.now);
  const horizon = now + (input.horizonDays ?? 7) * 24 * HOUR;
  const cap = input.dailyCap ?? 4;
  const max = input.max ?? 48;
  const quiet = quietChecker(input.quietStart, input.quietEnd, zone);
  const candidates: ReminderPlan[] = [];
  const pending = input.objectives.filter((o) => o.status === 'todo' || o.status === 'in_progress');

  for (const o of pending) {
    if (!o.dueAt) continue;
    const due = Date.parse(o.dueAt);
    const data = { activityId: o.activityId, objectiveId: o.id, planRevision: o.planRevision };
    const base = { activityId: o.activityId, objectiveId: o.id, objectiveIds: [o.id], data };
    const before = (kind: 'before_24h' | 'before_1h', offset: number) => {
      let at = due - offset;
      if (quiet.inside(at)) at = quiet.lastAllowedBefore(at);
      if (at > now && at < due) candidates.push({ ...base, kind, fireAt: iso(at), ...texts(kind, o, due, zone) });
    };
    before('before_24h', 24 * HOUR);
    before('before_1h', HOUR);
    let late = due + 2 * HOUR;
    if (quiet.inside(late)) late = quiet.nextAllowedAfter(late);
    if (late > now) candidates.push({ ...base, kind: 'overdue', fireAt: iso(late), ...texts('overdue', o, due, zone) });
  }

  // Resumen diario al inicio de la disponibilidad, si ese día hay objetivos.
  const byId = new Map(pending.map((o) => [o.id, o]));
  let day = DateTime.fromMillis(now, { zone }).startOf('day');
  while (day.toMillis() < horizon) {
    const start = input.dayStarts[day.weekday];
    if (start) {
      const [h, m] = start.split(':').map(Number) as [number, number];
      let at = day.set({ hour: h, minute: m }).toMillis();
      if (quiet.inside(at)) at = quiet.nextAllowedAfter(at);
      const dayEnd = day.endOf('day').toMillis();
      const todays = input.sessions
        .filter((s) => byId.has(s.objectiveId) && Date.parse(s.startsAt) >= day.toMillis() && Date.parse(s.startsAt) <= dayEnd)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      const ids = [...new Set(todays.map((s) => s.objectiveId))];
      const first = ids.length ? byId.get(ids[0]!)! : null;
      if (first && at > now) {
        candidates.push({
          kind: 'daily_summary',
          fireAt: iso(at),
          activityId: first.activityId,
          objectiveId: first.id,
          objectiveIds: ids,
          title: 'Tu plan de hoy',
          body: `${ids.length === 1 ? '1 objetivo programado' : `${ids.length} objetivos programados`}. Empieza con: ${first.title}.`,
          data: { activityId: first.activityId, objectiveId: first.id, planRevision: first.planRevision },
        });
      }
    }
    day = day.plus({ days: 1 });
  }

  const inWindow = candidates.filter((c) => Date.parse(c.fireAt) > now && Date.parse(c.fireAt) <= horizon);
  const grouped = group(inWindow);

  // Tope diario por prioridad: vencimiento próximo > atraso > resumen.
  const byDay = new Map<string, ReminderPlan[]>();
  for (const r of grouped) {
    const k = DateTime.fromISO(r.fireAt, { zone }).toISODate()!;
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  const kept: ReminderPlan[] = [];
  for (const list of byDay.values()) {
    list.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || Date.parse(a.fireAt) - Date.parse(b.fireAt));
    kept.push(...list.slice(0, cap));
  }
  return kept.sort((a, b) => Date.parse(a.fireAt) - Date.parse(b.fireAt) || PRIORITY[a.kind] - PRIORITY[b.kind]).slice(0, max);
}

/** Agrupa avisos que caen en el mismo minuto. */
function group(list: ReminderPlan[]): ReminderPlan[] {
  const map = new Map<string, ReminderPlan[]>();
  for (const r of list) {
    const k = String(Math.floor(Date.parse(r.fireAt) / MINUTE));
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  const out: ReminderPlan[] = [];
  for (const items of map.values()) {
    if (items.length === 1) {
      out.push(items[0]!);
      continue;
    }
    items.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
    const lead = items[0]!;
    const ids = [...new Set(items.flatMap((i) => i.objectiveIds))];
    out.push({
      ...lead,
      objectiveIds: ids,
      title: lead.kind === 'daily_summary' ? lead.title : `${lead.title} y ${items.length - 1} más`,
      body: lead.kind === 'daily_summary' ? lead.body : `${lead.body} Abre Doctor Focus para ver todo.`,
    });
  }
  return out;
}

function texts(kind: Exclude<ReminderKind, 'daily_summary'>, o: ReminderObjective, due: number, zone: string) {
  const when = DateTime.fromMillis(due, { zone }).setLocale('es-MX').toFormat("ccc d 'de' LLL, h:mm a");
  switch (kind) {
    case 'before_24h':
      return { title: `Mañana vence: ${o.title}`, body: `${o.activityTitle} · ${when}. Un paso pequeño hoy lo deja listo.` };
    case 'before_1h':
      return { title: `En 1 hora: ${o.title}`, body: `${o.activityTitle} · ${when}. Vamos por un paso.` };
    case 'overdue':
      return { title: `¿Cómo vas con «${o.title}»?`, body: 'Puedes marcarlo, registrar tu avance o reorganizar el plan.' };
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Horario de silencio en la zona local; puede cruzar la medianoche. */
export function quietChecker(start: string, end: string, zone: string) {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number) as [number, number];
    return h * 60 + m;
  };
  const s = toMin(start);
  const e = toMin(end);
  const minuteOf = (ms: number) => {
    const dt = DateTime.fromMillis(ms, { zone });
    return dt.hour * 60 + dt.minute;
  };
  const inside = (ms: number) => {
    if (s === e) return false;
    const m = minuteOf(ms);
    return s < e ? m >= s && m < e : m >= s || m < e;
  };
  const at = (ms: number, minutes: number, dayOffset: number) =>
    DateTime.fromMillis(ms, { zone }).startOf('day').plus({ days: dayOffset, minutes }).toMillis();
  return {
    inside,
    /** Último minuto permitido antes de que empiece el silencio en curso. */
    lastAllowedBefore(ms: number) {
      const m = minuteOf(ms);
      const dayOffset = s < e || m >= s ? 0 : -1;
      return at(ms, s, dayOffset) - MINUTE;
    },
    /** Primer instante permitido después del silencio en curso. */
    nextAllowedAfter(ms: number) {
      const m = minuteOf(ms);
      const dayOffset = s < e || m < e ? 0 : 1;
      return at(ms, e, dayOffset);
    },
  };
}
