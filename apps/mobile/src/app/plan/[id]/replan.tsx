import { colors, space } from '@drfocus/design-tokens';
import { mascotMessage } from '@drfocus/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { comparePlan, describeConflict } from '@/components/activity/replan-model';
import { PlanComparison } from '@/components/activity/PlanComparison';
import { MascotBubble } from '@/components/MascotBubble';
import { Banner, Button, Card, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { proposeReplan } from '@/features/planning';
import { rescheduleReminders } from '@/features/reminders';
import { cap, fmtLong, fmtTime } from '@/lib/format';
import { useNow, usePrefs } from '@/lib/hooks';

type Loaded = { revisionId: string; kind: string; plan: repo.ProposedPlan; splitDropped: boolean };

/**
 * Un borrador de «Dividir más» sirve solo si los objetivos siguen como estaban al dividir.
 * Editar, borrar o registrar avance no sube activity.revision, así que se compara el contenido.
 */
function splitStillValid(plan: repo.ProposedPlan, activityId: string) {
  const byId = new Map(repo.getObjectives(activityId).map((o) => [o.id, o]));
  return plan.objectives.every((d) => {
    if (!d.existingId) return true;
    const o = byId.get(d.existingId);
    return !!o && o.status === d.status && o.remainingMinutes === d.remainingMinutes && o.estimatedMinutes === d.estimatedMinutes && o.title === d.title && o.expectedResult === d.expectedResult;
  });
}

/**
 * Prepara la propuesta. Un borrador de «Dividir más» vigente se recalcula con sus objetivos;
 * en cualquier otro caso se parte del plan guardado, así cada visita usa la hora y la disponibilidad actuales.
 */
function prepare(id: string): Loaded | null {
  const activity = repo.getActivity(id);
  if (!activity || activity.deletedAt) return null;
  const draft = repo.latestDraft(id);
  let splitDropped = false;
  if (draft && draft.kind === 'split' && draft.baseRevision === activity.revision) {
    const p = JSON.parse(draft.proposedJson) as repo.ProposedPlan;
    if (splitStillValid(p, id)) {
      proposeReplan(id, p.objectives, 'split', p.assumptions);
    } else {
      repo.discardDraft(draft.id);
      splitDropped = true;
      proposeReplan(id, repo.currentPlanDrafts(id), 'replan');
    }
  } else {
    proposeReplan(id, repo.currentPlanDrafts(id), 'replan');
  }
  const saved = repo.latestDraft(id)!;
  return { revisionId: saved.id, kind: saved.kind, plan: JSON.parse(saved.proposedJson) as repo.ProposedPlan, splitDropped };
}

/** S10 · Reorganizar: comparación antes/después y aceptación, sin tocar lo ya terminado ni la fecha límite. */
export default function Replan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const prefs = usePrefs();
  const now = useNow();
  const zone = prefs?.timezone ?? 'America/Mexico_City';
  const role = prefs?.role ?? 'student';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    try {
      const activity = repo.getActivity(id);
      if (activity?.status === 'draft') {
        router.replace({ pathname: '/plan/[id]/preview', params: { id } });
        return;
      }
      const next = prepare(id);
      setMissing(!next);
      setLoaded(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo preparar la propuesta.');
    }
  }, [id]);

  useFocusEffect(load);

  // Al salir sin decidir, la propuesta se descarta para que «Reorganizar» empiece limpio la próxima vez.
  const revisionRef = useRef<string | null>(null);
  revisionRef.current = loaded?.revisionId ?? null;
  useEffect(
    () => () => {
      const rev = revisionRef.current;
      if (rev && repo.latestDraft(id)?.id === rev) repo.discardDraft(rev);
    },
    [id],
  );

  const activity = useMemo(() => repo.getActivity(id), [id, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const cmp = useMemo(() => (loaded ? comparePlan(loaded.plan) : null), [loaded]);

  if (missing || !activity)
    return (
      <Screen>
        <T v="h2">Esta actividad ya no existe</T>
        <Button label="Volver" onPress={() => router.back()} />
      </Screen>
    );
  if (!loaded || !cmp)
    return (
      <Screen>
        {error ? <Banner kind="error">{error}</Banner> : <T color={colors.ink2}>Preparando la propuesta…</T>}
        <Button label="Volver" kind="ghost" onPress={() => router.back()} />
      </Screen>
    );

  const { plan } = loaded;
  const feasible = plan.schedule.feasible;
  const titleOf = (key: string) => plan.objectives.find((o) => o.key === key)?.title ?? 'Un paso';
  const lateCount = cmp.pending.filter((r) => r.before?.dueAt && Date.parse(r.before.dueAt) < now).length;
  const msg = mascotMessage(feasible ? 'replan' : 'conflict', role);
  const bubble = !feasible ? msg.text : lateCount ? `${lateCount === 1 ? 'Quedó un pendiente' : `Quedaron ${lateCount} pendientes`}. Busquemos otro horario.` : msg.text;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      repo.acceptRevision(loaded.revisionId, zone);
      const remindersOk = await rescheduleReminders().then(
        () => true,
        () => false,
      );
      router.dismissTo({ pathname: '/activity/[id]', params: { id, updated: remindersOk ? '1' : 'sin-avisos' } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar el plan.');
      if (e instanceof repo.StaleRevisionError) load();
    } finally {
      setBusy(false);
    }
  };

  const keep = () => {
    repo.discardDraft(loaded.revisionId);
    router.back();
  };

  const nothingPending = cmp.pending.length === 0;

  return (
    <Screen
      footer={
        nothingPending ? (
          <Button label="Volver" onPress={keep} />
        ) : (
          <>
            <Button label="Aceptar nuevo plan" onPress={accept} loading={busy} disabled={!feasible} />
            <Button label="Mantener plan actual" kind="text" onPress={keep} />
          </>
        )
      }
    >
      <MascotBubble pose={msg.pose} text={bubble} size={88} />
      <T v="h2">{activity.title}</T>
      <Banner kind="info" title="La fecha límite no cambia">{`${cap(fmtLong(activity.deadlineAt, zone))}, ${fmtTime(activity.deadlineAt, zone)}`}</Banner>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {loaded.splitDropped ? <Banner kind="info">Cambiaste pasos después de dividir, así que la división anterior se descartó. Puedes volver a dividir desde el paso.</Banner> : null}

      {nothingPending ? (
        <Banner kind="ok" title="No hay nada que reorganizar">Todos los objetivos de esta actividad ya están terminados.</Banner>
      ) : null}

      {!feasible && !nothingPending ? (
        <Card style={{ borderColor: colors.sun, borderWidth: 2 }}>
          <T v="bodyBold">Con el tiempo que tienes no todo cabe antes de la fecha límite.</T>
          {plan.schedule.conflicts.map((c, i) => (
            <T key={i} v="small" color={colors.ink2}>• {describeConflict(c, titleOf)}</T>
          ))}
          <T v="small" color={colors.ink2}>Puedes agregar horarios libres o volver a la actividad para eliminar o acortar pasos. Al regresar, la propuesta se recalcula.</T>
          <View style={{ gap: space.sm }}>
            <Button label="Ajustar disponibilidad" kind="soft" onPress={() => router.push({ pathname: '/onboarding/availability', params: { from: 'settings' } })} />
            <Button label="Editar pasos de la actividad" kind="ghost" onPress={() => router.dismissTo({ pathname: '/activity/[id]', params: { id } })} />
          </View>
        </Card>
      ) : null}

      {cmp.totalAfter !== cmp.totalBefore ? (
        <Banner kind="info">{`El plan pasa de ${cmp.totalBefore} a ${cmp.totalAfter} objetivos, así que el progreso se calculará con el nuevo total.`}</Banner>
      ) : null}
      {plan.assumptions.length ? (
        <View style={{ gap: 4 }}>
          {plan.assumptions.map((a, i) => (
            <T key={i} v="small" color={colors.ink2}>• {a}</T>
          ))}
        </View>
      ) : null}

      {!nothingPending ? <PlanComparison cmp={cmp} zone={zone} now={now} /> : null}
    </Screen>
  );
}
