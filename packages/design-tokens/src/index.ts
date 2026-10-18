/** Identidad visual de Doctor Focus, tomada del prototipo (azul petróleo/turquesa y amarillo). */
export const colors = {
  petrol900: '#08353C',
  petrol: '#0F5C66',
  petrol600: '#157080',
  turq: '#1FA39C',
  turq300: '#7FD8D0',
  turq100: '#D5F3EF',
  turq50: '#ECF8F6',
  sun: '#F6C445',
  sun100: '#FFF3CC',
  sunInk: '#6B4800',
  sunDark: '#D9A21F',
  ink: '#10292E',
  ink2: '#3E5A61',
  ink3: '#5F777D',
  line: '#D3E3E5',
  bg: '#F5FAFA',
  card: '#FFFFFF',
  ok: '#17804F',
  okBg: '#E1F4EA',
  bad: '#B02A20',
  badBg: '#FCE6E3',
  warnBg: '#FFF3CC',
  white: '#FFFFFF',
} as const;

export const mascot = {
  skin: '#45BCB0',
  skinDark: '#2C978C',
  belly: '#D9F3EE',
  body: '#0F5C66',
  disc: '#E4F5F2',
  discLine: '#B9E3DD',
  lens: '#E9F8F5',
  cheek: '#F29C8B',
  coat: '#FFFFFF',
  coatLine: '#CFE3E5',
  sun: '#F6C445',
  sunDark: '#D9A21F',
  ink: '#11303A',
  white: '#FFFFFF',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  display: 'Baloo2_800ExtraBold',
  displayBold: 'Baloo2_700Bold',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
} as const;

export const type = {
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  h3: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' as const },
} as const;

/** Área táctil mínima (TECH_SPEC §3). */
export const minTouch = 48;
