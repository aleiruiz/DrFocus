import { LIMITS, type AgentAnswer, type AgentQuestion } from '@drfocus/contracts';
import { colors, space } from '@drfocus/design-tokens';
import { mascotMessage } from '@drfocus/domain';
import { HORIZON_DAYS } from '@drfocus/planner';
import { CUSTOM_TYPE } from '@drfocus/templates';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { DateField, TimeField } from '@/components/DateTimeFields';
import { MascotBubble } from '@/components/MascotBubble';
import { Bubble, PrivacyNote, QuestionInput } from '@/components/plan/AgentChat';
import { draftsFromAgent } from '@/components/plan/editing';
import { Banner, Button, Field, Row, Screen, Section, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { AgentFailure, callAgent, isMockAgent } from '@/features/agent';
import { proposeInitialPlan } from '@/features/planning';
import { localToIso } from '@/lib/format';

const DRAFT_ID = 'custom';
const CUSTOM_VERSION = 1;

interface Round {
  questions: AgentQuestion[];
  answers: Record<string, string>;
}

interface CustomState {
  phase: 'form' | 'chat';
  title: string;
  description: string;
  expectedResult: string;
  date: string | null;
  time: string | null;
  rounds: Round[];
}

const EMPTY: CustomState = { phase: 'form', title: '', description: '', expectedResult: '', date: null, time: null, rounds: [] };

/** S06 · «Otra actividad»: conversación breve con el agente, con alternativa manual. */
export default function CustomActivity() {
  const prefs = repo.getPrefs();
  const [st, setSt] = useState<CustomState>(() => {
    const saved = repo.getAgentDraft(DRAFT_ID);
    return saved ? { ...EMPTY, ...(JSON.parse(saved.inputJson) as Partial<CustomState>) } : EMPTY;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [maxed, setMaxed] = useState(false);
  const call = useRef(0);
  const first = useRef(true);

  // Borrador persistente: la conversación se conserva si sales o falla la red.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => repo.saveAgentDraft(DRAFT_ID, '', st, null), 400);
    return () => clearTimeout(id);
  }, [st]);

  if (!prefs) return <Screen><Banner kind="error">Primero completa tu perfil.</Banner></Screen>;
  const zone = prefs.timezone;
  const set = <K extends keyof CustomState>(k: K, v: CustomState[K]) => setSt((s) => ({ ...s, [k]: v }));
  const current = st.rounds[st.rounds.length - 1];

  const fail = (m: string) => {
    setFormError(m);
    return null;
  };
  const validDeadline = (): string | null => {
    setFormError(null);
    if (st.title.trim().length < 3) return fail('Ponle un título a la actividad.');
    if (!st.date || !st.time) return fail('Elige la fecha y la hora de la fecha límite.');
    const iso = localToIso(st.date, st.time, zone);
    if (!iso) return fail('La fecha u hora no es válida.');
    if (Date.parse(iso) <= Date.now()) return fail('La fecha límite ya pasó. Elige una fecha futura.');
    if (Date.parse(iso) - Date.now() > HORIZON_DAYS * 86_400_000) return fail(`Por ahora Doctor Focus planea hasta ${HORIZON_DAYS} días. Elige una entrega más cercana.`);
    return iso;
  };

  const answers = (rounds: Round[]): AgentAnswer[] =>
    rounds.flatMap((r) => r.questions.map((q) => ({ questionId: q.id, question: q.text, answer: (r.answers[q.id] ?? '').trim() || 'No sé' })));

  const createActivity = (deadlineAt: string, rounds: Round[]) =>
    repo.createDraftActivity({
      role: prefs.role,
      typeId: CUSTOM_TYPE.id,
      templateVersion: CUSTOM_VERSION,
      title: st.title.trim(),
      description: st.description.trim(),
      expectedResult: st.expectedResult.trim(),
      requirements: { answers: answers(rounds) },
      deadlineAt,
      deadlineZone: zone,
    });

  const send = async (rounds: Round[]) => {
    const deadlineAt = validDeadline();
    if (!deadlineAt) return;
    const mine = ++call.current;
    setBusy(true);
    setError(null);
    setMaxed(false);
    setSt((s) => ({ ...s, phase: 'chat', rounds }));
    try {
      const res = await callAgent({
        mode: 'decompose',
        role: prefs.role,
        activity: { title: st.title.trim(), description: st.description.trim(), expectedResult: st.expectedResult.trim(), requirements: [], deadlineAt, timezone: zone, progressSummary: '' },
        preferredBlockMinutes: prefs.preferredBlockMinutes,
        answers: answers(rounds),
        targetObjective: null,
      });
      if (mine !== call.current) return;
      if (res.kind === 'needs_clarification') {
        if (rounds.length >= LIMITS.clarificationRoundsMax) setMaxed(true);
        else setSt((s) => ({ ...s, rounds: [...rounds, { questions: res.questions, answers: {} }] }));
        return;
      }
      const id = createActivity(deadlineAt, rounds);
      proposeInitialPlan(id, draftsFromAgent(res.objectives), [...res.assumptions, ...res.warnings]);
      repo.clearAgentDraft(DRAFT_ID);
      router.replace({ pathname: '/plan/[id]/preview', params: { id } });
    } catch (e) {
      if (mine !== call.current) return;
      const f = e instanceof AgentFailure ? e.error : { message: 'Algo falló. Tu borrador se guardó.', retryable: true };
      setError({ message: f.message, retryable: f.retryable });
    } finally {
      if (mine === call.current) setBusy(false);
    }
  };

  const cancel = () => {
    call.current += 1;
    setBusy(false);
  };

  const manual = () => {
    const deadlineAt = validDeadline();
    if (!deadlineAt) return;
    call.current += 1;
    const id = createActivity(deadlineAt, st.rounds);
    proposeInitialPlan(id, []);
    repo.clearAgentDraft(DRAFT_ID);
    router.replace({ pathname: '/plan/[id]/preview', params: { id } });
  };

  const answer = (qid: string, v: string) =>
    setSt((s) => {
      const rounds = [...s.rounds];
      const last = rounds[rounds.length - 1]!;
      rounds[rounds.length - 1] = { ...last, answers: { ...last.answers, [qid]: v } };
      return { ...s, rounds };
    });

  const restart = () => {
    call.current += 1;
    setBusy(false);
    setError(null);
    setMaxed(false);
    setSt((s) => ({ ...s, phase: 'form', rounds: [] }));
  };

  const alternatives = (
    <View style={{ gap: space.sm }}>
      <Button label="Escribir los pasos a mano" kind="ghost" onPress={manual} />
      <Button label="Usar una plantilla" kind="text" onPress={() => router.back()} />
    </View>
  );

  const demo = isMockAgent() ? <Banner kind="info">Agente de demostración: las respuestas son de prueba, no de un modelo real.</Banner> : null;

  if (st.phase === 'form')
    return (
      <Screen footer={<Button label="Enviar al agente" onPress={() => send([])} />}>
        <MascotBubble pose="bienvenida" text="Cuéntame qué tienes que hacer y te propongo pasos pequeños. Tú los revisas antes de aceptar." size={72} />
        {demo}
        <Field label="Título" value={st.title} onChangeText={(v) => set('title', v)} placeholder="Ej. Organizar la feria de ciencias" maxLength={LIMITS.titleMax} />
        <Field label="¿Qué tiene que quedar listo?" value={st.expectedResult} onChangeText={(v) => set('expectedResult', v)} placeholder="Ej. Propuesta de organización entregada" maxLength={300} />
        <Field label="Describe la actividad" value={st.description} onChangeText={(v) => set('description', v)} placeholder="Instrucciones, requisitos o lo que ya sabes" multiline maxLength={LIMITS.descriptionMax} />
        <Section title="Fecha límite">
          <DateField label="Día" value={st.date} onChange={(v) => set('date', v)} minimumDate={new Date()} />
          <Row>
            <TimeField label="Hora" value={st.time} onChange={(v) => set('time', v)} />
          </Row>
          <T v="small" color={colors.ink2}>Zona horaria: {zone}. Doctor Focus nunca cambia esta fecha sin preguntarte.</T>
        </Section>
        <PrivacyNote />
        {formError ? <Banner kind="error">{formError}</Banner> : null}
        {alternatives}
      </Screen>
    );

  const canSend = !!current && current.questions.every((q) => current.answers[q.id]?.trim());

  return (
    <Screen
      footer={
        busy ? (
          <Button label="Cancelar" kind="ghost" onPress={cancel} />
        ) : current && !error && !maxed ? (
          <Button label="Enviar respuestas" disabled={!canSend} onPress={() => send(st.rounds)} />
        ) : null
      }
    >
      {demo}
      <Bubble who="me" text={[st.title.trim(), st.description.trim()].filter(Boolean).join('\n\n')} />
      {st.rounds.map((r, i) =>
        i < st.rounds.length - 1 || busy || error || maxed ? (
          <View key={i} style={{ gap: space.sm }}>
            {r.questions.map((q) => (
              <View key={q.id} style={{ gap: space.sm }}>
                <Bubble who="bot" text={q.text} />
                {r.answers[q.id]?.trim() ? <Bubble who="me" text={r.answers[q.id]!.trim()} /> : null}
              </View>
            ))}
          </View>
        ) : (
          <View key={i} style={{ gap: space.lg }}>
            <T v="small" color={colors.ink2}>
              Ronda {st.rounds.length} de {LIMITS.clarificationRoundsMax} como máximo. Si no sabes algo, elige «No sé».
            </T>
            {r.questions.map((q) => (
              <QuestionInput key={q.id} q={q} value={r.answers[q.id] ?? ''} onChange={(v) => answer(q.id, v)} />
            ))}
          </View>
        ),
      )}

      {busy ? <MascotBubble {...mascotMessage('thinking', prefs.role)} size={72} /> : null}
      {formError ? <Banner kind="error">{formError}</Banner> : null}

      {error ? (
        <View style={{ gap: space.sm }}>
          <Banner kind="error" title="No pude armar los pasos esta vez">{error.message}</Banner>
          {error.retryable ? <Button label="Reintentar" onPress={() => send(st.rounds)} /> : null}
          {alternatives}
        </View>
      ) : null}

      {maxed ? (
        <View style={{ gap: space.sm }}>
          <Banner kind="warn" title="Necesito más datos de los que caben aquí">Escribe tú los pasos; tus respuestas quedan guardadas con la actividad.</Banner>
          {alternatives}
        </View>
      ) : null}

      {!busy ? <Button label="Cambiar la descripción" kind="text" onPress={restart} /> : null}
      {!busy && !error && !maxed ? <Button label="Prefiero escribir los pasos a mano" kind="text" onPress={manual} /> : null}
    </Screen>
  );
}
