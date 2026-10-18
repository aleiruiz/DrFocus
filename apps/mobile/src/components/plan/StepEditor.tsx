import type { ObjectiveDraft } from '@drfocus/contracts';
import { colors } from '@drfocus/design-tokens';
import { useEffect, useState } from 'react';
import { Sheet } from '../Sheet';
import { Banner, Button, Field, Row, Stepper, T } from '../ui';

export interface StepFields {
  title: string;
  expectedResult: string;
  estimatedMinutes: number;
}

/** Hoja para editar o agregar un paso antes de aceptar el plan. */
export function StepEditor({ open, step, onSave, onClose }: { open: boolean; step: ObjectiveDraft | null; onSave: (f: StepFields) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [expected, setExpected] = useState('');
  const [minutes, setMinutes] = useState(20);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(step?.title ?? '');
    setExpected(step?.expectedResult ?? '');
    setMinutes(step?.estimatedMinutes ?? 20);
    setError(null);
  }, [open, step]);

  const save = () => {
    if (title.trim().length < 3) return setError('Escribe qué vas a hacer (al menos 3 letras).');
    if (expected.trim().length < 3) return setError('Escribe cómo sabrás que terminaste.');
    onSave({ title: title.trim(), expectedResult: expected.trim(), estimatedMinutes: minutes });
  };

  return (
    <Sheet visible={open} onClose={onClose} title={step ? 'Editar paso' : 'Agregar paso'}>
      <Field label="Qué vas a hacer" value={title} onChangeText={setTitle} maxLength={120} placeholder="Ej. Leer el capítulo 3" />
      <Field label="Listo cuando…" value={expected} onChangeText={setExpected} maxLength={300} placeholder="Ej. Tengo un resumen de una página" />
      <T v="bodyBold">Duración estimada</T>
      <Stepper value={minutes} onChange={setMinutes} min={5} max={120} step={5} suffix="min" label="duración" />
      <T v="small" color={colors.ink2}>{step?.source === 'agent' ? 'Estimación del agente. Cámbiala si te conoces mejor.' : 'Es una estimación; puedes cambiarla después.'}</T>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <Row>
        <Button label="Guardar" onPress={save} style={{ flex: 1 }} />
        <Button label="Cancelar" kind="text" onPress={onClose} />
      </Row>
    </Sheet>
  );
}
