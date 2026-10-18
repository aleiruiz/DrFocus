import { colors, space } from '@drfocus/design-tokens';
import { View } from 'react-native';
import { fmtRange } from '@/lib/format';
import type { ObjectiveView } from '@/lib/useWorkspace';
import { ObjectiveRow } from '../ObjectiveRow';
import { Section, T } from '../ui';

/** Secuencia de objetivos con sus dependencias y sesiones planeadas. */
export function ObjectiveSequence({ objectives, zone, now, onOpen }: { objectives: ObjectiveView[]; zone: string; now: number; onOpen: (id: string) => void }) {
  const titleOf = (id: string) => objectives.find((o) => o.id === id)?.title;
  return (
    <Section title="Secuencia de objetivos" right={<T v="small" color={colors.ink3}>Toca para ver o editar</T>}>
      {objectives.map((o) => {
        const deps = o.dependsOn.map(titleOf).filter((t): t is string => !!t);
        const later = o.status === 'completed' || o.status === 'skipped' ? [] : o.sessions.filter((x) => x.id !== o.nextSession?.id && Date.parse(x.endsAt) > now);
        return (
          <View key={o.id} style={{ gap: 4 }}>
            {deps.length ? (
              <T v="small" color={colors.ink3} style={{ paddingLeft: space.md }}>
                Después de {deps.map((t) => `«${t}»`).join(' y ')}
              </T>
            ) : null}
            <ObjectiveRow o={o} zone={zone} now={now} onPress={() => onOpen(o.id)} />
            {later.length ? (
              <T v="small" color={colors.ink3} style={{ paddingLeft: space.md }}>
                {later.length === 1 ? 'Otra sesión' : `${later.length} sesiones más`}: {later.slice(0, 2).map((x) => fmtRange(x.startsAt, x.endsAt, zone)).join(' · ')}
                {later.length > 2 ? '…' : ''}
              </T>
            ) : null}
          </View>
        );
      })}
    </Section>
  );
}
