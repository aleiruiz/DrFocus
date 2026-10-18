import { colors, radius, space } from '@drfocus/design-tokens';
import { View } from 'react-native';
import { cap, fmtDay, fmtDayTime, fmtDur } from '@/lib/format';
import { Icon } from '../Icon';
import { Card, Row, Section, T } from '../ui';
import type { CompareRow, comparePlan } from './replan-model';

const TAG: Record<CompareRow['kind'], { label: string; bg: string; fg: string }> = {
  moved: { label: 'Cambia', bg: colors.sun100, fg: colors.sunInk },
  added: { label: 'Nuevo', bg: colors.turq100, fg: colors.petrol900 },
  same: { label: 'Igual', bg: colors.bg, fg: colors.ink2 },
  done: { label: 'Hecho', bg: colors.okBg, fg: colors.ok },
};

function Tag({ kind }: { kind: CompareRow['kind'] }) {
  const t = TAG[kind];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 }}>
      <T v="small" color={t.fg}>{t.label}</T>
    </View>
  );
}

const when = (iso: string | null, zone: string) => (iso ? cap(fmtDayTime(iso, zone)) : 'Sin sesión');

/** Comparación antes/después de cada objetivo pendiente; los terminados se listan aparte y no cambian. */
export function PlanComparison({ cmp, zone, now }: { cmp: ReturnType<typeof comparePlan>; zone: string; now: number }) {
  const same = cmp.pending.filter((r) => r.kind === 'same').length;
  return (
    <View style={{ gap: space.lg }}>
      <Section title={`${cmp.pending.length - same} cambian · ${same} se quedan igual`}>
        {cmp.pending.map((r) => {
          const late = r.before?.dueAt && Date.parse(r.before.dueAt) < now;
          return (
            <Card key={r.key} style={r.kind === 'same' ? { padding: space.md } : { padding: space.md, borderColor: colors.sun, borderWidth: 1.5 }}>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <T v="bodyBold" style={{ flex: 1 }}>{r.title}</T>
                <Tag kind={r.kind} />
              </Row>
              {r.kind === 'same' ? (
                <T v="small" color={colors.ink2}>{when(r.after.sessionStart, zone)} · {fmtDur(r.minutes)}</T>
              ) : (
                <Row style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
                  {r.before ? (
                    <View style={{ flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.sm }} accessible accessibilityLabel={`Actual: ${when(r.before.sessionStart, zone)}${late ? ', vencido' : ''}`}>
                      <T v="eyebrow" color={colors.ink3}>Actual</T>
                      <T v="small">{when(r.before.sessionStart, zone)}</T>
                      {late ? <T v="small" color={colors.bad}>Vencido</T> : null}
                    </View>
                  ) : null}
                  {r.before ? (
                    <View style={{ justifyContent: 'center' }}>
                      <Icon name="chevron" size={18} color={colors.ink3} />
                    </View>
                  ) : null}
                  <View style={{ flex: 1, backgroundColor: colors.turq50, borderRadius: radius.md, padding: space.sm }} accessible accessibilityLabel={`Propuesto: ${when(r.after.sessionStart, zone)}`}>
                    <T v="eyebrow" color={colors.petrol}>Propuesto</T>
                    <T v="bodyBold">{when(r.after.sessionStart, zone)}</T>
                    <T v="small" color={colors.ink2}>
                      {fmtDur(r.minutes)}
                      {r.after.dueAt ? ` · límite ${fmtDay(r.after.dueAt, zone)}` : ''}
                    </T>
                  </View>
                </Row>
              )}
            </Card>
          );
        })}
      </Section>

      {cmp.removed.length ? (
        <Section title="Se reemplazan">
          {cmp.removed.map((r) => (
            <T key={r.key} v="small" color={colors.ink2} style={{ textDecorationLine: 'line-through' }}>{r.title}</T>
          ))}
        </Section>
      ) : null}

      {cmp.done.length ? (
        <Section title="Se conservan · ya hechos">
          {cmp.done.map((r) => (
            <Row key={r.key}>
              <Tag kind="done" />
              <T v="small" color={colors.ink3} style={{ flex: 1 }}>{r.title}</T>
            </Row>
          ))}
        </Section>
      ) : null}
    </View>
  );
}
