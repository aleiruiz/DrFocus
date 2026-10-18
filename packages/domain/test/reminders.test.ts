import { describe, expect, it } from 'vitest';
import { computeReminders, quietChecker, type ReminderInput } from '../src/index.ts';

const TZ = 'America/Mexico_City';
const NOW = '2026-10-19T14:10:00.000Z'; // lunes 8:10 a. m.
const obj = (id: string, dueAt: string, status: 'todo' | 'completed' = 'todo') => ({
  id, activityId: 'act', activityTitle: 'Ensayo', title: `Paso ${id}`, dueAt, status, planRevision: 1,
});
const base = (over: Partial<ReminderInput> = {}): ReminderInput => ({
  now: NOW, timezone: TZ, objectives: [], sessions: [], dayStarts: {}, quietStart: '21:00', quietEnd: '08:00', ...over,
});

describe('computeReminders', () => {
  it('programa 24 h y 1 h antes y 2 h después', () => {
    const r = computeReminders(base({ objectives: [obj('a', '2026-10-21T00:00:00.000Z')] })); // martes 6 p. m.
    expect(r.map((x) => [x.kind, x.fireAt])).toEqual([
      ['before_24h', '2026-10-20T00:00:00.000Z'],
      ['before_1h', '2026-10-20T23:00:00.000Z'],
      ['overdue', '2026-10-21T02:00:00.000Z'],
    ]);
    expect(r[0]!.data).toEqual({ activityId: 'act', objectiveId: 'a', planRevision: 1 });
  });

  it('el silencio adelanta avisos previos y retrasa atrasos sin mover la fecha límite', () => {
    // Vence miércoles 22:00 local: 1 h antes = 21:00 (silencio) → 20:59; atraso 00:00 → 08:00.
    const r = computeReminders(base({ objectives: [obj('a', '2026-10-22T04:00:00.000Z')] }));
    const kinds = Object.fromEntries(r.map((x) => [x.kind, x.fireAt]));
    expect(kinds.before_1h).toBe('2026-10-22T02:59:00.000Z');
    expect(kinds.overdue).toBe('2026-10-22T14:00:00.000Z');
    expect(kinds.before_24h).toBe('2026-10-21T02:59:00.000Z');
  });

  it('no programa en el pasado ni para objetivos completados', () => {
    const r = computeReminders(base({ objectives: [obj('a', '2026-10-19T14:30:00.000Z'), obj('b', '2026-10-21T00:00:00.000Z', 'completed')] }));
    expect(r.every((x) => Date.parse(x.fireAt) > Date.parse(NOW))).toBe(true);
    expect(r.some((x) => x.objectiveId === 'b')).toBe(false);
    expect(r.map((x) => x.kind)).toEqual(['overdue']);
  });

  it('agrupa avisos que coinciden', () => {
    const r = computeReminders(base({ objectives: [obj('a', '2026-10-21T00:00:00.000Z'), obj('b', '2026-10-21T00:00:00.000Z')] }));
    expect(r).toHaveLength(3);
    expect(r[0]!.objectiveIds).toEqual(['a', 'b']);
    expect(r[0]!.title).toContain('y 1 más');
  });

  it('respeta el tope diario por prioridad', () => {
    const objectives = ['a', 'b', 'c', 'd', 'e'].map((id, i) => obj(id, `2026-10-21T0${i}:30:00.000Z`));
    const sessions = objectives.map((o) => ({ objectiveId: o.id, startsAt: '2026-10-20T22:00:00.000Z' }));
    const r = computeReminders(base({ objectives, sessions, dayStarts: { 2: '16:00' }, quietStart: '23:00', quietEnd: '06:00' }));
    const perDay = new Map<string, string[]>();
    for (const x of r) {
      const d = new Date(Date.parse(x.fireAt) - 6 * 3600_000).toISOString().slice(0, 10);
      perDay.set(d, [...(perDay.get(d) ?? []), x.kind]);
    }
    for (const kinds of perDay.values()) expect(kinds.length).toBeLessThanOrEqual(4);
    expect(perDay.get('2026-10-20')).not.toContain('daily_summary');
  });

  it('horizonte de 7 días y máximo 48', () => {
    const objectives = Array.from({ length: 40 }, (_, i) => obj(`o${i}`, new Date(Date.parse(NOW) + (i + 1) * 5 * 3600_000).toISOString()));
    const r = computeReminders(base({ objectives, quietStart: '00:00', quietEnd: '00:00', dailyCap: 100 }));
    expect(r.length).toBeLessThanOrEqual(48);
    expect(r.every((x) => Date.parse(x.fireAt) <= Date.parse(NOW) + 7 * 24 * 3600_000)).toBe(true);
  });

  it('resumen diario al inicio de la disponibilidad', () => {
    const r = computeReminders(base({
      objectives: [obj('a', '2026-10-30T00:00:00.000Z')],
      sessions: [{ objectiveId: 'a', startsAt: '2026-10-20T22:00:00.000Z' }],
      dayStarts: { 2: '16:00' },
    }));
    const s = r.find((x) => x.kind === 'daily_summary')!;
    expect(s.fireAt).toBe('2026-10-20T22:00:00.000Z');
    expect(s.body).toContain('Paso a');
  });
});

describe('quietChecker', () => {
  it('detecta silencio que cruza la medianoche', () => {
    const q = quietChecker('21:00', '08:00', TZ);
    expect(q.inside(Date.parse('2026-10-20T04:00:00.000Z'))).toBe(true); // 22:00
    expect(q.inside(Date.parse('2026-10-20T15:00:00.000Z'))).toBe(false); // 9:00
  });
});
