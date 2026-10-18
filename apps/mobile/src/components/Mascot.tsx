import { mascot as C } from '@drfocus/design-tokens';
import type { MascotPose } from '@drfocus/domain';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Doctor Focus: ajolote con bata, lentes y libreta (diseño del prototipo, 02-owl.jsx).
 * Cinco poses del MVP: bienvenida, pensando, señalando, reorganizar y celebrando.
 */
interface Pose {
  label: string;
  brows: keyof typeof BROWS;
  eyes: 'open' | 'happy';
  mouth: 'smile' | 'hmm' | 'open';
  look: [number, number];
  lw: number;
  rw: number;
  book: 'right' | 'left' | 'none' | 'toss';
  prop?: 'cards' | 'arrow' | 'swap' | 'confetti';
  gills?: 'normal' | 'up';
}

const POSES: Record<MascotPose, Pose> = {
  bienvenida: { label: 'saludando', brows: 'up', eyes: 'open', mouth: 'smile', look: [0, 0], lw: 150, rw: 10, book: 'right' },
  pensando: { label: 'pensando', brows: 'think', eyes: 'open', mouth: 'hmm', look: [3, -3], lw: 8, rw: 140, book: 'left', prop: 'cards' },
  senalando: { label: 'señalando el siguiente paso', brows: 'up', eyes: 'open', mouth: 'smile', look: [4, 0], lw: 8, rw: -96, book: 'left', prop: 'arrow' },
  reorganizar: { label: 'ayudando a reorganizar', brows: 'kind', eyes: 'open', mouth: 'smile', look: [0, 0], lw: 78, rw: -78, book: 'none', prop: 'swap' },
  celebrando: { label: 'celebrando', brows: 'happy', eyes: 'happy', mouth: 'open', gills: 'up', look: [0, 0], lw: 160, rw: -160, book: 'toss', prop: 'confetti' },
};

const AX_HEAD = 'M100 34 C140 34 162 54 162 80 C162 108 136 124 100 124 C64 124 38 108 38 80 C38 54 60 34 100 34 Z';
const AX_BODY = 'M100 104 C130 104 146 126 146 152 C146 174 128 186 100 186 C72 186 54 174 54 152 C54 126 70 104 100 104 Z';
const AX_TAIL = 'M132 166 C152 178 180 180 196 160 C204 148 202 132 194 126 C190 146 170 158 140 150 Z';
const COAT = 'M56 136 C52 162 66 186 100 186 C134 186 148 162 144 136 C136 122 124 116 112 118 L100 146 L88 118 C76 116 64 122 56 136 Z';
const GILL = 'M0 -6 C10 -10 24 -9 34 -3 C38 0 38 2 34 4 C24 9 10 10 0 6 Z';
const GILL_SETS = { normal: [-148, 180, 150], up: [-128, -160, 170] } as const;
const EYES: [number, number][] = [
  [80, 78],
  [120, 78],
];

const BROWS = {
  neutral: ['M68 53 Q79 49 90 52', 'M110 52 Q121 49 132 53'],
  up: ['M67 50 Q78 42 90 47', 'M110 47 Q122 42 133 50'],
  think: ['M67 46 Q78 38 90 44', 'M110 54 Q121 51 132 55'],
  kind: ['M68 55 Q77 48 90 48', 'M110 48 Q123 48 132 55'],
  happy: ['M67 48 Q78 40 90 45', 'M110 45 Q122 40 133 48'],
} as const;

function Gills({ mode = 'normal', thick = false }: { mode?: 'normal' | 'up'; thick?: boolean }) {
  const a = GILL_SETS[mode];
  const bases: [number, number][] = [
    [50, 58],
    [42, 78],
    [48, 98],
  ];
  const one = (x: number, y: number, ang: number, k: string) => (
    <G key={k} transform={`translate(${x} ${y}) rotate(${ang})`}>
      <Path d={GILL} fill={C.sun} stroke={C.sunDark} strokeWidth={thick ? 3.5 : 2.5} strokeLinejoin="round" />
      {!thick && <Path d="M10 -2 l4 -5 M18 -2 l4 -5 M26 -1 l3 -4 M10 2 l4 5 M18 2 l4 5" stroke={C.sunDark} strokeWidth={2} strokeLinecap="round" />}
    </G>
  );
  return (
    <G>
      {bases.map(([x, y], i) => one(x, y, a[i]!, `l${i}`))}
      {bases.map(([x, y], i) => one(200 - x, y, 180 - a[i]!, `r${i}`))}
    </G>
  );
}

function Arm({ side, angle }: { side: 'l' | 'r'; angle: number }) {
  const sx = side === 'l' ? 64 : 136;
  const sy = 128;
  return (
    <G transform={`rotate(${angle} ${sx} ${sy})`}>
      <Path
        d={`M${sx - 11} ${sy} C ${sx - 13} ${sy + 16}, ${sx - 10} ${sy + 26}, ${sx - 8} ${sy + 30} L ${sx + 8} ${sy + 30} C ${sx + 10} ${sy + 26}, ${sx + 13} ${sy + 16}, ${sx + 11} ${sy} C ${sx + 7} ${sy - 7}, ${sx - 7} ${sy - 7}, ${sx - 11} ${sy} Z`}
        fill={C.coat}
        stroke={C.coatLine}
        strokeWidth={2.5}
      />
      <Circle cx={sx} cy={sy + 38} r={9} fill={C.skin} stroke={C.skinDark} strokeWidth={2} />
      <Path d={`M${sx - 10} ${sy + 30} L ${sx + 10} ${sy + 30}`} stroke={C.sun} strokeWidth={4} strokeLinecap="round" />
    </G>
  );
}

function Eye({ cx, cy, kind, look }: { cx: number; cy: number; kind: Pose['eyes']; look: [number, number] }) {
  if (kind === 'happy') return <Path d={`M${cx - 7} ${cy + 3} Q ${cx} ${cy - 6} ${cx + 7} ${cy + 3}`} stroke={C.ink} strokeWidth={4.5} fill="none" strokeLinecap="round" />;
  return (
    <G>
      <Ellipse cx={cx + look[0]} cy={cy + look[1]} rx={5} ry={6} fill={C.ink} />
      <Circle cx={cx + look[0] + 1.8} cy={cy + look[1] - 2.2} r={1.8} fill={C.white} />
    </G>
  );
}

function Mouth({ kind }: { kind: Pose['mouth'] }) {
  if (kind === 'hmm') return <Path d="M84 107 Q100 111 116 104" stroke={C.ink} strokeWidth={4} fill="none" strokeLinecap="round" />;
  if (kind === 'open')
    return (
      <G>
        <Path d="M78 101 Q100 104 122 101 Q118 122 100 122 Q82 122 78 101 Z" fill={C.ink} />
        <Path d="M90 116 Q100 110 110 116 Q106 121 100 121 Q94 121 90 116 Z" fill={C.cheek} />
      </G>
    );
  return <Path d="M74 103 Q100 118 126 103" stroke={C.ink} strokeWidth={4} fill="none" strokeLinecap="round" />;
}

function Notebook({ x, y, rot = 0, s = 1 }: { x: number; y: number; rot?: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <Rect x={-13} y={-17} width={26} height={34} rx={4} fill={C.sun} stroke={C.sunDark} strokeWidth={2.5} />
      <Path d="M-13 -9 h-3 M-13 -1 h-3 M-13 7 h-3" stroke={C.ink} strokeWidth={2.4} strokeLinecap="round" />
      <Rect x={-6} y={-10} width={13} height={6} rx={2} fill={C.white} opacity={0.9} />
    </G>
  );
}

function Head({ p, thick = false }: { p: Pick<Pose, 'brows' | 'eyes' | 'mouth' | 'look' | 'gills'>; thick?: boolean }) {
  const [bl, br] = BROWS[p.brows];
  const sw = thick ? 7 : 5;
  return (
    <G>
      <Gills mode={p.gills} thick={thick} />
      <Path d={AX_HEAD} fill={C.skin} />
      <Path d="M62 112 C78 121 122 121 138 112 C128 120 114 124 100 124 C86 124 72 120 62 112 Z" fill={C.skinDark} opacity={0.35} />
      <Ellipse cx={57} cy={100} rx={8} ry={5} fill={C.cheek} opacity={0.6} />
      <Ellipse cx={143} cy={100} rx={8} ry={5} fill={C.cheek} opacity={0.6} />
      {EYES.map(([x, y]) => (
        <Circle key={`lens${x}`} cx={x} cy={y} r={16} fill={C.lens} />
      ))}
      {EYES.map(([x, y]) => (
        <Eye key={`eye${x}`} cx={x} cy={y} kind={p.eyes} look={p.look} />
      ))}
      {EYES.map(([x, y]) => (
        <Circle key={`rim${x}`} cx={x} cy={y} r={16} fill="none" stroke={C.body} strokeWidth={sw} />
      ))}
      <Path d="M96 75 Q100 71 104 75" stroke={C.body} strokeWidth={sw} fill="none" strokeLinecap="round" />
      <Path d={bl} stroke={C.body} strokeWidth={thick ? 8 : 5} fill="none" strokeLinecap="round" />
      <Path d={br} stroke={C.body} strokeWidth={thick ? 8 : 5} fill="none" strokeLinecap="round" />
      <Mouth kind={p.mouth} />
    </G>
  );
}

export function Mascot({ pose = 'bienvenida', size = 120 }: { pose?: MascotPose; size?: number }) {
  const p = POSES[pose];
  return (
    <Svg viewBox="-16 -6 232 206" width={size} height={size * (206 / 232)} accessibilityRole="image" accessibilityLabel={`Doctor Focus ${p.label}`}>
      <Ellipse cx={108} cy={192} rx={62} ry={6} fill={C.body} opacity={0.14} />
      {p.prop === 'cards' && (
        <G>
          <G transform="rotate(-8 12 12)">
            <Rect x={-8} y={0} width={40} height={24} rx={6} fill={C.white} stroke={C.discLine} strokeWidth={3} />
            <Path d="M0 12 l5 5 l9 -10" stroke={C.body} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </G>
          <G transform="rotate(5 16 38)">
            <Rect x={-2} y={28} width={36} height={20} rx={6} fill={C.disc} stroke={C.discLine} strokeWidth={2} />
            <Path d="M6 38 h18" stroke={C.body} strokeWidth={3.5} strokeLinecap="round" />
          </G>
        </G>
      )}
      <Path d={AX_TAIL} fill={C.skin} stroke={C.skinDark} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M150 158 C168 162 184 156 192 140" stroke={C.belly} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.8} />
      <Ellipse cx={84} cy={185} rx={12} ry={6} fill={C.skinDark} />
      <Ellipse cx={116} cy={185} rx={12} ry={6} fill={C.skinDark} />
      <Path d={AX_BODY} fill={C.skin} />
      <Path d={COAT} fill={C.coat} />
      <Path d="M88 118 L100 146 L112 118 Z" fill={C.belly} />
      <Path d="M88 118 L96 136 M112 118 L104 136" stroke={C.coatLine} strokeWidth={3} strokeLinecap="round" />
      <Path d="M90 121 C82 142 96 160 116 156" stroke={C.body} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Circle cx={119} cy={155} r={6} fill={C.sun} stroke={C.sunDark} strokeWidth={2.5} />
      <Circle cx={100} cy={166} r={3.4} fill={C.body} />
      <Circle cx={100} cy={177} r={3.4} fill={C.body} />
      <Rect x={68} y={152} width={18} height={13} rx={3} fill="none" stroke={C.coatLine} strokeWidth={3} />
      <Rect x={73} y={143} width={5} height={14} rx={2.5} fill={C.sun} />
      <Head p={p} />
      {p.book === 'right' && <Notebook x={146} y={162} rot={12} />}
      {p.book === 'left' && <Notebook x={54} y={162} rot={-12} />}
      <Arm side="l" angle={p.lw} />
      <Arm side="r" angle={p.rw} />
      {p.prop === 'arrow' && <Path d="M196 106 l14 12 l-14 12" stroke={C.sun} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {p.prop === 'swap' && (
        <G>
          <G transform="translate(8 132) rotate(-10)">
            <Rect x={-20} y={-15} width={40} height={30} rx={7} fill={C.white} stroke={C.discLine} strokeWidth={3} />
            <Path d="M-11 -3 h22 M-11 6 h14" stroke={C.body} strokeWidth={3.5} strokeLinecap="round" />
          </G>
          <G transform="translate(192 132) rotate(10)">
            <Rect x={-20} y={-15} width={40} height={30} rx={7} fill={C.sun} stroke={C.sunDark} strokeWidth={3} />
            <Path d="M-11 -3 h22 M-11 6 h14" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" />
          </G>
          <Path d="M8 104 Q100 -92 192 104" stroke={C.discLine} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray="2 9" />
          <Path d="M186 88 l7 14 l-15 0" stroke={C.discLine} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </G>
      )}
      {p.prop === 'confetti' && (
        <G>
          <Rect x={14} y={2} width={9} height={15} rx={2} fill={C.sun} transform="rotate(-25 18 9)" />
          <Rect x={182} y={40} width={9} height={15} rx={2} fill={C.discLine} transform="rotate(30 186 47)" />
          <Circle cx={26} cy={140} r={4.5} fill={C.discLine} />
          <Circle cx={176} cy={6} r={4.5} fill={C.sun} />
          <Path d="M196 100 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z" fill={C.sun} />
          <Path d="M0 64 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z" fill={C.sun} />
          <Notebook x={100} y={4} rot={-18} s={0.7} />
        </G>
      )}
    </Svg>
  );
}

/** Avatar circular para 24–64 px. */
export function MascotAvatar({ size = 40 }: { size?: number }) {
  const p = { brows: 'neutral' as const, eyes: 'open' as const, mouth: 'smile' as const, look: [0, 0] as [number, number] };
  return (
    <Svg viewBox="16 6 168 168" width={size} height={size} accessibilityRole="image" accessibilityLabel="Doctor Focus">
      <Defs>
        <ClipPath id="avatar-clip">
          <Circle cx={100} cy={90} r={84} />
        </ClipPath>
      </Defs>
      <Circle cx={100} cy={90} r={84} fill={C.disc} />
      <G clipPath="url(#avatar-clip)">
        <Path d={AX_BODY} fill={C.skin} />
        <Path d={COAT} fill={C.coat} />
        <Head p={p} thick={size < 36} />
      </G>
    </Svg>
  );
}
