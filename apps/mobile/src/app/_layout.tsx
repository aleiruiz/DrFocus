import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { colors, fonts } from '@drfocus/design-tokens';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import migrations from '../../drizzle/migrations';
import { T } from '@/components/ui';
import { db } from '@/db/client';
import * as repo from '@/db/repo';
import { rescheduleReminders } from '@/features/reminders';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Solo se aceptan rutas conocidas desde un aviso (TECH_SPEC §3, deep links). */
function openFromNotification(data: unknown) {
  const d = data as { activityId?: unknown; objectiveId?: unknown } | null;
  if (!d || typeof d.activityId !== 'string') return;
  repo.logEvent('reminder_opened', typeof d.objectiveId === 'string' ? d.objectiveId : d.activityId, {});
  router.push({ pathname: '/activity/[id]', params: { id: d.activityId, objective: typeof d.objectiveId === 'string' ? d.objectiveId : '' } });
}

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [fontsLoaded] = useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const ready = success && fontsLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    rescheduleReminders().catch(() => undefined);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') rescheduleReminders().catch(() => undefined);
    });
    const tap = Notifications.addNotificationResponseReceivedListener((r) => openFromNotification(r.notification.request.content.data));
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification.request.content.data);
    return () => {
      app.remove();
      tap.remove();
    };
  }, [ready]);

  if (error)
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: colors.bg }}>
        <T v="h2">No se pudo abrir la base de datos</T>
        <T>{error.message}</T>
      </View>
    );
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.petrol,
          headerTitleStyle: { fontFamily: fonts.display, color: colors.ink },
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/availability" options={{ title: 'Tu tiempo disponible' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activity/new/index" options={{ title: 'Nueva actividad' }} />
        <Stack.Screen name="activity/new/[typeId]" options={{ title: 'Datos de la actividad' }} />
        <Stack.Screen name="activity/custom" options={{ title: 'Otra actividad' }} />
        <Stack.Screen name="activity/[id]" options={{ title: 'Actividad' }} />
        <Stack.Screen name="plan/[id]/preview" options={{ title: 'Vista previa del plan' }} />
        <Stack.Screen name="plan/[id]/replan" options={{ title: 'Reorganizar' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
