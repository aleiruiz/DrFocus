import { colors, radius, space } from '@drfocus/design-tokens';
import { isPending, progress } from '@drfocus/domain';
import { getTemplate } from '@drfocus/templates';
import { View } from 'react-native';
import type { Activity } from '@/db/schema';
import { cap, fmtDur, fmtLong, fmtTime } from '@/lib/format';
import type { ObjectiveView } from '@/lib/useWorkspace';
import { ProgressBar, T } from '../ui';

/** Encabezado del detalle: tipo, título, fecha límite y progreso. */
export function ActivitySummary({ a, objectives, zone }: { a: Activity; objectives: ObjectiveView[]; zone: string }) {
  const p = progress(objectives);
  const left = objectives.filter(isPending).reduce((n, o) => n + o.remainingMinutes, 0);
  const typeName = a.typeId === 'custom' ? 'Otra actividad' : (getTemplate(a.typeId)?.name ?? a.typeId);
  return (
    <View style={{ backgroundColor: colors.petrol, borderRadius: radius.lg, padding: space.lg, gap: space.sm }}>
      <T v="eyebrow" color={colors.turq100}>{typeName}</T>
      <T v="h2" color={colors.white} accessibilityRole="header">{a.title}</T>
      {a.expectedResult ? <T v="small" color={colors.turq100}>{a.expectedResult}</T> : null}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: space.md }}>
        <T v="small" color={colors.turq100}>Fecha límite de la actividad</T>
        <T v="bodyBold" color={colors.white}>{cap(fmtLong(a.deadlineAt, zone))}, {fmtTime(a.deadlineAt, zone)}</T>
      </View>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, gap: 4 }}>
        <ProgressBar done={p.done} total={p.total} label="Avance de la actividad" />
        {left > 0 ? <T v="small" color={colors.ink2}>Faltan {fmtDur(left)} de trabajo.</T> : null}
      </View>
    </View>
  );
}
