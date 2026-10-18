import { describeGraphIssue, type Role } from '@drfocus/contracts';
import { colors, space } from '@drfocus/design-tokens';
import { mascotMessage } from '@drfocus/domain';
import type { PlannerOutput } from '@drfocus/planner';
import { useState } from 'react';
import { View } from 'react-native';
import { fmtDayTime, fmtDur, isoToLocalParts, localToIso } from '@/lib/format';
import { DateField, TimeField } from '../DateTimeFields';
import { MascotBubble } from '../MascotBubble';
import { Banner, Button, Card, Row, T } from '../ui';

/** Explica por qué el plan no es viable y ofrece las tres salidas de TECH_SPEC §6 en la misma pantalla. */
export function ConflictPanel({
  schedule,
  deadlineAt,
  zone,
  role,
  onAvailability,
  onScope,
  onDeadline,
}: {
  schedule: PlannerOutput;
  deadlineAt: string;
  zone: string;
  role: Role;
  onAvailability: () => void;
  onScope: () => void;
  onDeadline: (iso: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const initial = isoToLocalParts(deadlineAt, zone);
  const [date, setDate] = useState<string | null>(initial.date);
  const [time, setTime] = useState<string | null>(initial.time);

  const past = schedule.conflicts.some((c) => c.kind === 'deadline_past');
  const beyond = schedule.conflicts.find((c) => c.kind === 'beyond_horizon');
  const graph = schedule.conflicts.flatMap((c) => (c.kind === 'graph' ? [describeGraphIssue(c.issue)] : []));
  const missing = schedule.conflicts.reduce((n, c) => (c.kind === 'insufficient_time' ? n + c.missingMinutes : n), 0) || schedule.unassignedMinutes;
  const timeIssue = !past && !beyond && !graph.length;

  const newIso = date && time ? localToIso(date, time, zone) : null;
  const dateError = !picking
    ? null
    : !newIso
      ? 'Elige día y hora.'
      : Date.parse(newIso) <= Date.now()
        ? 'Esa fecha ya pasó.'
        : newIso === deadlineAt
          ? 'Es la misma fecha límite que ya tienes.'
          : null;

  const title = past
    ? 'La fecha límite ya pasó'
    : beyond && beyond.kind === 'beyond_horizon'
      ? `La fecha límite está a más de ${beyond.horizonDays} días`
      : graph.length
        ? 'El orden de los pasos tiene un problema'
        : 'El trabajo no cabe antes de la fecha límite';

  return (
    <View style={{ gap: space.md }} accessibilityLiveRegion="polite">
      <MascotBubble {...mascotMessage('conflict', role)} size={72} />
      <Banner kind="warn" title={title}>
        {graph.length ? (
          <T v="small" color={colors.sunInk}>{graph.join(' ')} Revisa el orden con las flechas o quita el paso.</T>
        ) : timeIssue ? (
          <T v="small" color={colors.sunInk}>
            Hay {fmtDur(schedule.requiredMinutes)} de trabajo y {fmtDur(schedule.availableMinutes)} libres antes de la fecha límite. Faltan {fmtDur(missing)} por acomodar. Ya conté tus otras actividades.
          </T>
        ) : (
          <T v="small" color={colors.sunInk}>Elige una fecha límite nueva para poder planear.</T>
        )}
      </Banner>
      <T v="small" color={colors.ink2}>Tu fecha límite sigue siendo {fmtDayTime(deadlineAt, zone)}. Solo cambia si tú lo decides.</T>

      {timeIssue ? (
        <>
          <Option title="Ajustar disponibilidad" text="Agrega horas libres en tu semana y vuelvo a calcular." action="Cambiar disponibilidad" onPress={onAvailability} />
          <Option title="Ajustar el alcance" text="Hago cada paso pendiente unos 25 % más corto. Revisa que siga cumpliendo lo que te piden, o quita pasos." action="Acortar los pasos" onPress={onScope} />
        </>
      ) : null}

      {!graph.length ? (
        <Card style={{ gap: space.sm }}>
          <T v="h3">Cambiar la fecha límite</T>
          <T v="small" color={colors.ink2}>Solo si quien la definió lo permite (tu docente, coordinación o tú).</T>
          {!picking ? (
            <Button label="Elegir otra fecha límite" kind="soft" onPress={() => setPicking(true)} />
          ) : (
            <>
              <DateField label="Día" value={date} onChange={setDate} minimumDate={new Date()} />
              <Row>
                <TimeField label="Hora" value={time} onChange={setTime} />
              </Row>
              {dateError ? <T v="small" color={colors.bad}>{dateError}</T> : null}
              <Button
                label={newIso && !dateError ? `Sí, cambiar a ${fmtDayTime(newIso, zone)}` : 'Confirmar nueva fecha límite'}
                disabled={!!dateError}
                onPress={() => newIso && onDeadline(newIso)}
              />
              <Button label="No cambiar la fecha" kind="text" onPress={() => setPicking(false)} />
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

function Option({ title, text, action, onPress }: { title: string; text: string; action: string; onPress: () => void }) {
  return (
    <Card style={{ gap: space.sm }}>
      <T v="h3">{title}</T>
      <T v="small" color={colors.ink2}>{text}</T>
      <Button label={action} kind="soft" onPress={onPress} />
    </Card>
  );
}
