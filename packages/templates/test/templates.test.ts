import { describe, expect, it } from 'vitest';
import { ObjectiveListSchema } from '@drfocus/contracts';
import { TEMPLATES, batches, buildObjectives, defaultAnswers, getTemplate, templatesFor } from '../src/index.ts';

const ctx = { preferredBlockMinutes: 20 };

describe('plantillas', () => {
  it('hay cuatro por perfil', () => {
    expect(templatesFor('student').map((t) => t.id)).toEqual(['student.exercises', 'student.essay', 'student.exam', 'student.project']);
    expect(templatesFor('teacher').map((t) => t.id)).toEqual(['teacher.lesson', 'teacher.assessment', 'teacher.grading', 'teacher.material']);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s genera objetivos válidos sin red', (_id, t) => {
    const objs = buildObjectives(t, defaultAnswers(t), ctx);
    expect(ObjectiveListSchema.safeParse(objs).success).toBe(true);
    for (const o of objs) {
      expect(o.title.length).toBeGreaterThan(3);
      expect(o.expectedResult.length).toBeGreaterThan(3);
      expect(o.estimatedMinutes).toBeGreaterThanOrEqual(5);
      expect(o.estimatedMinutes).toBeLessThanOrEqual(120);
    }
  });

  it('calificar 40 trabajos conserva el conteo', () => {
    const t = getTemplate('teacher.grading')!;
    const objs = buildObjectives(t, { count: 40, minutesPerItem: 10, rubric: 'Sí', capture: 'Sí, en plataforma' }, ctx);
    const lots = objs.filter((o) => o.key.startsWith('batch-'));
    const graded = lots.reduce((n, o) => {
      const m = o.title.match(/(\d+)(?:–(\d+))?$/)!;
      return n + (Number(m[2] ?? m[1]) - Number(m[1]) + 1);
    }, 0);
    expect(graded).toBe(40);
    expect(lots.every((o) => o.dependsOn.includes('criteria'))).toBe(true);
    expect(objs.at(-1)!.key).toBe('capture');
  });

  it('lotes: reparto exacto y tope de lotes', () => {
    expect(batches(40, 10, 20)).toEqual(Array(20).fill(2));
    expect(batches(13, 6, 20).reduce((a, b) => a + b, 0)).toBe(13);
    const big = batches(500, 3, 20);
    expect(big.length).toBeLessThanOrEqual(24);
    expect(big.reduce((a, b) => a + b, 0)).toBe(500);
    expect(batches(7, 200, 20)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('omite pasos ya hechos y hereda sus dependencias', () => {
    const t = getTemplate('student.essay')!;
    const objs = buildObjectives(t, { ...defaultAnswers(t), alreadyDone: ['topic', 'sources'] }, ctx);
    expect(objs.find((o) => o.key === 'topic')).toBeUndefined();
    expect(objs.find((o) => o.key === 'outline')!.dependsOn).toEqual(['requirements']);
  });

  it('divide pasos de más de 120 minutos', () => {
    const t = getTemplate('teacher.grading')!;
    const objs = buildObjectives(t, { count: 3, minutesPerItem: 100 }, { preferredBlockMinutes: 20 });
    expect(objs.every((o) => o.estimatedMinutes <= 120)).toBe(true);
  });

  it('el perfil docente tiene ejemplos propios', () => {
    for (const t of templatesFor('teacher')) expect(t.example.title).not.toMatch(/estudiante/i);
  });
});
