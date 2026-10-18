import { describe, expect, it } from 'vitest';
import { buildPilotExport } from '../../../../packages/domain/src/index.ts';
import type { Activity, Objective } from '../db/schema';
import { toExportActivity, toExportObjective } from './export-rows';

const SECRET = 'tema-personal-secreto';

const activity: Activity = {
  id: 'a1', role: 'student', typeId: 'essay', templateVersion: 1, title: `Título ${SECRET}`, description: `Desc ${SECRET}`,
  expectedResult: `Resultado ${SECRET}`, requirementsJson: JSON.stringify({ tema: SECRET }), deadlineAt: '2026-11-01T18:00:00.000Z',
  deadlineZone: 'America/Mexico_City', status: 'active', revision: 1, createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z', deletedAt: null,
};

const objective: Objective = {
  id: 'o1', activityId: 'a1', title: `Paso ${SECRET}`, expectedResult: `Resultado ${SECRET}`, estimatedMinutes: 30, remainingMinutes: 30,
  dueAt: null, status: 'todo', orderIndex: 0, completedAt: null, source: 'template', isReview: false, updatedAt: '2026-10-18T00:00:00.000Z',
};

const exportWith = (includeText: boolean) =>
  buildPilotExport({
    participantAlias: 'ajolote-TEST', exportedAt: '2026-10-18T00:00:00.000Z', appVersion: '0.1.0', includeText,
    activities: [toExportActivity(activity)], objectives: [toExportObjective(objective)], events: [],
  });

describe('exportación del piloto desde filas de SQLite', () => {
  it('sin consentimiento no sale ningún texto libre, aunque la fila tenga columnas extra', () => {
    const { json, csv } = exportWith(false);
    expect(json).not.toContain(SECRET);
    expect(csv).not.toContain(SECRET);
    expect(json).not.toContain('requirementsJson');
    expect(json).not.toContain('expectedResult');
    expect(json).toContain('"typeId": "essay"');
  });

  it('con consentimiento incluye títulos y descripciones, pero no otras columnas', () => {
    const { json } = exportWith(true);
    expect(json).toContain(`Título ${SECRET}`);
    expect(json).toContain(`Paso ${SECRET}`);
    expect(json).not.toContain('requirementsJson');
    expect(json).not.toContain('expectedResult');
  });
});
