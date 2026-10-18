import { describe, expect, it } from 'vitest';
import { AgentRequestSchema, AgentResponseSchema, checkGraph } from '../src/index.ts';

const RID = '6f1f1a52-6a0e-4a43-9f53-0f3c7d7b8a11';

describe('contrato del agente', () => {
  it('acepta la solicitud de ejemplo de la especificación', () => {
    const r = AgentRequestSchema.safeParse({
      schemaVersion: 1, requestId: RID, mode: 'decompose', role: 'teacher', locale: 'es-MX',
      activity: { title: 'Organizar feria de ciencias', expectedResult: 'Propuesta de organización', requirements: [], deadlineAt: '2026-11-06T21:00:00Z', timezone: 'America/Mexico_City', progressSummary: 'Sin iniciar' },
      preferredBlockMinutes: 20, answers: [], targetObjective: null,
    });
    expect(r.success).toBe(true);
  });

  it('split requiere objetivo', () => {
    const r = AgentRequestSchema.safeParse({
      schemaVersion: 1, requestId: RID, mode: 'split', role: 'student', locale: 'es-MX',
      activity: { title: 'X', deadlineAt: '2026-11-06T21:00:00Z', timezone: 'America/Mexico_City' }, preferredBlockMinutes: 20,
    });
    expect(r.success).toBe(false);
  });

  it('rechaza propuestas con ciclos, minutos fuera de rango o más de 3 preguntas', () => {
    const p = (objectives: unknown[]) => AgentResponseSchema.safeParse({ schemaVersion: 1, requestId: RID, kind: 'proposal', objectives });
    const o = (localId: string, dependsOn: string[], estimatedMinutes = 15) => ({ localId, title: 'Hacer algo', expectedResult: 'Algo hecho', estimatedMinutes, dependsOn });
    expect(p([o('a', []), o('b', ['a'])]).success).toBe(true);
    expect(p([o('a', ['b']), o('b', ['a'])]).success).toBe(false);
    expect(p([o('a', ['zzz'])]).success).toBe(false);
    expect(p([o('a', [], 200)]).success).toBe(false);
    const q = { id: 'q', text: '¿?', options: [] };
    expect(AgentResponseSchema.safeParse({ schemaVersion: 1, requestId: RID, kind: 'needs_clarification', questions: [q, q, q, q] }).success).toBe(false);
  });

  it('checkGraph informa duplicados y autorreferencias', () => {
    expect(checkGraph([{ key: 'a', dependsOn: ['a'] }, { key: 'a', dependsOn: [] }]).map((i) => i.kind)).toEqual(['duplicate_key', 'self_dependency']);
  });
});
