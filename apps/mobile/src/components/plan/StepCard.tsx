import type { ObjectiveDraft } from '@drfocus/contracts';
import { colors, radius, space } from '@drfocus/design-tokens';
import type { PlannedSession } from '@drfocus/planner';
import { Pressable, View } from 'react-native';
import { fmtDayTime, fmtDur, fmtRange } from '@/lib/format';
import { Icon } from '../Icon';
import { Card, Row, T } from '../ui';

/** Un paso de la vista previa con su sesión, fecha límite sugerida y acciones. */
export function StepCard({
  n,
  o,
  sessions,
  dueAt,
  after,
  unscheduled,
  zone,
  first,
  last,
  onEdit,
  onMove,
  onRemove,
}: {
  n: number;
  o: ObjectiveDraft;
  sessions: PlannedSession[];
  dueAt: string | null;
  after: string | null;
  unscheduled: boolean;
  zone: string;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <Card style={unscheduled ? { borderColor: colors.sun, borderWidth: 2 } : undefined}>
      <Row style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <View style={{ minWidth: 28, height: 28, borderRadius: 14, backgroundColor: colors.turq100, alignItems: 'center', justifyContent: 'center' }}>
          <T v="bodyBold" color={colors.petrol900}>{n}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyBold">{o.title}</T>
          <T v="small" color={colors.ink2}>Listo cuando: {o.expectedResult}</T>
          <T v="small" color={colors.ink2}>
            {fmtDur(o.estimatedMinutes)} estimados{o.source === 'agent' ? ' por el agente' : ''}
            {after ? ` · después de «${after.length > 30 ? `${after.slice(0, 30)}…` : after}»` : ''}
          </T>
          {sessions.length ? (
            sessions.map((s) => (
              <Row key={s.startsAt} gap={space.xs}>
                <Icon name="clock" size={16} color={colors.petrol} />
                <T v="small">{fmtRange(s.startsAt, s.endsAt, zone)}</T>
              </Row>
            ))
          ) : (
            <T v="small" color={colors.sunInk}>{unscheduled ? 'No cupo antes de la fecha límite' : 'Sin sesión'}</T>
          )}
          {dueAt ? <T v="small" color={colors.ink2}>Límite sugerido del paso: {fmtDayTime(dueAt, zone)}</T> : null}
        </View>
      </Row>
      <Row gap={space.xs} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.xs }}>
        <Action label="Editar" icon="pencil" onPress={onEdit} a11y={`Editar ${o.title}`} />
        <View style={{ flex: 1 }} />
        <Action label="↑" onPress={() => onMove(-1)} disabled={first} a11y={`Subir ${o.title}`} />
        <Action label="↓" onPress={() => onMove(1)} disabled={last} a11y={`Bajar ${o.title}`} />
        <Action label="Quitar" icon="close" onPress={onRemove} a11y={`Quitar ${o.title}`} />
      </Row>
    </Card>
  );
}

function Action({ label, icon, onPress, disabled, a11y }: { label: string; icon?: 'pencil' | 'close'; onPress: () => void; disabled?: boolean; a11y: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: 48, minWidth: 48, paddingHorizontal: space.sm, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: disabled ? 0.35 : 1 }, pressed && { backgroundColor: colors.turq50 }]}
    >
      {icon ? <Icon name={icon} size={18} color={colors.petrol} /> : null}
      <T v="bodyBold" color={colors.petrol}>{label}</T>
    </Pressable>
  );
}
