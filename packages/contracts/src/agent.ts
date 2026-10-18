import { z } from 'zod';
import { LIMITS, RoleSchema, IsoInstantSchema } from './common.ts';
import { checkGraph } from './graph.ts';

export const AGENT_SCHEMA_VERSION = 1 as const;

export const AgentQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(300),
  options: z.array(z.string().min(1).max(80)).max(6).default([]),
});
export type AgentQuestion = z.infer<typeof AgentQuestionSchema>;

export const AgentAnswerSchema = z.object({
  questionId: z.string().min(1).max(64),
  question: z.string().max(300),
  answer: z.string().max(1000),
});
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;

export const AgentRequestSchema = z
  .object({
    schemaVersion: z.literal(AGENT_SCHEMA_VERSION),
    requestId: z.uuid(),
    mode: z.enum(['decompose', 'split']),
    role: RoleSchema,
    locale: z.literal('es-MX'),
    activity: z.object({
      title: z.string().trim().min(1).max(LIMITS.titleMax),
      description: z.string().max(LIMITS.descriptionMax).default(''),
      expectedResult: z.string().max(300).default(''),
      requirements: z.array(z.string().max(300)).max(20).default([]),
      deadlineAt: IsoInstantSchema,
      timezone: z.string().min(1).max(64),
      progressSummary: z.string().max(500).default(''),
    }),
    preferredBlockMinutes: z.number().int().min(5).max(120),
    answers: z.array(AgentAnswerSchema).max(LIMITS.questionsPerTurnMax * LIMITS.clarificationRoundsMax).default([]),
    targetObjective: z
      .object({
        title: z.string().max(LIMITS.titleMax),
        expectedResult: z.string().max(300),
        remainingMinutes: z.number().int().min(0).max(LIMITS.objectiveMinutesMax),
      })
      .nullable()
      .default(null),
  })
  .superRefine((req, ctx) => {
    if (req.mode === 'split' && !req.targetObjective) {
      ctx.addIssue({ code: 'custom', message: 'El modo split requiere targetObjective' });
    }
    const size =
      req.activity.title.length +
      req.activity.description.length +
      req.activity.expectedResult.length +
      req.activity.requirements.join('').length +
      req.activity.progressSummary.length +
      req.answers.reduce((n, a) => n + a.question.length + a.answer.length, 0);
    if (size > LIMITS.contextMax) ctx.addIssue({ code: 'custom', message: 'El contexto excede 12 000 caracteres' });
  });
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentRequestInput = z.input<typeof AgentRequestSchema>;

export const AgentObjectiveSchema = z.object({
  localId: z.string().min(1).max(64),
  title: z.string().trim().min(3).max(LIMITS.titleMax),
  expectedResult: z.string().trim().min(3).max(300),
  estimatedMinutes: z.number().int().min(LIMITS.objectiveMinutesMin).max(LIMITS.objectiveMinutesMax),
  dependsOn: z.array(z.string()).max(LIMITS.objectivesMax),
});
export type AgentObjective = z.infer<typeof AgentObjectiveSchema>;

const ClarificationSchema = z.object({
  schemaVersion: z.literal(AGENT_SCHEMA_VERSION),
  requestId: z.uuid(),
  kind: z.literal('needs_clarification'),
  questions: z.array(AgentQuestionSchema).min(1).max(LIMITS.questionsPerTurnMax),
  assumptions: z.array(z.string().max(300)).max(10).default([]),
});

const ProposalSchema = z.object({
  schemaVersion: z.literal(AGENT_SCHEMA_VERSION),
  requestId: z.uuid(),
  kind: z.literal('proposal'),
  assumptions: z.array(z.string().max(300)).max(10).default([]),
  objectives: z.array(AgentObjectiveSchema).min(1).max(LIMITS.objectivesMax),
  warnings: z.array(z.string().max(300)).max(10).default([]),
});

/** Respuesta del agente con validación semántica (ids únicos, dependencias internas, sin ciclos). */
export const AgentResponseSchema = z.discriminatedUnion('kind', [ClarificationSchema, ProposalSchema]).superRefine((res, ctx) => {
  if (res.kind !== 'proposal') return;
  const issues = checkGraph(res.objectives.map((o) => ({ key: o.localId, dependsOn: o.dependsOn })));
  for (const issue of issues) ctx.addIssue({ code: 'custom', message: `Grafo inválido: ${issue.kind}` });
});
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type AgentProposal = z.infer<typeof ProposalSchema>;

export const AgentErrorCodeSchema = z.enum([
  'invalid_request',
  'invalid_token',
  'daily_limit',
  'provider_error',
  'timeout',
  'network',
]);
export type AgentErrorCode = z.infer<typeof AgentErrorCodeSchema>;

export const AgentErrorSchema = z.object({
  code: AgentErrorCodeSchema,
  message: z.string(),
  requestId: z.string().nullable(),
  retryable: z.boolean(),
});
export type AgentError = z.infer<typeof AgentErrorSchema>;

export const HTTP_STATUS_BY_CODE: Record<Exclude<AgentErrorCode, 'network'>, number> = {
  invalid_request: 400,
  invalid_token: 401,
  daily_limit: 429,
  provider_error: 502,
  timeout: 504,
};
