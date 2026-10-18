import { colors, radius, space } from '@drfocus/design-tokens';
import type { MascotPose } from '@drfocus/domain';
import { View } from 'react-native';
import { Mascot } from './Mascot';
import { T } from './ui';

export function MascotBubble({ pose, text, size = 96 }: { pose: MascotPose; text: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Mascot pose={pose} size={size} />
      <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.md }}>
        <T>{text}</T>
      </View>
    </View>
  );
}
