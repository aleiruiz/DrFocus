import { useLocalSearchParams } from 'expo-router';
import { Banner, Screen, T } from '@/components/ui';

/** S07 · Esqueleto: pendiente de implementar (ver docs/PARALELO.md). */
export default function PlanPreview() {
  const params = useLocalSearchParams();
  return (
    <Screen>
      <T v="h2">Vista previa del plan</T>
      <Banner kind="info">Pantalla en construcción.</Banner>
      <T v="small">{JSON.stringify(params)}</T>
    </Screen>
  );
}
