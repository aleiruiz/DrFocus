import { describe, expect, it } from 'vitest';
import type { ProposedPlan } from '../../db/repo';
import { comparePlan } from './replan-model';

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
