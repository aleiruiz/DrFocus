import { colors, radius, space } from '@drfocus/design-tokens';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { T } from './ui';

/** Hoja inferior simple basada en Modal (accesible y sin dependencias extra). */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
      <KeyboardAvoidingView behavior="height" style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.head}>
            <T v="h3" style={{ flex: 1 }} accessibilityRole="header">
              {title}
            </T>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.close}>
              <Icon name="close" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,53,60,0.4)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, paddingTop: space.sm, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
