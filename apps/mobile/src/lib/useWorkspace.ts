import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { isNull } from 'drizzle-orm';
import { useMemo } from 'react';
import { isBlocked } from '@drfocus/domain';
import { db, schema as s } from '@/db/client';
import type { Activity, Objective, WorkSession } from '@/db/schema';

export interface ObjectiveView extends Objective {
  activity: Activity;
  blocked: boolean;
  nextSession: WorkSession | null;
  sessions: WorkSession[];
  dependsOn: string[];
}

/** Vista reactiva de actividades, objetivos y sesiones (se actualiza con cada cambio en SQLite). */
export function useWorkspace() {
  const { data: activities } = useLiveQuery(db.select().from(s.activities).where(isNull(s.activities.deletedAt)));
  const { data: objectives } = useLiveQuery(db.select().from(s.objectives));
  const { data: sessions } = useLiveQuery(db.select().from(s.workSessions));
  const { data: deps } = useLiveQuery(db.select().from(s.objectiveDependencies));

  return useMemo(() => {
    const actById = new Map(activities.map((a) => [a.id, a]));
    const statusById = new Map(objectives.map((o) => [o.id, o.status]));
    const now = Date.now();
    const views: ObjectiveView[] = [];
    for (const o of objectives) {
      const activity = actById.get(o.activityId);
      if (!activity) continue;
      const own = sessions.filter((x) => x.objectiveId === o.id && x.status === 'planned').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      views.push({
        ...o,
        activity,
        blocked: isBlocked(o.id, deps, statusById),
        sessions: own,
        nextSession: own.find((x) => Date.parse(x.endsAt) > now) ?? null,
        dependsOn: deps.filter((d) => d.objectiveId === o.id).map((d) => d.dependsOnId),
      });
    }
    views.sort((a, b) => a.orderIndex - b.orderIndex);
    return { activities, objectives: views };
  }, [activities, objectives, sessions, deps]);
}
