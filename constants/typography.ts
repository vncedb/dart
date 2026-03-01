import { TextStyle } from 'react-native';

export const FontFamily = {
  regular:   'Nunito_400Regular',
  medium:    'Nunito_500Medium',
  semibold:  'Nunito_600SemiBold',
  bold:      'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black:     'Nunito_900Black',
} as const;

export const Typography = {
  display: {
    fontFamily: FontFamily.extrabold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.0,
  } as TextStyle,

  h1: {
    fontFamily: FontFamily.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  } as TextStyle,

  h3: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
  } as TextStyle,

  h4: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
  } as TextStyle,

  body: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  } as TextStyle,

  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  } as TextStyle,

  bodySemibold: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  } as TextStyle,

  small: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  } as TextStyle,

  smallMedium: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  } as TextStyle,

  caption: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  } as TextStyle,

  label: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as TextStyle,

  micro: {
    fontFamily: FontFamily.semibold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
  } as TextStyle,

  button: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  } as TextStyle,

  buttonSmall: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  } as TextStyle,

  tabular: {
    fontVariant: ['tabular-nums'],
  } as TextStyle,
} as const;
