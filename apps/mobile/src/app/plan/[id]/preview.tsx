import { LIMITS, type ObjectiveDraft } from '@drfocus/contracts';
import { colors, space } from '@drfocus/design-tokens';
import type { PlannerOutput } from '@drfocus/planner';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { ConflictPanel } from '@/components/plan/ConflictPanel';
import { moveDraft, newDraft, reduceScope, removeDraft, updateDraft } from '@/components/plan/editing';
import { StepCard } from '@/components/plan/StepCard';
import { StepEditor, type StepFields } from '@/components/plan/StepEditor';
import { Banner, Button, Card, Screen, Section, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { setDraftDeadline } from '@/db/repo-plan';
import { isMockAgent } from '@/features/agent';
import { schedulePlan } from '@/features/planning';
import { permissionStatus, requestPermission, rescheduleReminders } from '@/features/reminders';
import { fmtDayTime, fmtDur } from '@/lib/format';

type Editing = { key: string | null } | null;

/** S07 · Vista previa: editar, agregar, quitar y reordenar pasos; resolver conflictos; aceptar. */
export default function PlanPreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prefs] = useState(() => repo.getPrefs());
  const [initial] = useState(() => readDraft(id));
  const [activity, setActivity] = useState(() => repo.getActivity(id));
  const [objectives, setObjectives] = useState<ObjectiveDraft[]>(initial?.objectives ?? []);
  const [assumptions] = useState<string[]>(initial?.assumptions ?? []);
  const [schedule, setSchedule] = useState<PlannerOutput | null>(initial?.schedule ?? null);
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(objectives);

  /** Recalcula el calendario y guarda el borrador, para no perder cambios al salir. */
  const apply = useCallback(
    (list: ObjectiveDraft[]) => {
      latest.current = list;
      setObjectives(list);
      setError(null);
      setNotice(null);
      const a = repo.getActivity(id);
      setActivity(a);
      if (!a || a.status !== 'draft') return null;
      try {
        const s = schedulePlan(id, list);
        repo.saveRevisionDraft(id, 'initial', { objectives: list, schedule: s, assumptions });
        setSchedule(s);
        return s;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo calcular el plan.');
        return null;
      }
    },
    [id, assumptions],
  );

  // Al volver (por ejemplo, de cambiar la disponibilidad) se recalcula con la hora actual.
  useFocusEffect(
    useCallback(() => {
      apply(latest.current);
    }, [apply]),
  );

  if (!activity || !prefs) return <Screen><Banner kind="error">Esta actividad ya no existe.</Banner></Screen>;
  if (activity.status !== 'draft')
    return (
      <Screen>
        <Banner kind="ok" title="Este plan ya está aceptado">Puedes verlo y cambiarlo desde la actividad.</Banner>
        <Button label="Ver la actividad" onPress={() => router.replace({ pathname: '/activity/[id]', params: { id } })} />
      </Screen>
    );

  const zone = prefs.timezone;
  const byKey = new Map(objectives.map((o) => [o.key, o]));
  const unscheduled = new Set(schedule?.conflicts.flatMap((c) => (c.kind === 'insufficient_time' ? c.objectiveKeys : [])) ?? []);
  const total = objectives.reduce((n, o) => n + o.remainingMinutes, 0);
  const feasible = !!schedule?.feasible && objectives.length > 0;
  const fromAgent = objectives.some((o) => o.source === 'agent');
  const editStep = editing?.key ? (byKey.get(editing.key) ?? null) : null;

  const save = (f: StepFields) => {
    apply(editing?.key ? updateDraft(objectives, editing.key, f) : [...objectives, newDraft(objectives[objectives.length - 1], f)]);
    setEditing(null);
  };

  const move = (key: string, dir: -1 | 1) => {
    const next = moveDraft(objectives, key, dir);
    if (next) apply(next);
    else setNotice('Ese cambio de orden dejaría pasos esperando a otros que van después. Prueba otro orden.');
  };

  const remove = (o: ObjectiveDraft) =>
    Alert.alert(`¿Quitar «${o.title}»?`, 'Los pasos que esperaban a este quedarán libres.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Quitar', style: 'destructive', onPress: () => apply(removeDraft(latest.current, o.key)) },
    ]);

  const changeDeadline = (iso: string) => {
    setDraftDeadline(id, iso);
    const s = apply(objectives);
    setNotice(s?.feasible ? `Cambiaste la fecha límite a ${fmtDayTime(iso, zone)}. Ahora sí cabe; revisa el plan.` : `Cambiaste la fecha límite a ${fmtDayTime(iso, zone)}, pero todavía no cabe todo.`);
  };

  const shorten = () => {
    const s = apply(reduceScope(objectives));
    setNotice(s?.feasible ? 'Acorté los pasos pendientes. Revisa que sigan cumpliendo lo que te piden.' : 'Acorté los pasos, pero todavía no cabe. Puedes combinar opciones o quitar pasos.');
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const s = apply(objectives);
      if (!s?.feasible) return;
      const draft = repo.latestDraft(id);
      if (!draft) throw new repo.StaleRevisionError();
      const { firstPlan } = repo.acceptRevision(draft.id, zone);
      if (firstPlan && prefs.remindersEnabled && (await permissionStatus()) === 'undetermined' && (await askForReminders())) await requestPermission();
      await rescheduleReminders().catch(() => undefined);
      router.replace({ pathname: '/activity/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar el plan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          {!feasible ? <T v="small" color={colors.ink2} style={{ textAlign: 'center' }}>{objectives.length ? 'Resuelve lo que no cabe para poder aceptar.' : 'Agrega al menos un paso para aceptar.'}</T> : null}
          <Button label="Aceptar plan" kind="sun" disabled={!feasible} loading={busy} onPress={accept} />
          <Button label="Guardar borrador y salir" kind="text" onPress={() => router.replace('/today')} />
        </>
      }
    >
      <View style={{ gap: space.xs }}>
        {fromAgent ? <T v="eyebrow" color={colors.ink3}>{isMockAgent() ? 'Propuesta del agente de demostración' : 'Propuesta del agente'}</T> : null}
        <T v="h2">{activity.title}</T>
      </View>
      <Card style={{ backgroundColor: colors.turq50 }}>
        <T><T v="bodyBold">Fecha límite:</T> {fmtDayTime(activity.deadlineAt, zone)}</T>
        <T v="small" color={colors.ink2}>{objectives.length} pasos · {fmtDur(total)} de trabajo</T>
        <T v="small" color={colors.ink2}>Las duraciones son estimaciones, no certezas. Edítalas si te conoces mejor.</T>
      </Card>
      {assumptions.length ? (
        <Banner kind="info" title="Lo que el agente supuso">
          <T v="small" color={colors.petrol900}>{assumptions.map((a) => `• ${a}`).join('\n')}</T>
        </Banner>
      ) : null}
      {notice ? <Banner kind="ok">{notice}</Banner> : null}
      {error ? <Banner kind="error">{error}</Banner> : null}

      {schedule && !schedule.feasible && objectives.length ? (
        <ConflictPanel
          key={activity.deadlineAt}
          schedule={schedule}
          deadlineAt={activity.deadlineAt}
          zone={zone}
          role={activity.role}
          onAvailability={() => router.push({ pathname: '/onboarding/availability', params: { from: 'settings' } })}
          onScope={shorten}
          onDeadline={changeDeadline}
        />
      ) : null}

      <Section title="Pasos">
        {objectives.length === 0 ? <Card><T v="small">Todavía no hay pasos. Agrega el primero; tú decides cuánto dura.</T></Card> : null}
        {objectives.map((o, i) => (
          <StepCard
            key={o.key}
            n={i + 1}
            o={o}
            sessions={schedule?.sessions.filter((s) => s.objectiveKey === o.key) ?? []}
            dueAt={schedule?.objectiveDueAt[o.key] ?? null}
            after={o.dependsOn.length ? (byKey.get(o.dependsOn[0]!)?.title ?? null) : null}
            unscheduled={unscheduled.has(o.key)}
            zone={zone}
            first={i === 0}
            last={i === objectives.length - 1}
            onEdit={() => setEditing({ key: o.key })}
            onMove={(dir) => move(o.key, dir)}
            onRemove={() => remove(o)}
          />
        ))}
        <Button label="Agregar paso" kind="soft" disabled={objectives.length >= LIMITS.objectivesMax} onPress={() => setEditing({ key: null })} />
      </Section>

      <StepEditor open={!!editing} step={editStep} onSave={save} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function readDraft(activityId: string): repo.ProposedPlan | null {
  const d = repo.latestDraft(activityId);
  return d && d.kind === 'initial' ? (JSON.parse(d.proposedJson) as repo.ProposedPlan) : null;
}

/** Explica los avisos antes de que Android muestre su diálogo (solo en el primer plan). */
function askForReminders(): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      '¿Te aviso de tus pasos?',
      'Doctor Focus te recuerda antes de cada sesión y si un paso se vence. Puedes cambiarlo en Ajustes.',
      [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Activar avisos', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
