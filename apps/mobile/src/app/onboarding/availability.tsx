import { colors } from '@drfocus/design-tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AvailabilityEditor, DEFAULT_RULES, type DayRule } from '@/components/AvailabilityEditor';
import { Banner, Button, Screen, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { rescheduleReminders } from '@/features/reminders';
import { ONBOARDING_VERSION } from '@/lib/constants';

/** S02 · Disponibilidad semanal. También se abre desde Ajustes. */
export default function Availability() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const prefs = repo.getPrefs();
  const saved = repo.getRules().map((r) => ({ weekday: r.weekday, startLocal: r.startLocal, endLocal: r.endLocal }));
  const [rules, setRules] = useState<DayRule[]>(saved.length ? saved : DEFAULT_RULES[prefs?.role ?? 'student']);

  const save = () => {
    if (!prefs) return router.replace('/onboarding');
    repo.replaceRules(rules, prefs.timezone);
    if (from === 'settings') {
      rescheduleReminders().catch(() => undefined);
      return router.back();
    }
    repo.updatePrefs({ onboardingVersion: ONBOARDING_VERSION });
    repo.logEvent('onboarding_completed', null, { role: prefs.role, days: rules.length });
    router.replace('/today');
  };

  return (
    <Screen footer={<Button label={from === 'settings' ? 'Guardar' : 'Guardar y empezar'} onPress={save} disabled={rules.length === 0} />}>
      <T color={colors.ink2}>
        ¿Cuándo sueles tener tiempo para avanzar? Doctor Focus acomoda tus pasos solo en estos horarios. Los cambios que hagas después se aplican a los planes nuevos o al reorganizar.
      </T>
      {rules.length === 0 && <Banner kind="warn">Elige al menos un día con tiempo disponible.</Banner>}
      <AvailabilityEditor rules={rules} onChange={setRules} />
      <T v="small" color={colors.ink2}>
        Duración de bloques ({prefs?.preferredBlockMinutes ?? 20} min), horario de silencio (21:00–08:00) y recordatorios se pueden cambiar en Ajustes.
      </T>
    </Screen>
  );
}
