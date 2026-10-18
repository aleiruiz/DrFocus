import { useLocalSearchParams } from 'expo-router';
import { Banner, Screen, T } from '@/components/ui';

/** S11 · Esqueleto: pendiente de implementar (ver docs/PARALELO.md). */
export default function Settings() {
  const params = useLocalSearchParams();
  return (
    <Screen>
      <T v="h2">Ajustes</T>
      <Banner kind="info">Pantalla en construcción.</Banner>
      <T v="small">{JSON.stringify(params)}</T>
    </Screen>
  );
}
