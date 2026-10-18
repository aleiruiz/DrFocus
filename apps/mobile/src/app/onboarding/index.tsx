import { colors, space } from '@drfocus/design-tokens';
import { mascotMessage } from '@drfocus/domain';
import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Mascot } from '@/components/Mascot';
import { Button, Card, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';

/** S01 · Bienvenida y perfil. */
export default function Welcome() {
  const existing = repo.getPrefs();
  const [role, setRole] = useState<'student' | 'teacher' | null>(existing?.role ?? null);
  const msg = mascotMessage('welcome', role ?? 'student');

  const next = () => {
    if (!role) return;
    const timezone = getCalendars()[0]?.timeZone ?? 'America/Mexico_City';
    repo.ensurePrefs(role, timezone);
    router.push('/onboarding/availability');
  };

  return (
    <Screen footer={<Button label="Continuar" onPress={next} disabled={!role} />}>
      <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xxl }}>
        <Mascot pose="bienvenida" size={190} />
        <T v="h1" style={{ textAlign: 'center' }} accessibilityRole="header">
          Doctor Focus
        </T>
        <T style={{ textAlign: 'center' }} color={colors.ink2}>
          {msg.text} Convierte actividades grandes en pasos pequeños, con fecha y recordatorios.
        </T>
      </View>
      <T v="h3">¿Cómo vas a usar la app?</T>
      <RoleCard selected={role === 'student'} onPress={() => setRole('student')} title="Soy estudiante" text="Tareas, ensayos, exámenes y proyectos." />
      <RoleCard selected={role === 'teacher'} onPress={() => setRole('teacher')} title="Soy docente" text="Preparar clases, crear evaluaciones, calificar y hacer material." />
      <T v="small" color={colors.ink2}>
        Puedes cambiar de perfil en Ajustes sin perder tus actividades. Tus datos se quedan en este teléfono.
      </T>
    </Screen>
  );
}

function RoleCard({ selected, onPress, title, text }: { selected: boolean; onPress: () => void; title: string; text: string }) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${text}${selected ? '. Seleccionado' : ''}`} style={selected ? { borderColor: colors.petrol, borderWidth: 2, backgroundColor: colors.turq50 } : undefined}>
      <T v="h3">{(selected ? '✓ ' : '') + title}</T>
      <T color={colors.ink2}>{text}</T>
    </Card>
  );
}
