import type { ObjectiveDraft, Role, TemplateId } from '@drfocus/contracts';

export type Answers = Record<string, string | number | string[] | undefined>;

export interface TemplateQuestion {
  id: string;
  label: string;
  kind: 'text' | 'textarea' | 'number' | 'choice' | 'multi';
  options?: readonly string[];
  suffix?: string;
  help?: string;
  min?: number;
  max?: number;
  defaultValue?: string | number | string[];
}

export interface Step {
  id: string;
  title: string;
  expectedResult: string;
  minutes: number;
  /** 'prev' depende del paso anterior; un arreglo nombra ids de pasos. Por defecto no depende de nada. */
  after?: 'prev' | readonly string[];
  /** Paso de revisión antes de la entrega (TECH_SPEC §6, punto 6). */
  review?: boolean;
}

export interface ActivityTemplate {
  id: Exclude<TemplateId, 'custom'>;
  version: number;
  role: Role;
  name: string;
  hint: string;
  icon: string;
  questions: readonly TemplateQuestion[];
  /** Pasos que el usuario puede marcar como ya hechos; se omiten del plan. */
  alreadyDone: readonly { stepId: string; label: string }[];
  example: { title: string; expectedResult: string; description: string };
  steps(answers: Answers, ctx: BuildContext): Step[];
}

export interface BuildContext {
  preferredBlockMinutes: number;
}

export type { ObjectiveDraft };
