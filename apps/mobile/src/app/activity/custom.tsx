import { useLocalSearchParams } from 'expo-router';
import { Banner, Screen, T } from '@/components/ui';

/** S06 · Esqueleto: pendiente de implementar (ver docs/PARALELO.md). */
export default function CustomActivity() {
  const params = useLocalSearchParams();
  return (
    <Screen>
      <T v="h2">Otra actividad</T>
      <Banner kind="info">Pantalla en construcción.</Banner>
      <T v="small">{JSON.stringify(params)}</T>
    </Screen>
  );
}
