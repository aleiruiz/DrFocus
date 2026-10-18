import type { AgentQuestion } from '@drfocus/contracts';
import { colors, radius, space } from '@drfocus/design-tokens';
import { View } from 'react-native';
import { MascotAvatar } from '../Mascot';
import { Card, Chip, Field, Row, T } from '../ui';

/** Burbuja de la conversación de «Otra actividad». */
export function Bubble({ who, text }: { who: 'bot' | 'me'; text: string }) {
  const me = who === 'me';
  return (
    <View style={{ flexDirection: 'row', justifyContent: me ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: space.sm }}>
      {!me ? <MascotAvatar size={32} /> : null}
      <View
        style={{
          maxWidth: '82%',
          padding: space.md,
          borderRadius: radius.lg,
          backgroundColor: me ? colors.petrol : colors.card,
          borderWidth: me ? 0 : 1,
          borderColor: colors.line,
          borderBottomRightRadius: me ? 4 : radius.lg,
          borderBottomLeftRadius: me ? radius.lg : 4,
        }}
      >
        <T color={me ? colors.white : colors.ink}>{text}</T>
      </View>
    </View>
  );
}

/** Pregunta del agente con opciones rápidas y respuesta libre. */
export function QuestionInput({ q, value, onChange }: { q: AgentQuestion; value: string; onChange: (v: string) => void }) {
  const options = [...q.options, 'No sé'];
  return (
    <View style={{ gap: space.sm }}>
      <Bubble who="bot" text={q.text} />
      <Row>
        {options.map((o) => (
          <Chip key={o} label={o} selected={value === o} onPress={() => onChange(value === o ? '' : o)} />
        ))}
      </Row>
      <Field label="Tu respuesta" value={value} onChangeText={onChange} maxLength={1000} placeholder="O escribe con tus palabras" />
    </View>
  );
}

/** Qué datos salen del teléfono (TECH_SPEC §9). Se muestra antes del primer envío. */
export function PrivacyNote() {
  return (
    <Card style={{ backgroundColor: colors.turq50, borderColor: colors.turq300 }}>
      <T v="bodyBold">Qué se envía al agente</T>
      <T v="small" color={colors.ink2}>
        Al enviar, salen del teléfono: el título, la descripción, lo que tiene que quedar listo, la fecha límite, tu zona horaria, tu perfil (estudiante o docente), tu duración de bloque preferida y tus respuestas.
      </T>
      <T v="small" color={colors.ink2}>
        No se envían tus otras actividades, tu calendario ni tu nombre. No escribas nombres de alumnos, matrículas ni datos personales.
      </T>
      <T v="small" color={colors.ink2}>Si prefieres no enviar nada, usa una plantilla o escribe los pasos a mano.</T>
    </Card>
  );
}
