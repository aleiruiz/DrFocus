import { describe, expect, it } from 'vitest';
import { buildWindows, localToInstant, planSchedule, validateSchedule, type PlannerInput, type PlannerObjective } from '../src/index.ts';

const TZ = 'America/Mexico_City';
// Lunes 19 oct 2026, 8:10 a. m. en CDMX (UTC−6).
const NOW = '2026-10-19T14:10:00.000Z';
const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startLocal: '16:00', endLocal: '18:00' }));

const chain = (minutes: number[]): PlannerObjective[] =>
  minutes.map((m, i) => ({ key: `s${i + 1}`, remainingMinutes: m, dependsOn: i ? [`s${i}`] : [], status: 'todo' as const }));

const base = (over: Partial<PlannerInput> = {}): PlannerInput => ({
  now: NOW,
  timezone: TZ,
  rules: weekdays,
  objectives: chain([10, 20, 30, 25, 40, 40, 30, 20, 5]),
  deadlineAt: '2026-10-24T05:59:00.000Z', // viernes 23 oct, 11:59 p. m.
  preferredBlockMinutes: 20,
  ...over,
});

describe('planSchedule', () => {
  it('ensayo con una semana: sesiones dentro de la disponibilidad, sin solapes y en orden', () => {
    const input = base();
    const out = planSchedule(input);
    expect(out.feasible).toBe(true);
    expect(out.unassignedMinutes).toBe(0);
    expect(validateSchedule(input, out)).toEqual([]);
    const windows = buildWindows(weekdays, [], TZ, Date.parse(NOW), Date.parse(input.deadlineAt));
    for (const s of out.sessions) {
      const st = Date.parse(s.startsAt);
      const en = Date.parse(s.endsAt);
      expect(windows.some((w) => st >= w.start && en <= w.end)).toBe(true);
    }
    const total = out.sessions.reduce((n, s) => n + (Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 60000, 0);
    expect(total).toBe(220);
  });

  it('misma entrada produce la misma salida', () => {
    expect(planSchedule(base())).toEqual(planSchedule(base()));
  });

  it('detecta falta de tiempo y no lo presenta como viable', () => {
    const out = planSchedule(base({ deadlineAt: '2026-10-19T23:00:00.000Z' })); // lunes 5 p. m.
    expect(out.feasible).toBe(false);
    const c = out.conflicts.find((x) => x.kind === 'insufficient_time');
    expect(c && c.kind === 'insufficient_time' && c.missingMinutes).toBeGreaterThan(0);
    expect(out.unassignedMinutes).toBe(out.requiredMinutes - out.sessions.reduce((n, s) => n + (Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 60000, 0));
  });

  it('rechaza fechas pasadas y ciclos', () => {
    expect(planSchedule(base({ deadlineAt: '2026-10-18T00:00:00.000Z' })).conflicts[0]?.kind).toBe('deadline_past');
    const cyc = planSchedule(base({ objectives: [
      { key: 'a', remainingMinutes: 10, dependsOn: ['b'], status: 'todo' },
      { key: 'b', remainingMinutes: 10, dependsOn: ['a'], status: 'todo' },
    ] }));
    expect(cyc.conflicts.some((c) => c.kind === 'graph' && c.issue.kind === 'cycle')).toBe(true);
    expect(cyc.sessions).toEqual([]);
  });

  it('pide acotar el plan más allá de 90 días', () => {
    expect(planSchedule(base({ deadlineAt: '2027-03-01T00:00:00.000Z' })).conflicts[0]?.kind).toBe('beyond_horizon');
  });

  it('respeta sesiones de otras actividades', () => {
    const busy = [{ startsAt: '2026-10-19T22:00:00.000Z', endsAt: '2026-10-20T00:00:00.000Z' }]; // lunes 16–18 h
    const input = base({ busy });
    const out = planSchedule(input);
    expect(validateSchedule(input, out)).toEqual([]);
    expect(out.sessions.every((s) => Date.parse(s.startsAt) >= Date.parse('2026-10-20T00:00:00.000Z'))).toBe(true);
  });

  it('congela completados y mantiene sesiones fijadas', () => {
    const objectives: PlannerObjective[] = [
      { key: 'a', remainingMinutes: 0, dependsOn: [], status: 'completed' },
      { key: 'b', remainingMinutes: 20, dependsOn: ['a'], status: 'todo', lockedSessions: [{ startsAt: '2026-10-20T22:00:00.000Z', endsAt: '2026-10-20T22:20:00.000Z' }] },
      { key: 'c', remainingMinutes: 15, dependsOn: ['b'], status: 'todo' },
    ];
    const out = planSchedule(base({ objectives }));
    expect(out.sessions.filter((s) => s.objectiveKey === 'a')).toEqual([]);
    const b = out.sessions.filter((s) => s.objectiveKey === 'b');
    expect(b).toEqual([{ objectiveKey: 'b', startsAt: '2026-10-20T22:00:00.000Z', endsAt: '2026-10-20T22:20:00.000Z', locked: true }]);
    const c = out.sessions.find((s) => s.objectiveKey === 'c')!;
    expect(Date.parse(c.startsAt)).toBeGreaterThanOrEqual(Date.parse(b[0]!.endsAt));
  });

  it('admite pasos independientes en paralelo y respeta fechas explícitas', () => {
    const objectives: PlannerObjective[] = [
      { key: 'x', remainingMinutes: 20, dependsOn: [], status: 'todo' },
      { key: 'y', remainingMinutes: 20, dependsOn: [], status: 'todo', dueAt: '2026-10-19T22:30:00.000Z' },
    ];
    const out = planSchedule(base({ objectives }));
    expect(out.sessions[0]!.objectiveKey).toBe('y');
    expect(out.objectiveDueAt.y).toBe('2026-10-19T22:30:00.000Z');
  });

  it('ventanas que cruzan la medianoche', () => {
    const rules = [{ weekday: 1, startLocal: '23:00', endLocal: '01:00' }];
    const w = buildWindows(rules, [], TZ, Date.parse(NOW), Date.parse('2026-10-21T00:00:00.000Z'));
    expect(w).toEqual([{ start: Date.parse('2026-10-20T05:00:00.000Z'), end: Date.parse('2026-10-20T07:00:00.000Z') }]);
  });

  it('excepciones bloquean o agregan tiempo', () => {
    const exceptions = [
      { localDate: '2026-10-19', startLocal: '16:00', endLocal: '18:00', kind: 'blocked' as const },
      { localDate: '2026-10-24', startLocal: '10:00', endLocal: '12:00', kind: 'available' as const },
    ];
    const w = buildWindows(weekdays, exceptions, TZ, Date.parse(NOW), Date.parse('2026-10-25T00:00:00.000Z'));
    expect(w.some((s) => s.start === Date.parse('2026-10-19T22:00:00.000Z'))).toBe(false);
    expect(w.some((s) => s.start === Date.parse('2026-10-24T16:00:00.000Z'))).toBe(true);
  });

  it('dos actividades seguidas no se solapan', () => {
    const first = planSchedule(base({ objectives: chain([60, 60]) }));
    const busy = first.sessions.map((s) => ({ startsAt: s.startsAt, endsAt: s.endsAt }));
    const input = base({ objectives: chain([30, 30]), busy });
    const second = planSchedule(input);
    expect(validateSchedule(input, second)).toEqual([]);
  });

  it('señala horas inexistentes por cambio de horario', () => {
    // Nueva York adelanta el reloj el 8 de marzo de 2026 a las 2:00.
    expect(localToInstant('2026-03-08', '02:30', 'America/New_York').issue).toBe('nonexistent');
    expect(localToInstant('2026-11-01', '01:30', 'America/New_York').issue).toBe('ambiguous');
    expect(localToInstant('2026-10-19', '16:00', TZ).issue).toBeNull();
  });
});
