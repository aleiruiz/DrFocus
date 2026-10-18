import { colors, space } from '@drfocus/design-tokens';
import { weeklyMinutes } from '@drfocus/planner';
import { Pressable, View } from 'react-native';
import { fmtDur, WEEKDAYS } from '@/lib/format';
import { TimeField } from './DateTimeFields';
import { T } from './ui';

export interface DayRule {
  weekday: number;
  startLocal: string;
  endLocal: string;
}

export const DEFAULT_RULES: Record<'student' | 'teacher', DayRule[]> = {
  student: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startLocal: '16:00', endLocal: '18:00' })).concat([{ weekday: 6, startLocal: '10:00', endLocal: '12:00' }]),
  teacher: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startLocal: '17:00', endLocal: '19:00' })).concat([{ weekday: 7, startLocal: '17:00', endLocal: '19:00' }]),
};

/** Un bloque de disponibilidad por día; si la hora final es menor, cruza la medianoche. */
export function AvailabilityEditor({ rules, onChange }: { rules: DayRule[]; onChange: (r: DayRule[]) => void }) {
  const set = (weekday: number, patch: Partial<DayRule> | null) => {
    const others = rules.filter((r) => r.weekday !== weekday);
    if (patch === null) return onChange(others);
    const cur = rules.find((r) => r.weekday === weekday) ?? { weekday, startLocal: '16:00', endLocal: '18:00' };
    onChange([...others, { ...cur, ...patch }].sort((a, b) => a.weekday - b.weekday));
  };
  return (
    <View style={{ gap: space.md }}>
      {WEEKDAYS.map((d) => {
        const r = rules.find((x) => x.weekday === d.weekday);
        return (
          <View key={d.weekday} style={{ gap: space.sm, paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: !!r }}
              accessibilityLabel={`${d.name}: ${r ? 'con tiempo disponible' : 'sin tiempo'}`}
              onPress={() => set(d.weekday, r ? null : {})}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <T v="bodyBold">{d.name.charAt(0).toUpperCase() + d.name.slice(1)}</T>
              <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: r ? colors.turq100 : colors.card, borderWidth: 1, borderColor: r ? colors.turq : colors.line }}>
                <T v="small" color={r ? colors.petrol900 : colors.ink3}>{r ? 'Disponible' : 'Sin tiempo'}</T>
              </View>
            </Pressable>
            {r && (
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <TimeField label="Desde" value={r.startLocal} onChange={(v) => set(d.weekday, { startLocal: v })} />
                <TimeField label="Hasta" value={r.endLocal} onChange={(v) => set(d.weekday, { endLocal: v })} />
              </View>
            )}
          </View>
        );
      })}
      <T v="small" color={colors.ink2}>
        Total: {fmtDur(weeklyMinutes(rules))} por semana. Doctor Focus solo conoce el tiempo que registras aquí; no sabe de compromisos que no anotes.
      </T>
    </View>
  );
}
