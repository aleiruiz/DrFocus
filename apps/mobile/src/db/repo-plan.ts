import { and, eq } from 'drizzle-orm';
import { nowIso } from '@/lib/ids';
import { db } from './client';
import * as s from './schema';

/**
 * Cambia la fecha límite de una actividad en borrador. Solo se llama tras una decisión explícita
 * de la persona en la vista previa (TECH_SPEC §6: nunca se mueve la entrega por cuenta propia).
 */
export function setDraftDeadline(activityId: string, deadlineAt: string) {
  db.update(s.activities).set({ deadlineAt, updatedAt: nowIso() }).where(and(eq(s.activities.id, activityId), eq(s.activities.status, 'draft'))).run();
}
