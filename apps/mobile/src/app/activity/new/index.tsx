import { colors, space } from '@drfocus/design-tokens';
import { CUSTOM_TYPE, templatesFor } from '@drfocus/templates';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon, isIconName } from '@/components/Icon';
import { Card, Screen, T } from '@/components/ui';
import { usePrefs } from '@/lib/hooks';

/** S04 · Tipo de actividad según el perfil, más «Otra actividad». */
export default function NewActivity() {
  const prefs = usePrefs();
  const role = prefs?.role ?? 'student';
  const list = templatesFor(role);
  return (
    <Screen>
      <T color={colors.ink2}>{role === 'teacher' ? '¿Qué tienes que preparar o revisar?' : '¿Qué tienes que hacer?'}</T>
      {list.map((t) => (
        <Card key={t.id} onPress={() => router.push({ pathname: '/activity/new/[typeId]', params: { typeId: t.id } })} accessibilityLabel={`${t.name}. ${t.hint}`}>
          <TypeRow icon={t.icon} name={t.name} hint={t.hint} />
        </Card>
      ))}
      <Card onPress={() => router.push('/activity/custom')} accessibilityLabel={`${CUSTOM_TYPE.name}. ${CUSTOM_TYPE.hint}`} style={{ borderStyle: 'dashed', borderColor: colors.turq, borderWidth: 2 }}>
        <TypeRow icon={CUSTOM_TYPE.icon} name={CUSTOM_TYPE.name} hint={`${CUSTOM_TYPE.hint}. Necesita conexión.`} />
      </Card>
    </Screen>
  );
}

function TypeRow({ icon, name, hint }: { icon: string; name: string; hint: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.turq100, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={isIconName(icon) ? icon : 'file'} color={colors.petrol} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyBold">{name}</T>
        <T v="small" color={colors.ink2}>{hint}</T>
      </View>
      <Icon name="chevron" color={colors.ink3} />
    </View>
  );
}
