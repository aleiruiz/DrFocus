import { colors, radius, space } from '@drfocus/design-tokens';
import { Pressable, View } from 'react-native';
import { fmtDayTime, fmtDur, fmtRange } from '@/lib/format';
import type { ObjectiveView } from '@/lib/useWorkspace';
import { Icon } from './Icon';
import { T } from './ui';

const STATUS: Record<string, string> = { todo: 'Pendiente', in_progress: 'En curso', completed: 'Terminado', skipped: 'Omitido' };

export function ObjectiveRow({ o, zone, now, onPress, showActivity }: { o: ObjectiveView; zone: string; now: number; onPress: () => void; showActivity?: boolean }) {
  const done = o.status === 'completed';
  const overdue = (o.status === 'todo' || o.status === 'in_progress') && o.dueAt && Date.parse(o.dueAt) < now;
  const state = done ? 'Terminado' : overdue ? 'Vencido' : o.blocked ? 'Espera otro paso' : STATUS[o.status];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${o.title}. ${state}. ${o.nextSession ? `Sesión ${fmtRange(o.nextSession.startsAt, o.nextSession.endsAt, zone)}` : ''}`}
      style={({ pressed }) => [
        { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: overdue ? colors.sun : colors.line, minHeight: 56 },
        pressed && { backgroundColor: colors.turq50 },
      ]}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: done ? colors.ok : colors.line, backgroundColor: done ? colors.ok : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        {done ? <Icon name="check" size={18} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold" style={done ? { textDecorationLine: 'line-through', color: colors.ink3 } : undefined}>
          {o.title}
        </T>
        {showActivity ? <T v="small" color={colors.ink2}>{o.activity.title}</T> : null}
        <T v="small" color={overdue ? colors.sunInk : colors.ink2}>
          {state}
          {!done && o.nextSession ? ` · ${fmtRange(o.nextSession.startsAt, o.nextSession.endsAt, zone)}` : ''}
          {!done && !o.nextSession && o.dueAt ? ` · límite ${fmtDayTime(o.dueAt, zone)}` : ''}
          {!done ? ` · ${fmtDur(o.remainingMinutes)}` : ''}
        </T>
      </View>
    </Pressable>
  );
}
