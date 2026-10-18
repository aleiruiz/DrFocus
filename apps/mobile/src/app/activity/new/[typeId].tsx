import { colors, space } from '@drfocus/design-tokens';
import { HORIZON_DAYS } from '@drfocus/planner';
import { buildObjectives, defaultAnswers, getTemplate, type Answers, type TemplateQuestion } from '@drfocus/templates';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { DateField, TimeField } from '@/components/DateTimeFields';
import { Banner, Button, Chip, Field, Row, Screen, Section, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { proposeInitialPlan } from '@/features/planning';
import { localToIso } from '@/lib/format';

interface FormState {
  title: string;
  description: string;
  expectedResult: string;
  date: string | null;
  time: string | null;
  answers: Answers;
}

/** S05 · Formulario: campos generales y preguntas de la plantilla, con borrador persistente. */
export default function ActivityForm() {
  const { typeId } = useLocalSearchParams<{ typeId: string }>();
  const nav = useNavigation();
  const template = getTemplate(typeId);
  const prefs = repo.getPrefs();
  const [form, setForm] = useState<FormState>(() => {
    const saved = repo.getFormDraft(typeId);
    if (saved) return JSON.parse(saved.json) as FormState;
    return { title: '', description: '', expectedResult: '', date: null, time: null, answers: template ? defaultAnswers(template) : {} };
  });
  const [error, setError] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (template) nav.setOptions({ title: template.name });
  }, [nav, template]);

  // Guarda el borrador en cada cambio para no perder lo escrito.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => repo.saveFormDraft(typeId, form), 400);
    return () => clearTimeout(id);
  }, [form, typeId]);

  if (!template || !prefs) return <Screen><Banner kind="error">Esta plantilla no existe.</Banner></Screen>;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setAnswer = (k: string, v: Answers[string]) => setForm((f) => ({ ...f, answers: { ...f.answers, [k]: v } }));

  const submit = () => {
    setError(null);
    if (form.title.trim().length < 3) return setError('Ponle un título a la actividad.');
    if (!form.date || !form.time) return setError('Elige la fecha y la hora de la fecha límite.');
    const deadlineAt = localToIso(form.date, form.time, prefs.timezone);
    if (!deadlineAt) return setError('La fecha u hora no es válida.');
    if (Date.parse(deadlineAt) <= Date.now()) return setError('La fecha límite ya pasó. Elige una fecha futura.');
    if (Date.parse(deadlineAt) - Date.now() > HORIZON_DAYS * 86_400_000) return setError(`Por ahora Doctor Focus planea hasta ${HORIZON_DAYS} días. Divide la actividad en una entrega más cercana.`);
    const id = repo.createDraftActivity({
      role: template.role,
      typeId: template.id,
      templateVersion: template.version,
      title: form.title.trim(),
      description: form.description.trim(),
      expectedResult: form.expectedResult.trim() || template.example.expectedResult,
      requirements: form.answers,
      deadlineAt,
      deadlineZone: prefs.timezone,
    });
    const objectives = buildObjectives(template, form.answers, { preferredBlockMinutes: prefs.preferredBlockMinutes });
    proposeInitialPlan(id, objectives);
    repo.clearFormDraft(typeId);
    router.replace({ pathname: '/plan/[id]/preview', params: { id } });
  };

  return (
    <Screen footer={<Button label="Ver plan propuesto" onPress={submit} />}>
      <Field label="Título" value={form.title} onChangeText={(v) => set('title', v)} placeholder={template.example.title} maxLength={120} />
      <Field label="¿Qué tiene que quedar listo?" value={form.expectedResult} onChangeText={(v) => set('expectedResult', v)} placeholder={template.example.expectedResult} maxLength={300} />
      <Field label="Instrucciones o requisitos" value={form.description} onChangeText={(v) => set('description', v)} placeholder={template.example.description || 'Opcional'} multiline maxLength={4000} />
      <Section title="Fecha límite">
        <DateField label="Día" value={form.date} onChange={(v) => set('date', v)} minimumDate={new Date()} />
        <Row>
          <TimeField label="Hora" value={form.time} onChange={(v) => set('time', v)} />
        </Row>
        <T v="small" color={colors.ink2}>Zona horaria: {prefs.timezone}. Doctor Focus nunca cambia esta fecha sin preguntarte.</T>
      </Section>
      <Section title="Detalles">
        {template.questions.map((q) => (
          <Question key={q.id} q={q} value={form.answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
        ))}
      </Section>
      {template.alreadyDone.length ? (
        <Section title="¿Ya avanzaste algo?">
          <Row>
            {template.alreadyDone.map((d) => {
              const list = Array.isArray(form.answers.alreadyDone) ? (form.answers.alreadyDone as string[]) : [];
              const on = list.includes(d.stepId);
              return <Chip key={d.stepId} label={d.label} selected={on} onPress={() => setAnswer('alreadyDone', on ? list.filter((x) => x !== d.stepId) : [...list, d.stepId])} />;
            })}
          </Row>
        </Section>
      ) : null}
      {error ? <Banner kind="error">{error}</Banner> : null}
      <View style={{ height: space.md }} />
    </Screen>
  );
}

function Question({ q, value, onChange }: { q: TemplateQuestion; value: Answers[string]; onChange: (v: Answers[string]) => void }) {
  if (q.kind === 'choice' || q.kind === 'multi') {
    const list = Array.isArray(value) ? value : [];
    return (
      <View style={{ gap: 6 }}>
        <T v="bodyBold">{q.label}</T>
        <Row>
          {q.options?.map((opt) => {
            const on = q.kind === 'multi' ? list.includes(opt) : value === opt;
            return <Chip key={opt} label={opt} selected={on} onPress={() => onChange(q.kind === 'multi' ? (on ? list.filter((x) => x !== opt) : [...list, opt]) : opt)} />;
          })}
        </Row>
        {q.help ? <T v="small" color={colors.ink2}>{q.help}</T> : null}
      </View>
    );
  }
  if (q.kind === 'number') {
    return (
      <Field
        label={`${q.label}${q.suffix ? ` (${q.suffix})` : ''}`}
        help={q.help}
        keyboardType="number-pad"
        value={value === undefined ? '' : String(value)}
        onChangeText={(t) => {
          const n = Number(t.replace(/\D/g, ''));
          onChange(t === '' ? undefined : Math.min(q.max ?? 10000, n));
        }}
      />
    );
  }
  return <Field label={q.label} help={q.help} value={typeof value === 'string' ? value : ''} onChangeText={onChange} multiline={q.kind === 'textarea'} maxLength={q.kind === 'textarea' ? 1000 : 200} />;
}
