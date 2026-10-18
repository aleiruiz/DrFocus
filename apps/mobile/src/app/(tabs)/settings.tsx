import { colors, space } from '@drfocus/design-tokens';
import type { Role } from '@drfocus/contracts';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { TimeField } from '@/components/DateTimeFields';
import { Sheet } from '@/components/Sheet';
import { CheckRow, LinkRow, SwitchRow } from '@/components/settings/rows';
import { Banner, Button, Card, Chip, Field, Row, Screen, Section, Stepper, T } from '@/components/ui';
import * as repo from '@/db/repo';
import { getToken, isMockAgent, setToken } from '@/features/agent';
import { shareFile, wipeEverything, writePilotExport } from '@/features/export';
import { permissionStatus, requestPermission, rescheduleReminders } from '@/features/reminders';
import { ROLE_LABEL } from '@/lib/constants';
import { cap, fmtLocal, fmtLong, fmtTime } from '@/lib/format';
import { usePrefs } from '@/lib/hooks';

type Permission = Awaited<ReturnType<typeof permissionStatus>>;

const PERMISSION_TEXT: Record<Permission, string> = {
  granted: 'Permitidas. Los avisos pueden aparecer aunque la app esté cerrada.',
  denied: 'Bloqueadas en el teléfono. La app funciona, pero no puede avisarte. Puedes permitirlas en la configuración del sistema.',
  undetermined: 'Aún no has dado permiso. Se pide al aceptar tu primer plan o al activar los recordatorios.',
};

/** S11 · Ajustes: perfil, horarios, avisos, código de participante, privacidad, exportación y borrado. */
export default function Settings() {
  const prefs = usePrefs();
  const [permission, setPermission] = useState<Permission | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [includeText, setIncludeText] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [exportMsg, setExportMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [quietError, setQuietError] = useState<string | null>(null);
  const [askWipe, setAskWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  const refreshPermission = useCallback(() => {
    permissionStatus().then(setPermission, () => setPermission(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPermission();
      getToken().then((t) => setHasToken(!!t), () => setHasToken(false));
    }, [refreshPermission]),
  );

  // Al volver de la configuración del sistema, el permiso pudo cambiar (_layout ya reprograma los avisos).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  if (!prefs) return <Screen><T color={colors.ink2}>Cargando…</T></Screen>;
  const zone = prefs.timezone;

  const changeRole = (role: Role) => {
    if (role === prefs.role) return;
    repo.ensurePrefs(role, zone);
  };

  const changeBlock = (minutes: number) => repo.updatePrefs({ preferredBlockMinutes: minutes });

  const changeQuiet = (patch: { quietStart?: string; quietEnd?: string }) => {
    const start = patch.quietStart ?? prefs.quietStart;
    const end = patch.quietEnd ?? prefs.quietEnd;
    if (start === end) return setQuietError('El inicio y el fin del silencio no pueden ser la misma hora.');
    setQuietError(null);
    repo.updatePrefs(patch);
    rescheduleReminders().catch(() => undefined);
  };

  const toggleReminders = async (on: boolean) => {
    repo.updatePrefs({ remindersEnabled: on });
    if (on && permission === 'undetermined') await requestPermission().catch(() => false);
    refreshPermission();
    rescheduleReminders().catch(() => undefined);
  };

  const saveCode = async () => {
    const t = code.trim();
    if (t.length < 8) return setCodeMsg('El código parece incompleto. Revisa que lo hayas copiado entero.');
    try {
      await setToken(t);
      setCode('');
      setHasToken(true);
      setCodeMsg('Código guardado en este teléfono.');
    } catch {
      setCodeMsg('No se pudo guardar el código. Intenta de nuevo.');
    }
  };

  const doExport = async (kind: 'json' | 'csv') => {
    setExporting(kind);
    setExportMsg(null);
    try {
      const files = writePilotExport(includeText);
      if (kind === 'json') await shareFile(files.json, 'application/json');
      else await shareFile(files.csv, 'text/csv');
      setExportMsg({ kind: 'ok', text: `Archivo ${kind.toUpperCase()} listo. Si no lo enviaste, puedes volver a exportarlo cuando quieras.` });
    } catch (e) {
      setExportMsg({ kind: 'error', text: e instanceof Error ? e.message : 'No se pudo crear el archivo. Intenta de nuevo.' });
    } finally {
      setExporting(null);
    }
  };

  const doWipe = async () => {
    setWiping(true);
    setWipeError(null);
    try {
      await wipeEverything();
      setAskWipe(false);
      router.replace('/onboarding');
    } catch {
      setWipeError('No se pudo terminar de borrar. Intenta de nuevo; lo que ya se borró no se recupera.');
    } finally {
      setWiping(false);
    }
  };

  const remindersOn = prefs.remindersEnabled;
  const covered = prefs.remindersCoveredUntil;

  return (
    <Screen>
      <Section title="Perfil">
        <Card>
          <T v="bodyBold">Uso Doctor Focus como</T>
          <Row>
            {(['student', 'teacher'] as const).map((r) => (
              <Chip key={r} label={ROLE_LABEL[r]} selected={prefs.role === r} onPress={() => changeRole(r)} />
            ))}
          </Row>
          <T v="small" color={colors.ink2}>
            Cambia los tipos de actividad que ves al crear una nueva. Tus actividades actuales no se borran.
          </T>
        </Card>
      </Section>

      <Section title="Tiempo disponible">
        <Card>
          <LinkRow label="Disponibilidad semanal" detail="Días y horas en que Doctor Focus acomoda tus pasos" onPress={() => router.push({ pathname: '/onboarding/availability', params: { from: 'settings' } })} />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <T v="bodyBold">Bloque preferido</T>
          <Stepper label="bloque preferido" value={prefs.preferredBlockMinutes} onChange={changeBlock} step={5} min={10} max={90} suffix="min" />
          <T v="small" color={colors.ink2}>Se usa en los planes nuevos y al reorganizar. Los planes aceptados no se mueven solos.</T>
        </Card>
      </Section>

      <Section title="Recordatorios">
        <Card>
          <SwitchRow
            label="Recordatorios activados"
            help={`Resumen del día, avisos antes de cada fecha límite y uno si un paso se atrasa. Máximo ${prefs.dailyCap} al día.`}
            value={remindersOn}
            onChange={toggleReminders}
          />
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <T v="bodyBold">Horario de silencio</T>
          <Row style={{ flexWrap: 'nowrap' }}>
            <TimeField label="Desde" value={prefs.quietStart} onChange={(v) => changeQuiet({ quietStart: v })} />
            <TimeField label="Hasta" value={prefs.quietEnd} onChange={(v) => changeQuiet({ quietEnd: v })} />
          </Row>
          {quietError ? <T v="small" color={colors.bad} accessibilityLiveRegion="polite">{quietError}</T> : null}
          <T v="small" color={colors.ink2}>
            Sin avisos de {fmtLocal(prefs.quietStart)} a {fmtLocal(prefs.quietEnd)}. El silencio mueve los avisos, nunca tus fechas límite.
          </T>
        </Card>

        <Card>
          <T v="bodyBold">Permiso de notificaciones</T>
          <T v="small" color={colors.ink2}>{permission ? PERMISSION_TEXT[permission] : 'Revisando…'}</T>
          {permission === 'denied' ? <Button kind="soft" label="Abrir configuración del teléfono" onPress={() => Linking.openSettings()} /> : null}
          {permission === 'undetermined' && remindersOn ? <Button kind="soft" label="Permitir notificaciones" onPress={() => toggleReminders(true)} /> : null}
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <T v="bodyBold">Recordatorios programados hasta…</T>
          <T v="small" color={colors.ink2}>
            {covered
              ? `${cap(fmtLong(covered, zone))}, ${fmtTime(covered, zone)}. Abre la app antes de esa fecha para programar los siguientes; si no la abres, no habrá avisos después.`
              : remindersOn
                ? 'No hay avisos programados por ahora.'
                : 'Los recordatorios están desactivados.'}
          </T>
        </Card>
      </Section>

      <Section title="Agente">
        <Card>
          <T v="bodyBold">Código de participante</T>
          <T v="small" color={colors.ink2}>
            {hasToken
              ? 'Ya hay un código guardado en este teléfono. Si te dieron uno nuevo, escríbelo para reemplazarlo.'
              : 'Escribe el código que te dio el equipo del proyecto. Sin código puedes usar las plantillas; solo «Otra actividad» y «Dividir más» con ayuda lo necesitan.'}
          </T>
          {isMockAgent() ? <Banner kind="info">Esta versión usa un agente de prueba sin conexión; el código se guarda, pero todavía no se envía.</Banner> : null}
          <Field label="Código" value={code} onChangeText={(t) => { setCode(t); setCodeMsg(null); }} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Pega aquí tu código" />
          {codeMsg ? <T v="small" color={codeMsg.startsWith('Código guardado') ? colors.ok : colors.bad} accessibilityLiveRegion="polite">{codeMsg}</T> : null}
          <Button kind="soft" label="Guardar código" onPress={saveCode} disabled={!code.trim()} />
        </Card>
      </Section>

      <Section title="Datos y privacidad">
        <Card>
          <T v="bodyBold">Tus datos se quedan en este teléfono</T>
          <T v="small" color={colors.ink2}>
            No hay cuenta ni copia en internet. Solo cuando usas el agente se envían el título, la descripción y la fecha límite de esa actividad, junto con tus respuestas, para proponer pasos. Si desinstalas la app, tus datos se pierden: exporta antes de hacerlo.
          </T>
          <T v="small" color={colors.ink2}>Identificador anónimo del piloto: {prefs.participantAlias}</T>
        </Card>

        <Card>
          <T v="bodyBold">Exportar datos del piloto</T>
          <T v="small" color={colors.ink2}>
            Crea un archivo con tus actividades, objetivos y eventos de uso (tipos, estados, minutos y fechas) para compartirlo con el equipo del proyecto.
          </T>
          <CheckRow
            label="Incluir títulos y descripciones"
            help="Sin marcar, el archivo no lleva lo que escribiste. Márcala solo si estás de acuerdo en compartirlo."
            value={includeText}
            onChange={setIncludeText}
          />
          <Row style={{ flexWrap: 'nowrap' }}>
            <Button label="Compartir JSON" onPress={() => doExport('json')} loading={exporting === 'json'} disabled={!!exporting} style={{ flex: 1, paddingHorizontal: space.md }} />
            <Button label="Compartir CSV" onPress={() => doExport('csv')} loading={exporting === 'csv'} disabled={!!exporting} style={{ flex: 1, paddingHorizontal: space.md }} />
          </Row>
          {exportMsg ? <Banner kind={exportMsg.kind}>{exportMsg.text}</Banner> : null}
        </Card>

        <Button kind="danger" label="Borrar todo" onPress={() => setAskWipe(true)} accessibilityHint="Pide confirmación antes de borrar" />
      </Section>

      <Sheet visible={askWipe} onClose={() => !wiping && setAskWipe(false)} title="¿Borrar todo?">
        <T>
          Se borran tus actividades, objetivos, disponibilidad, preferencias, recordatorios programados y el código de participante. No se puede deshacer.
        </T>
        <Banner kind="warn">Si participas en el piloto, exporta tus datos antes de borrar.</Banner>
        {wipeError ? <Banner kind="error">{wipeError}</Banner> : null}
        <Button kind="danger" label="Sí, borrar todo" onPress={doWipe} loading={wiping} />
        <Button kind="ghost" label="Cancelar" onPress={() => setAskWipe(false)} disabled={wiping} />
      </Sheet>
    </Screen>
  );
}
