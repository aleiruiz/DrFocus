import { describe, expect, it } from 'vitest';
import type { ProposedPlan } from '../../db/repo';
import { comparePlan, objectivesSnapshot, shouldReuseSplit } from './replan-model';

const obj = (key: string, status: 'todo' | 'completed', extra: { dueAt?: string | null; existingId?: string | null } = {}) => ({
  key,
  existingId: key,
  title: `Paso ${key}`,
  expectedResult: 'Listo',
  estimatedMinutes: 20,
  remainingMinutes: 20,
  dependsOn: [],
  status,
  source: 'template' as const,
  dueAt: null,
  ...extra,
});
const sess = (objectiveKey: string, startsAt: string) => ({ objectiveKey, startsAt, endsAt: startsAt, locked: false });

describe('comparePlan', () => {
  it('separa lo que cambia, lo nuevo, lo igual, lo reemplazado y lo terminado', () => {
    const plan = {
      objectives: [obj('a', 'completed', { dueAt: '2026-10-17T10:00:00.000Z' }), obj('b', 'todo'), obj('c', 'todo'), obj('n', 'todo', { existingId: null })],
      schedule: {
        algorithmVersion: 1,
        sessions: [sess('b', '2026-10-20T10:00:00.000Z'), sess('c', '2026-10-21T10:00:00.000Z'), sess('n', '2026-10-22T10:00:00.000Z')],
        objectiveDueAt: { b: '2026-10-20T11:00:00.000Z', c: '2026-10-21T11:00:00.000Z', n: '2026-10-22T11:00:00.000Z' },
        conflicts: [],
        unassignedMinutes: 0,
        availableMinutes: 600,
        requiredMinutes: 60,
        feasible: true,
      },
      assumptions: [],
      before: [
        { key: 'a', title: 'Paso a', sessionStart: null, dueAt: '2026-10-17T10:00:00.000Z' },
        { key: 'b', title: 'Paso b', sessionStart: '2026-10-18T10:00:00.000Z', dueAt: '2026-10-18T11:00:00.000Z' },
        { key: 'c', title: 'Paso c', sessionStart: '2026-10-21T10:00:00.000Z', dueAt: '2026-10-21T11:00:00.000Z' },
        { key: 'd', title: 'Paso d', sessionStart: null, dueAt: null },
      ],
    } satisfies ProposedPlan;
    const r = comparePlan(plan);
    expect(r.done.map((x) => x.key)).toEqual(['a']);
    expect(r.pending.map((x) => [x.key, x.kind])).toEqual([['b', 'moved'], ['c', 'same'], ['n', 'added']]);
    expect(r.removed.map((x) => x.key)).toEqual(['d']);
    expect(r.changes).toBe(3);
  });
});

describe('shouldReuseSplit', () => {
  const row = (id: string, status: string, remainingMinutes = 30) => ({ id, status, remainingMinutes, estimatedMinutes: 30, title: `Paso ${id}`, expectedResult: 'Listo' });
  const opened = objectivesSnapshot([row('a', 'completed', 0), row('p', 'todo')]);

  it('reutiliza la división recién hecha y la conserva mientras nada cambie', () => {
    expect(shouldReuseSplit(null, opened, true)).toBe(true);
    expect(shouldReuseSplit(opened, objectivesSnapshot([row('p', 'todo'), row('a', 'completed', 0)]), false)).toBe(true);
  });

  it('descarta una división pendiente si la pantalla se abre sin venir de «Dividir más»', () => {
    expect(shouldReuseSplit(null, opened, false)).toBe(false);
  });

  it('descarta la división si el paso dividido cambió (completado o con avance)', () => {
    expect(shouldReuseSplit(opened, objectivesSnapshot([row('a', 'completed', 0), row('p', 'completed', 0)]), true)).toBe(false);
    expect(shouldReuseSplit(opened, objectivesSnapshot([row('a', 'completed', 0), row('p', 'in_progress', 10)]), true)).toBe(false);
  });

  it('descarta la división si se borró o reabrió otro paso', () => {
    expect(shouldReuseSplit(opened, objectivesSnapshot([row('p', 'todo')]), true)).toBe(false);
    expect(shouldReuseSplit(opened, objectivesSnapshot([row('a', 'todo'), row('p', 'todo')]), true)).toBe(false);
  });
});
