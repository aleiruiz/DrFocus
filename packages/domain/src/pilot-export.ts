export const PILOT_EVENTS = [
  'onboarding_completed',
  'activity_created',
  'plan_previewed',
  'plan_accepted',
  'objective_edited',
  'objective_split',
  'objective_completed',
  'progress_logged',
  'replan_accepted',
  'reminder_opened',
  'agent_request',
  'agent_error',
] as const;
export type PilotEvent = (typeof PILOT_EVENTS)[number];

export interface ExportActivity {
  id: string;
  typeId: string;
  templateVersion: number;
  status: string;
  revision: number;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  title: string;
  description: string;
}

export interface ExportObjective {
  id: string;
  activityId: string;
  status: string;
  source: string;
  estimatedMinutes: number;
  remainingMinutes: number;
  dueAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  orderIndex: number;
  title: string;
}

export interface ExportEvent {
  id: string;
  eventType: string;
  entityId: string | null;
  occurredAt: string;
  propertiesJson: string;
}

export interface PilotExportInput {
  participantAlias: string;
  exportedAt: string;
  appVersion: string;
  includeText: boolean;
  activities: readonly ExportActivity[];
  objectives: readonly ExportObjective[];
  events: readonly ExportEvent[];
}

/**
 * Exportación del piloto (TECH_SPEC §5). Sin títulos ni descripciones salvo consentimiento explícito.
 */
export function buildPilotExport(input: PilotExportInput): { json: string; csv: string } {
  const t = input.includeText;
  const activities = input.activities.map(({ title, description, ...rest }) => (t ? { ...rest, title, description } : rest));
  const objectives = input.objectives.map(({ title, ...rest }) => (t ? { ...rest, title } : rest));
  const events = input.events.map((e) => ({ ...e, properties: safeParse(e.propertiesJson), propertiesJson: undefined }));
  const json = JSON.stringify(
    {
      schemaVersion: 1,
      participantAlias: input.participantAlias,
      exportedAt: input.exportedAt,
      appVersion: input.appVersion,
      includesText: t,
      counts: { activities: activities.length, objectives: objectives.length, events: events.length },
      activities,
      objectives,
      events,
    },
    null,
    2,
  );

  const header = ['participantAlias', 'record', 'id', 'activityId', 'type', 'status', 'source', 'estimatedMinutes', 'remainingMinutes', 'dueAt', 'completedAt', 'occurredAt', 'revision', 'properties', 'title'];
  const rows: (string | number | null)[][] = [];
  const a = input.participantAlias;
  for (const x of input.activities) rows.push([a, 'activity', x.id, x.id, x.typeId, x.deletedAt ? 'deleted' : x.status, '', '', '', x.deadlineAt, '', x.createdAt, x.revision, '', t ? x.title : '']);
  for (const x of input.objectives) rows.push([a, 'objective', x.id, x.activityId, '', x.status, x.source, x.estimatedMinutes, x.remainingMinutes, x.dueAt, x.completedAt, x.updatedAt, '', '', t ? x.title : '']);
  for (const x of input.events) rows.push([a, 'event', x.id, x.entityId, x.eventType, '', '', '', '', '', '', x.occurredAt, '', x.propertiesJson, '']);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return { json, csv };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Evita inyección de fórmulas al abrir el CSV en una hoja de cálculo.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Alias anónimo legible, p. ej. «ajolote-7KQ2». */
export function makeParticipantAlias(random: () => number = Math.random): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(random() * chars.length)];
  return `ajolote-${code}`;
}
