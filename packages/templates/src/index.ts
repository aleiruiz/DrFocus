import type { Role, TemplateId } from '@drfocus/contracts';
import { TEMPLATES } from './catalog.ts';
import type { ActivityTemplate } from './types.ts';

export * from './types.ts';
export { buildObjectives, batches, ranges } from './helpers.ts';
export { TEMPLATES };

export const CUSTOM_TYPE = { id: 'custom' as const, name: 'Otra actividad', hint: 'Lo armamos platicando', icon: 'sparkle' };

export function templatesFor(role: Role): ActivityTemplate[] {
  return TEMPLATES.filter((t) => t.role === role);
}

export function getTemplate(id: TemplateId | string): ActivityTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function defaultAnswers(t: ActivityTemplate): Record<string, string | number | string[]> {
  const out: Record<string, string | number | string[]> = {};
  for (const q of t.questions) if (q.defaultValue !== undefined) out[q.id] = q.defaultValue;
  return out;
}
