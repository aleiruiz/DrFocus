import type { ExportActivity, ExportEvent, ExportObjective } from '@drfocus/domain';
import type { Activity, Objective } from '@/db/schema';

/**
 * Solo los campos que declara la exportación del piloto. Las demás columnas (resultado esperado,
 * respuestas de la plantilla, etc.) son texto libre y nunca deben salir sin consentimiento.
 */
export function toExportActivity(a: Activity): ExportActivity {
  return {
    id: a.id,
    typeId: a.typeId,
    templateVersion: a.templateVersion,
    status: a.status,
    revision: a.revision,
    deadlineAt: a.deadlineAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    deletedAt: a.deletedAt,
    title: a.title,
    description: a.description,
  };
}

export function toExportObjective(o: Objective): ExportObjective {
  return {
    id: o.id,
    activityId: o.activityId,
    status: o.status,
    source: o.source,
    estimatedMinutes: o.estimatedMinutes,
    remainingMinutes: o.remainingMinutes,
    dueAt: o.dueAt,
    completedAt: o.completedAt,
    updatedAt: o.updatedAt,
    orderIndex: o.orderIndex,
    title: o.title,
  };
}

export function toExportEvent(e: ExportEvent): ExportEvent {
  return { id: e.id, eventType: e.eventType, entityId: e.entityId, occurredAt: e.occurredAt, propertiesJson: e.propertiesJson };
}
