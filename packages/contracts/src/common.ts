import { z } from 'zod';

export const RoleSchema = z.enum(['student', 'teacher']);
export type Role = z.infer<typeof RoleSchema>;

export const ActivityStatusSchema = z.enum(['draft', 'active', 'completed', 'archived']);
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;

export const ObjectiveStatusSchema = z.enum(['todo', 'in_progress', 'completed', 'skipped']);
export type ObjectiveStatus = z.infer<typeof ObjectiveStatusSchema>;

export const TemplateIdSchema = z.enum([
  'student.exercises',
  'student.essay',
  'student.exam',
  'student.project',
  'teacher.lesson',
  'teacher.assessment',
  'teacher.grading',
  'teacher.material',
  'custom',
]);
export type TemplateId = z.infer<typeof TemplateIdSchema>;

export const ObjectiveSourceSchema = z.enum(['template', 'agent', 'manual']);
export type ObjectiveSource = z.infer<typeof ObjectiveSourceSchema>;

/** Límites compartidos por la app y la función del agente (TECH_SPEC §4 y §7). */
export const LIMITS = {
  titleMax: 120,
  descriptionMax: 4000,
  contextMax: 12000,
  payloadBytesMax: 64 * 1024,
  objectiveMinutesMin: 5,
  objectiveMinutesMax: 120,
  objectivesMax: 30,
  questionsPerTurnMax: 3,
  clarificationRoundsMax: 3,
} as const;

export const IsoInstantSchema = z.iso.datetime({ offset: true });
export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)');
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (aaaa-mm-dd)');
