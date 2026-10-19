import { colors, fonts, minTouch, radius, space, type as typo } from '@drfocus/design-tokens';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Variant = keyof typeof typo;

export function T({ v = 'body', color, style, ...rest }: TextProps & { v?: Variant; color?: string }) {
  return <Text {...rest} style={[typo[v], { color: color ?? colors.ink }, style]} maxFontSizeMultiplier={1.6} />;
}

export function Screen({ children, scroll = true, footer, padded = true }: { children: ReactNode; scroll?: boolean; footer?: ReactNode; padded?: boolean }) {
  const body = padded ? <View style={styles.pad}>{children}</View> : children;
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

type ButtonKind = 'primary' | 'sun' | 'soft' | 'ghost' | 'text' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  icon,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const k = BUTTON[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, k.box, (disabled || loading) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }, style]}
    >
      {loading ? <ActivityIndicator color={k.text} /> : icon}
      <Text style={[typo.bodyBold, { color: k.text, textAlign: 'center' }, kind === 'text' && { textDecorationLine: 'underline' }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </Pressable>
  );
}

const BUTTON: Record<ButtonKind, { box: ViewStyle; text: string }> = {
  primary: { box: { backgroundColor: colors.petrol }, text: colors.white },
  sun: { box: { backgroundColor: colors.sun, borderBottomWidth: 3, borderBottomColor: colors.sunDark }, text: colors.ink },
  soft: { box: { backgroundColor: colors.turq100 }, text: colors.petrol900 },
  ghost: { box: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.line }, text: colors.petrol },
  text: { box: { backgroundColor: 'transparent', minHeight: minTouch, paddingHorizontal: space.sm }, text: colors.petrol },
  danger: { box: { backgroundColor: colors.badBg }, text: colors.bad },
};

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.turq50 }, style]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.petrol, borderColor: colors.petrol }]}
    >
      <Text style={[typo.small, { color: selected ? colors.white : colors.ink, fontFamily: fonts.bodyBold }]} maxFontSizeMultiplier={1.5}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

/** Barra de progreso que también se entiende sin color: muestra el conteo en texto. */
export function ProgressBar({ done, total, label }: { done: number; total: number; label?: string }) {
  const ratio = total ? done / total : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`${label ?? 'Progreso'}: ${done} de ${total} objetivos`} accessibilityValue={{ min: 0, max: total, now: done }}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
      <T v="small" color={colors.ink2} style={{ marginTop: 4 }}>
        {done} de {total} objetivos
      </T>
    </View>
  );
}

export function Field({ label, help, error, style, ...props }: TextInputProps & { label: string; help?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="bodyBold">{label}</T>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={help}
        placeholderTextColor={colors.ink3}
        maxFontSizeMultiplier={1.6}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }, error ? { borderColor: colors.bad } : null, style]}
      />
      {help ? <T v="small" color={colors.ink2}>{help}</T> : null}
      {error ? <T v="small" color={colors.bad} accessibilityLiveRegion="polite">{error}</T> : null}
    </View>
  );
}

export function Banner({ kind = 'info', title, children }: { kind?: 'info' | 'warn' | 'error' | 'ok'; title?: string; children?: ReactNode }) {
  const bg = { info: colors.turq50, warn: colors.warnBg, error: colors.badBg, ok: colors.okBg }[kind];
  const fg = { info: colors.petrol900, warn: colors.sunInk, error: colors.bad, ok: colors.ok }[kind];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      {title ? <T v="bodyBold" color={fg}>{title}</T> : null}
      {typeof children === 'string' ? <T v="small" color={fg}>{children}</T> : children}
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: space.sm }}>
        <T v="eyebrow" color={colors.ink3} accessibilityRole="header">{title}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Stepper({ value, onChange, step = 5, min, max, suffix, label }: { value: number; onChange: (n: number) => void; step?: number; min: number; max: number; suffix: string; label: string }) {
  return (
    <Row gap={space.sm}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Menos ${label}`} onPress={() => onChange(Math.max(min, value - step))} style={styles.stepBtn}>
        <T v="h3">−</T>
      </Pressable>
      <T v="bodyBold" style={{ minWidth: 72, textAlign: 'center' }} accessibilityLabel={`${label}: ${value} ${suffix}`}>
        {value} {suffix}
      </T>
      <Pressable accessibilityRole="button" accessibilityLabel={`Más ${label}`} onPress={() => onChange(Math.min(max, value + step))} style={styles.stepBtn}>
        <T v="h3">+</T>
      </Pressable>
    </Row>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: space.xxl },
  pad: { padding: space.lg, gap: space.lg },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg },
  btn: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.sm },
  chip: { minHeight: minTouch, paddingHorizontal: space.lg, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center' },
  barTrack: { height: 12, borderRadius: 6, backgroundColor: colors.turq100, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 6, backgroundColor: colors.turq },
  input: { minHeight: minTouch + 4, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: space.md, ...typo.body, color: colors.ink },
  banner: { borderRadius: radius.md, padding: space.md, gap: 4 },
  stepBtn: { width: minTouch, height: minTouch, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
});
