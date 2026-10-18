import { colors, space } from '@drfocus/design-tokens';
import { isOverdue, isPending } from '@drfocus/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { ActivitySummary } from '@/components/activity/ActivitySummary';
import { ObjectiveSequence } from '@/components/activity/ObjectiveSequence';
import { Celebration } from '@/components/Celebration';
import { ObjectiveSheet } from '@/components/ObjectiveSheet';
import { Banner, Button, Card, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { rescheduleReminders } from '@/features/reminders';
import { useNow, usePrefs } from '@/lib/hooks';
import { useWorkspace } from '@/lib/useWorkspace';

function goToday() {
  if (router.canDismiss()) router.dismissAll();
  router.navigate('/today');
}

/** S09 · Detalle de actividad: progreso, objetivos con dependencias y sesiones, reorganizar y borrar. */
export default function ActivityDetail() {
  const { id, objective, updated } = useLocalSearchParams<{ id: string; objective?: string; updated?: string }>();
  const prefs = usePrefs();
  const now = useNow();
  const zone = prefs?.timezone ?? 'America/Mexico_City';
  const { activities, objectives: all } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const onCelebrate = useCallback((m: string) => setCelebration(m), []);

  // La consulta reactiva llega vacía en el primer render; la lectura directa evita mostrar «no existe» de más.
  const stored = useMemo(() => repo.getActivity(id), [id, activities]); // eslint-disable-line react-hooks/exhaustive-deps
  const activity = activities.find((a) => a.id === id) ?? (stored && !stored.deletedAt ? stored : undefined);
  const objectives = useMemo(() => all.filter((o) => o.activityId === id), [all, id]);

  useEffect(() => {
    if (activity?.status === 'draft') router.replace({ pathname: '/plan/[id]/preview', params: { id } });
  }, [activity?.status, id]);

  // Desde un aviso llega ?objective=: se abre su hoja, o se avisa si ese paso ya no existe.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || !objective || !activity) return;
    handled.current = true;
    const o = repo.getObjective(objective);
    if (o && o.activityId === id) setSelected(objective);
    else
      Alert.alert('Ese paso ya no existe', 'Puede que lo hayas terminado, dividido o eliminado.', [
        { text: 'Ver la actividad', style: 'cancel' },
        { text: 'Ir a Hoy', onPress: goToday },
      ]);
  }, [objective, activity, id]);

  if (!activity)
    return (
      <Screen>
        <T v="h2">Esta actividad ya no existe</T>
        <T color={colors.ink2}>Puede que la hayas borrado. Tus demás actividades siguen en Hoy.</T>
        <Button label="Ir a Hoy" onPress={goToday} />
      </Screen>
    );

  const pending = objectives.filter(isPending);
  const late = pending.filter((o) => isOverdue(o, now));
  const next = pending
    .filter((o) => !o.blocked && !isOverdue(o, now))
    .sort((a, b) => (a.nextSession?.startsAt ?? '~').localeCompare(b.nextSession?.startsAt ?? '~'))[0];
  const selectedObj = objectives.find((o) => o.id === selected) ?? null;
  const replan = () => router.push({ pathname: '/plan/[id]/replan', params: { id } });

  const remove = () =>
    Alert.alert(
      `¿Borrar «${activity.title}»?`,
      `Se borran sus ${objectives.length} ${objectives.length === 1 ? 'objetivo' : 'objetivos'} y se cancelan sus recordatorios. Esto no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => {
            repo.deleteActivity(id);
            rescheduleReminders().catch(() => undefined);
            if (router.canGoBack()) router.back();
            else goToday();
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {updated === '1' ? <Banner kind="ok">Plan actualizado. Los recordatorios ya siguen el nuevo horario.</Banner> : null}
        <ActivitySummary a={activity} objectives={objectives} zone={zone} />

        {activity.status === 'completed' ? <Banner kind="ok" title="Actividad terminada">Completaste todos sus objetivos.</Banner> : null}

        {late.length ? (
          <Card style={{ borderColor: colors.sun, borderWidth: 2 }}>
            <T v="bodyBold">{late.length === 1 ? 'Un paso venció' : `${late.length} pasos vencieron`}</T>
            <T v="small" color={colors.ink2}>Lo acomodamos en tu tiempo libre sin mover la fecha límite.</T>
            <Button label="Reorganizar" onPress={replan} />
          </Card>
        ) : null}

        {next ? <Button label={`Siguiente paso: ${next.title.length > 32 ? `${next.title.slice(0, 32)}…` : next.title}`} kind="sun" onPress={() => setSelected(next.id)} /> : null}

        {objectives.length ? (
          <ObjectiveSequence objectives={objectives} zone={zone} now={now} onOpen={setSelected} />
        ) : (
          <Banner kind="info">Esta actividad no tiene objetivos.</Banner>
        )}

        <View style={{ gap: space.sm }}>
          {pending.length > 0 && !late.length ? <Button label="Reorganizar" kind="soft" onPress={replan} /> : null}
          <Button label="Borrar actividad" kind="danger" onPress={remove} />
        </View>
      </Screen>
      <ObjectiveSheet o={selectedObj} zone={zone} onClose={() => setSelected(null)} onCelebrate={onCelebrate} />
      <Celebration message={celebration} onDone={() => setCelebration(null)} />
    </View>
  );
}
