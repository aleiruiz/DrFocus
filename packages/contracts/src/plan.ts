import { z } from 'zod';
import { LIMITS, ObjectiveSourceSchema, ObjectiveStatusSchema, IsoInstantSchema } from './common.ts';
import { checkGraph } from './graph.ts';

/** Objetivo dentro de una propuesta de plan (vista previa o replanificación). */
export const ObjectiveDraftSchema = z.object({
  key: z.string().min(1).max(64),
  existingId: z.string().nullable().optional(),
  title: z.string().trim().min(3, 'Escribe qué vas a hacer').max(LIMITS.titleMax),
  expectedResult: z.string().trim().min(3, 'Escribe cómo sabrás que terminaste').max(300),
  estimatedMinutes: z.number().int().min(LIMITS.objectiveMinutesMin).max(LIMITS.objectiveMinutesMax),
  remainingMinutes: z.number().int().min(0).max(LIMITS.objectiveMinutesMax),
  dependsOn: z.array(z.string()).max(LIMITS.objectivesMax),
  status: ObjectiveStatusSchema,
  source: ObjectiveSourceSchema,
  isReview: z.boolean().optional(),
  /** Fecha límite explícita del usuario; si falta, la deriva el planificador. */
  dueAt: IsoInstantSchema.nullable().optional(),
});
export type ObjectiveDraft = z.infer<typeof ObjectiveDraftSchema>;

export const ObjectiveListSchema = z
  .array(ObjectiveDraftSchema)
  .min(1, 'El plan necesita al menos un objetivo')
  .max(LIMITS.objectivesMax)
  .superRefine((list, ctx) => {
    for (const issue of checkGraph(list)) {
      ctx.addIssue({ code: 'custom', message: describeGraphIssue(issue) });
    }
  });

export function describeGraphIssue(issue: ReturnType<typeof checkGraph>[number]): string {
  switch (issue.kind) {
    case 'duplicate_key':
      return `Hay dos objetivos con la misma clave (${issue.key}).`;
    case 'self_dependency':
      return 'Un objetivo no puede depender de sí mismo.';
    case 'unknown_dependency':
      return 'Un objetivo depende de otro que ya no existe.';
    case 'cycle':
      return 'Las dependencias forman un círculo: ningún paso podría empezar.';
  }
}
