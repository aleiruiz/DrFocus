import { colors, minTouch, radius, space } from '@drfocus/design-tokens';
import { Pressable, Switch, View } from 'react-native';
import { Icon } from '../Icon';
import { T } from '../ui';

/** Fila con interruptor y descripción, usada en Ajustes. */
export function SwitchRow({ label, help, value, onChange, disabled }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: minTouch }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold">{label}</T>
        {help ? <T v="small" color={colors.ink2}>{help}</T> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.line, true: colors.turq }}
        thumbColor={value ? colors.petrol : colors.card}
      />
    </View>
  );
}

/** Casilla de verificación con texto; se entiende sin color porque muestra la palomita. */
export function CheckRow({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={help}
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: minTouch, paddingVertical: space.xs }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.sm,
          borderWidth: 2,
          borderColor: value ? colors.petrol : colors.line,
          backgroundColor: value ? colors.petrol : colors.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value ? <Icon name="check" size={20} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold">{label}</T>
        {help ? <T v="small" color={colors.ink2}>{help}</T> : null}
      </View>
    </Pressable>
  );
}

/** Fila que abre otra pantalla. */
export function LinkRow({ label, detail, onPress }: { label: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: minTouch }, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyBold">{label}</T>
        {detail ? <T v="small" color={colors.ink2}>{detail}</T> : null}
      </View>
      <Icon name="chevron" color={colors.ink3} />
    </Pressable>
  );
}
