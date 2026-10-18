import { colors, radius, space } from '@drfocus/design-tokens';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { Mascot } from './Mascot';
import { T } from './ui';

/** Celebración breve al completar (sin pantalla aparte). Respeta «reducir movimiento». */
export function Celebration({ message, onDone }: { message: string | null; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!message) return;
    AccessibilityInfo.announceForAccessibility(message);
    scale.setValue(reduce ? 1 : 0.6);
    opacity.setValue(reduce ? 1 : 0);
    const anim = reduce
      ? Animated.delay(1400)
      : Animated.sequence([
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
          ]),
          Animated.delay(1100),
          Animated.timing(opacity, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]);
    anim.start(() => onDone());
  }, [message, reduce, onDone, opacity, scale]);

  if (!message) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.box, { opacity, transform: [{ scale }] }]}>
        <Mascot pose="celebrando" size={150} />
        <T v="h2" style={{ textAlign: 'center' }}>
          {message}
        </T>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', alignSelf: 'center', top: '28%', backgroundColor: colors.card, borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.sm, borderWidth: 2, borderColor: colors.sun, elevation: 6 },
});
