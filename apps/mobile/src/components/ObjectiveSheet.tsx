import { colors, space } from '@drfocus/design-tokens';
import { mascotMessage, splitInHalves, splitObjective } from '@drfocus/domain';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import * as repo from '@/db/repo';
import { AgentFailure, callAgent, isMockAgent } from '@/features/agent';
import { proposeReplan } from '@/features/planning';
import { rescheduleReminders } from '@/features/reminders';
import { fmtDayTime, fmtDur, fmtRange } from '@/lib/format';
import type { ObjectiveView } from '@/lib/useWorkspace';
import { Sheet } from './Sheet';
import { Banner, Button, Field, Row, Stepper, T } from './ui';

type Mode = 'menu' | 'progress' | 'edit';

/** Hoja del objetivo (S09): completar, registrar avance, editar y dividir más. */
export function ObjectiveSheet({ o, zone, onClose, onCelebrate }: { o: ObjectiveView | null; zone: string; onClose: () => void; onCelebrate: (msg: string) => void }) {
  const [mode, setMode] = useState<Mode>('menu');
  const [left, setLeft] = useState(0);
  const [title, setTitle] = useState('');
  const [expected, setExpected] = useState('');
  const [minutes, setMinutes] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode('menu');
    setError(null);
    if (o) {
      setLeft(o.remainingMinutes);
      setTitle(o.title);
      setExpected(o.expectedResult);
      setMinutes(o.estimatedMinutes);
    }
  }, [o?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!o) return null;
  const pending = o.status === 'todo' || o.status === 'in_progress';
  const role = o.activity.role;

  const after = (celebrate?: 'objective_done' | 'activity_done') => {
    rescheduleReminders().catch(() => undefined);
    onClose();
    if (celebrate) onCelebrate(mascotMessage(celebrate, role).text);
  };

  const complete = () => {
    const r = repo.completeObjective(o.id);
    after(r.activityDone ? 'activity_done' : 'objective_done');
  };

  const saveProgress = () => {
    const r = repo.logObjectiveProgress(o.id, left, left === 0 ? 'completed' : 'in_progress');
    after(left === 0 ? (r.activityDone ? 'activity_done' : 'objective_done') : undefined);
  };

  const saveEdit = () => {
    if (title.trim().length < 3 || expected.trim().length < 3) return setError('Escribe la acción y cómo sabrás que terminaste.');
    repo.editObjective(o.id, { title: title.trim(), expectedResult: expected.trim(), estimatedMinutes: minutes });
    after();
  };

  const remove = () =>
    Alert.alert('¿Eliminar este objetivo?', 'Los pasos que dependían de él quedarán libres. Esto no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { repo.deleteObjective(o.id); after(); } },
    ]);

  /** «Dividir más»: el agente propone partes; sin conexión se ofrece dividir en dos mitades. */
  const split = async (useAgent: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const drafts = repo.currentPlanDrafts(o.activityId);
      let children = splitInHalves(drafts.find((d) => d.key === o.id)!);
      let assumptions: string[] = [];
      if (useAgent) {
        const res = await callAgent({
          mode: 'split',
          role,
          activity: { title: o.activity.title, description: '', expectedResult: o.activity.expectedResult, requirements: [], deadlineAt: o.activity.deadlineAt, timezone: zone, progressSummary: '' },
          preferredBlockMinutes: repo.getPrefs()?.preferredBlockMinutes ?? 20,
          answers: [],
          targetObjective: { title: o.title, expectedResult: o.expectedResult, remainingMinutes: o.remainingMinutes },
        });
        if (res.kind !== 'proposal') throw new AgentFailure({ code: 'provider_error', message: 'El agente pidió más datos; divide a mano o inténtalo de nuevo.', requestId: res.requestId, retryable: true });
        children = res.objectives;
        assumptions = res.assumptions;
      }
      const { objectives, minutesDelta } = splitObjective(drafts, o.id, children);
      repo.logEvent('objective_split', o.id, { activityId: o.activityId, parts: children.length, minutesDelta, agent: useAgent });
      proposeReplan(o.activityId, objectives, 'split', minutesDelta ? [...assumptions, `Las partes suman ${minutesDelta > 0 ? `${minutesDelta} min más` : `${-minutesDelta} min menos`} que el objetivo original.`] : assumptions);
      onClose();
      router.push({ pathname: '/plan/[id]/replan', params: { id: o.activityId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo dividir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!o} onClose={onClose} title={o.title}>
      <T color={colors.ink2}>Listo cuando: {o.expectedResult}</T>
      <T v="small" color={colors.ink2}>
        {fmtDur(o.remainingMinutes)} por hacer de {fmtDur(o.estimatedMinutes)}
        {o.nextSession ? ` · sesión ${fmtRange(o.nextSession.startsAt, o.nextSession.endsAt, zone)}` : ''}
        {o.dueAt ? ` · límite del paso ${fmtDayTime(o.dueAt, zone)}` : ''}
      </T>
      {o.blocked && pending ? <Banner kind="info">Este paso espera a que termines otro antes. Puedes avanzarlo de todos modos.</Banner> : null}
      {error ? <Banner kind="error">{error}</Banner> : null}

      {mode === 'menu' && pending && (
        <View style={{ gap: space.sm }}>
          <Button label="Completar" kind="sun" onPress={complete} />
          <Button label="Registrar avance" kind="soft" onPress={() => setMode('progress')} />
          <Button label="Editar" kind="ghost" onPress={() => setMode('edit')} />
          <Button label={isMockAgent() ? 'Dividir más (agente de demostración)' : 'Dividir más con el agente'} kind="ghost" loading={busy} onPress={() => split(true)} />
          <Button label="Dividir en dos sin agente" kind="text" disabled={busy || o.remainingMinutes < 10} onPress={() => split(false)} />
          <Button label="Eliminar objetivo" kind="text" onPress={remove} />
        </View>
      )}
      {mode === 'menu' && !pending && (
        <View style={{ gap: space.sm }}>
          <Banner kind="ok">{o.status === 'completed' ? 'Terminaste este paso.' : 'Este paso se omitió.'}</Banner>
          <Button label="Marcar como pendiente otra vez" kind="ghost" onPress={() => { repo.reopenObjective(o.id); after(); }} />
        </View>
      )}
      {mode === 'progress' && (
        <View style={{ gap: space.md }}>
          <T>¿Cuánto tiempo crees que te falta?</T>
          <Stepper value={left} onChange={setLeft} min={0} max={120} step={5} suffix="min" label="minutos restantes" />
          <T v="small" color={colors.ink2}>Registrar avance no marca el paso como terminado, salvo que te falten 0 minutos.</T>
          <Row>
            <Button label="Guardar avance" onPress={saveProgress} style={{ flex: 1 }} />
            <Button label="Cancelar" kind="text" onPress={() => setMode('menu')} />
          </Row>
        </View>
      )}
      {mode === 'edit' && (
        <View style={{ gap: space.md }}>
          <Field label="Qué vas a hacer" value={title} onChangeText={setTitle} maxLength={120} />
          <Field label="Listo cuando…" value={expected} onChangeText={setExpected} maxLength={300} />
          <T v="bodyBold">Duración estimada</T>
          <Stepper value={minutes} onChange={setMinutes} min={5} max={120} step={5} suffix="min" label="duración" />
          <T v="small" color={colors.ink2}>Para mover sesiones después de editar, usa «Reorganizar» en la actividad.</T>
          <Row>
            <Button label="Guardar" onPress={saveEdit} style={{ flex: 1 }} />
            <Button label="Cancelar" kind="text" onPress={() => setMode('menu')} />
          </Row>
        </View>
      )}
    </Sheet>
  );
}
