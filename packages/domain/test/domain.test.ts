import { describe, expect, it } from 'vitest';
import type { ObjectiveDraft } from '@drfocus/contracts';
import { buildPilotExport, canCompleteActivity, csvCell, logProgress, organizeToday, progress, splitInHalves, splitObjective } from '../src/index.ts';

const d = (key: string, dependsOn: string[] = [], over: Partial<ObjectiveDraft> = {}): ObjectiveDraft => ({
  key, title: `Paso ${key}`, expectedResult: `Resultado ${key}`, estimatedMinutes: 40, remainingMinutes: 40,
  dependsOn, status: 'todo', source: 'template', existingId: null, dueAt: null, ...over,
});

describe('progreso', () => {
  it('cuenta completados sobre no omitidos', () => {
    expect(progress([{ status: 'completed' }, { status: 'todo' }, { status: 'skipped' }])).toEqual({ done: 1, total: 2, ratio: 0.5 });
    expect(canCompleteActivity([{ status: 'completed' }, { status: 'skipped' }])).toBe(true);
    expect(canCompleteActivity([{ status: 'completed' }, { status: 'in_progress' }])).toBe(false);
  });

  it('registrar avance no completa el objetivo', () => {
    expect(logProgress({ remainingMinutes: 40, status: 'todo' }, 15)).toEqual({ remainingMinutes: 15, status: 'in_progress' });
    expect(logProgress({ remainingMinutes: 40, status: 'todo' }, 0).status).toBe('completed');
  });
});

describe('dividir más', () => {
  it('redirige dependencias entrantes y salientes', () => {
    const list = [d('a'), d('b', ['a']), d('c', ['b'])];
    let n = 0;
    const { objectives, minutesDelta } = splitObjective(list, 'b', splitInHalves(list[1]!), () => `k${n++}`);
    expect(objectives.map((o) => o.key)).toEqual(['a', 'k0', 'k1', 'c']);
    expect(objectives[1]!.dependsOn).toEqual(['a']);
    expect(objectives[2]!.dependsOn).toEqual(['k0']);
    expect(objectives[3]!.dependsOn).toEqual(['k1']);
    expect(minutesDelta).toBe(0);
  });

  it('usa las dependencias internas del agente', () => {
    const list = [d('a'), d('b', ['a'])];
    let n = 0;
    const { objectives } = splitObjective(list, 'a', [
      { localId: 'x', title: 'Parte x', expectedResult: 'Listo x', estimatedMinutes: 15, dependsOn: [] },
      { localId: 'y', title: 'Parte y', expectedResult: 'Listo y', estimatedMinutes: 15, dependsOn: [] },
      { localId: 'z', title: 'Parte z', expectedResult: 'Listo z', estimatedMinutes: 15, dependsOn: ['x', 'y'] },
    ], () => `k${n++}`);
    expect(objectives.find((o) => o.key === 'b')!.dependsOn).toEqual(['k2']);
  });

  it('no divide completados', () => {
    expect(() => splitObjective([d('a', [], { status: 'completed' })], 'a', splitInHalves(d('a')))).toThrow();
  });
});

describe('Hoy', () => {
  it('muestra el siguiente elegible y separa vencidos', () => {
    const now = Date.parse('2026-10-19T14:10:00Z');
    const items = [
      { id: '1', activityId: 'a', status: 'todo' as const, dueAt: '2026-10-18T00:00:00Z', orderIndex: 0, blocked: false, nextSessionAt: null },
      { id: '2', activityId: 'a', status: 'todo' as const, dueAt: '2026-10-21T00:00:00Z', orderIndex: 1, blocked: true, nextSessionAt: '2026-10-19T22:00:00Z' },
      { id: '3', activityId: 'b', status: 'todo' as const, dueAt: '2026-10-21T00:00:00Z', orderIndex: 0, blocked: false, nextSessionAt: '2026-10-19T23:00:00Z' },
    ];
    const r = organizeToday(items, now, Date.parse('2026-10-20T05:59:59Z'));
    expect(r.next?.id).toBe('3');
    expect(r.overdue.map((o) => o.id)).toEqual(['1']);
    expect(r.today.map((o) => o.id)).toEqual(['2']);
  });
});

describe('exportación del piloto', () => {
  const input = {
    participantAlias: 'ajolote-AB12', exportedAt: '2026-10-25T00:00:00Z', appVersion: '0.1.0', includeText: false,
    activities: [{ id: 'a1', typeId: 'student.essay', templateVersion: 1, status: 'active', revision: 2, deadlineAt: '2026-10-24T05:59:00Z', createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z', deletedAt: null, title: 'Ensayo privado', description: 'Notas privadas' }],
    objectives: [{ id: 'o1', activityId: 'a1', status: 'completed', source: 'template', estimatedMinutes: 20, remainingMinutes: 0, dueAt: null, completedAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z', orderIndex: 0, title: '=Paso secreto' }],
    events: [{ id: 'e1', eventType: 'plan_accepted', entityId: 'a1', occurredAt: '2026-10-19T00:00:00Z', propertiesJson: '{"objectives":5}' }],
  };

  it('excluye títulos y descripciones por defecto', () => {
    const { json, csv } = buildPilotExport(input);
    expect(json).not.toContain('privad');
    expect(csv).not.toContain('privad');
    expect(csv).not.toContain('secreto');
    expect(JSON.parse(json).counts).toEqual({ activities: 1, objectives: 1, events: 1 });
    expect(csv.split('\r\n')[0]).toContain('participantAlias');
  });

  it('incluye textos con consentimiento y escapa fórmulas', () => {
    const { json, csv } = buildPilotExport({ ...input, includeText: true });
    expect(json).toContain('Ensayo privado');
    expect(csv).toContain("'=Paso secreto");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
