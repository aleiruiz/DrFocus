import { colors, space } from '@drfocus/design-tokens';
import { progress } from '@drfocus/domain';
import { getTemplate } from '@drfocus/templates';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Card, Chip, ProgressBar, Row, Screen, T } from '@/components/ui';
import { fmtDayTime } from '@/lib/format';
import { usePrefs } from '@/lib/hooks';
import { useWorkspace } from '@/lib/useWorkspace';

const FILTERS = [
  { id: 'active', label: 'En curso' },
  { id: 'draft', label: 'Borradores' },
  { id: 'completed', label: 'Terminadas' },
  { id: 'all', label: 'Todas' },
] as const;

/** S08 · Lista de actividades con filtros por estado. */
export default function Activities() {
  const prefs = usePrefs();
  const zone = prefs?.timezone ?? 'America/Mexico_City';
  const { activities, objectives } = useWorkspace();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('active');
  const list = activities
    .filter((a) => a.status !== 'archived' && (filter === 'all' || a.status === filter))
    .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt));

  return (
    <Screen>
      <Row>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </Row>
      {list.length === 0 ? (
        <Card>
          <T v="bodyBold">Nada por aquí.</T>
          <T color={colors.ink2}>Crea una actividad y Doctor Focus la divide en pasos pequeños.</T>
        </Card>
      ) : null}
      {list.map((a) => {
        const objs = objectives.filter((o) => o.activityId === a.id);
        const p = progress(objs);
        const tName = a.typeId === 'custom' ? 'Otra actividad' : (getTemplate(a.typeId)?.name ?? a.typeId);
        return (
          <Card
            key={a.id}
            accessibilityLabel={`${a.title}. ${tName}. Fecha límite ${fmtDayTime(a.deadlineAt, zone)}`}
            onPress={() => router.push(a.status === 'draft' ? { pathname: '/plan/[id]/preview', params: { id: a.id } } : { pathname: '/activity/[id]', params: { id: a.id } })}
          >
            <T v="eyebrow" color={colors.ink3}>{tName}{a.role !== prefs?.role ? ` · perfil ${a.role === 'student' ? 'estudiante' : 'docente'}` : ''}</T>
            <T v="h3">{a.title}</T>
            <T v="small" color={colors.ink2}>Fecha límite: {fmtDayTime(a.deadlineAt, zone)}</T>
            {a.status === 'draft' ? <T v="small" color={colors.sunInk}>Plan sin aceptar</T> : <ProgressBar done={p.done} total={p.total} />}
          </Card>
        );
      })}
      <Button label="Nueva actividad" icon={<Icon name="plus" color={colors.white} />} onPress={() => router.push('/activity/new')} />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
