import { colors, space } from '@drfocus/design-tokens';
import { mascotMessage, organizeToday, progress } from '@drfocus/domain';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Celebration } from '@/components/Celebration';
import { Icon } from '@/components/Icon';
import { MascotBubble } from '@/components/MascotBubble';
import { ObjectiveRow } from '@/components/ObjectiveRow';
import { ObjectiveSheet } from '@/components/ObjectiveSheet';
import { Banner, Button, Card, ProgressBar, Screen, Section, T } from '@/components/ui';
import { cap, endOfLocalDay, fmtLong, fmtRange } from '@/lib/format';
import { useNow, usePrefs } from '@/lib/hooks';
import { useWorkspace, type ObjectiveView } from '@/lib/useWorkspace';

/** S03 · Hoy: siguiente objetivo, agenda, atrasos y progreso. */
export default function Today() {
  const prefs = usePrefs();
  const now = useNow();
  const { activities, objectives } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const zone = prefs?.timezone ?? 'America/Mexico_City';
  const role = prefs?.role ?? 'student';

  const active = useMemo(() => objectives.filter((o) => o.activity.status === 'active'), [objectives]);
  const view = useMemo(
    () =>
      organizeToday(
        active.map((o) => ({ ...o, nextSessionAt: o.nextSession?.startsAt ?? null })),
        now,
        endOfLocalDay(now, zone),
      ),
    [active, now, zone],
  );
  const doneToday = active.filter((o) => o.completedAt && Date.parse(o.completedAt) >= endOfLocalDay(now, zone) - 86_400_000);
  const activeActivities = activities.filter((a) => a.status === 'active');
  const drafts = activities.filter((a) => a.status === 'draft');
  const selectedObj = objectives.find((o) => o.id === selected) ?? null;
  const onCelebrate = useCallback((m: string) => setCelebration(m), []);

  const ctx = !activeActivities.length ? 'today_empty' : view.overdue.length ? 'today_overdue' : view.next ? 'today_next' : 'today_all_done';
  const msg = mascotMessage(ctx, role);
  const overdueActivities = [...new Set(view.overdue.map((o) => o.activityId))];

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <T v="eyebrow" color={colors.ink3}>{cap(fmtLong(new Date(now).toISOString(), zone))}</T>
        <MascotBubble pose={msg.pose} text={msg.text} />

        {view.next ? (
          <Card style={{ borderColor: colors.petrol, borderWidth: 2 }}>
            <T v="eyebrow" color={colors.petrol}>Siguiente paso</T>
            <T v="h2">{view.next.title}</T>
            <T color={colors.ink2}>{view.next.activity.title}</T>
            {view.next.nextSession ? <T v="small" color={colors.ink2}>Sesión: {fmtRange(view.next.nextSession.startsAt, view.next.nextSession.endsAt, zone)}</T> : null}
            <Button label="Abrir paso" kind="sun" onPress={() => setSelected(view.next!.id)} />
          </Card>
        ) : null}

        {view.overdue.length ? (
          <Section title={`Atrasados (${view.overdue.length})`}>
            <Banner kind="warn">Se pasó la fecha de algunos pasos. Puedes terminarlos o reorganizar el plan; la fecha final no cambia sola.</Banner>
            {view.overdue.slice(0, 5).map((o) => (
              <ObjectiveRow key={o.id} o={o as ObjectiveView} zone={zone} now={now} showActivity onPress={() => setSelected(o.id)} />
            ))}
            {overdueActivities.map((id) => (
              <Button key={id} kind="ghost" label={`Reorganizar ${activities.find((a) => a.id === id)?.title ?? ''}`} onPress={() => router.push({ pathname: '/plan/[id]/replan', params: { id } })} />
            ))}
          </Section>
        ) : null}

        {view.today.length ? (
          <Section title="También hoy">
            {view.today.map((o) => (
              <ObjectiveRow key={o.id} o={o as ObjectiveView} zone={zone} now={now} showActivity onPress={() => setSelected(o.id)} />
            ))}
          </Section>
        ) : null}

        {doneToday.length ? <T v="small" color={colors.ok}>Terminaste {doneToday.length} {doneToday.length === 1 ? 'paso' : 'pasos'} hoy.</T> : null}

        {activeActivities.length ? (
          <Section title="Tus actividades">
            {activeActivities.map((a) => {
              const p = progress(objectives.filter((o) => o.activityId === a.id));
              return (
                <Card key={a.id} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: a.id } })} accessibilityLabel={`${a.title}. ${p.done} de ${p.total} objetivos`}>
                  <T v="bodyBold">{a.title}</T>
                  <ProgressBar done={p.done} total={p.total} />
                </Card>
              );
            })}
          </Section>
        ) : null}

        {drafts.length ? (
          <Section title="Borradores">
            {drafts.map((a) => (
              <Card key={a.id} onPress={() => router.push({ pathname: '/plan/[id]/preview', params: { id: a.id } })} accessibilityLabel={`Borrador: ${a.title}`}>
                <T v="bodyBold">{a.title}</T>
                <T v="small" color={colors.ink2}>Plan sin aceptar · toca para revisar</T>
              </Card>
            ))}
          </Section>
        ) : null}

        <Button label="Nueva actividad" icon={<Icon name="plus" color={colors.white} />} onPress={() => router.push('/activity/new')} />
        <View style={{ height: space.lg }} />
      </Screen>
      <ObjectiveSheet o={selectedObj} zone={zone} onClose={() => setSelected(null)} onCelebrate={onCelebrate} />
      <Celebration message={celebration} onDone={() => setCelebration(null)} />
    </View>
  );
}
