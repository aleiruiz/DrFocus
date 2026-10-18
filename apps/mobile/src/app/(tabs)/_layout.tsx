import { colors, fonts } from '@drfocus/design-tokens';
import { Tabs } from 'expo-router';
import { Icon } from '@/components/Icon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
        tabBarActiveTintColor: colors.petrol,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 64, paddingBottom: 8 },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 13 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Hoy', tabBarIcon: ({ color }) => <Icon name="today" color={color} /> }} />
      <Tabs.Screen name="activities" options={{ title: 'Actividades', tabBarIcon: ({ color }) => <Icon name="list" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: ({ color }) => <Icon name="settings" color={color} /> }} />
    </Tabs>
  );
}
