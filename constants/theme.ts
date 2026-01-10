import { useColorScheme } from 'nativewind';

/**
 * Modern Theme Configuration
 */

const palette = {
  // Brand Colors
  brandOrange: '#E19639',
  brandOrangeDark: '#9a5f1c',
  brandOrangeSoft: 'rgba(225, 150, 57, 0.15)',
  
  indigo: '#6366f1',
  indigoDark: '#4338ca',
  indigoSoft: '#e0e7ff',

  // Grayscale
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',
  
  white: '#ffffff',
  black: '#000000',
  red: '#ef4444',
  redSoft: 'rgba(239, 68, 68, 0.15)',
  green: '#22c55e',
  successLight: 'rgba(34, 197, 94, 0.15)', // Added for badges
  orange: '#f97316',
  warningLight: 'rgba(249, 115, 22, 0.15)', // Added for badges
  
  glassLight: 'rgba(255, 255, 255, 0.85)',
  glassDark: 'rgba(15, 23, 42, 0.85)',
};

export const AppTheme = {
  light: {
    dark: false,
    colors: {
      primary: palette.indigo,      
      primaryLight: palette.indigoSoft,
      background: palette.slate50,
      card: palette.white,
      text: palette.slate900,
      textSecondary: palette.slate500,
      border: palette.slate200,
      icon: palette.slate400,
      iconBg: palette.slate100,
      accent: palette.indigo,
      success: palette.green,
      successLight: palette.successLight,
      warning: palette.orange,
      warningLight: palette.warningLight,
      danger: palette.red,
      dangerLight: palette.redSoft,
      glass: palette.glassLight,
      surface: palette.white,
      
      headerStart: '#8b5cf6', 
      headerEnd: '#4f46e5',
      headerText: '#ffffff',
      headerBorder: 'rgba(255,255,255,0.2)',

      bgGradientStart: '#f8fafc', 
      bgGradientEnd: '#eef2ff',   
      
      bioIdle: palette.indigoSoft,
      bioActive: palette.indigo,
      bioDanger: palette.red,
      bioDangerSoft: palette.redSoft,
    }
  },
  dark: {
    dark: true,
    colors: {
      primary: palette.brandOrange,
      primaryLight: palette.brandOrangeSoft,
      background: palette.slate950,
      card: palette.slate900,
      text: palette.white,
      textSecondary: palette.slate400,
      border: palette.slate800,
      icon: palette.slate500,
      iconBg: palette.slate800,
      accent: palette.brandOrange,
      success: palette.green,
      successLight: 'rgba(34, 197, 94, 0.25)',
      warning: palette.orange,
      warningLight: 'rgba(249, 115, 22, 0.25)',
      danger: palette.red,
      dangerLight: 'rgba(239, 68, 68, 0.25)',
      glass: palette.glassDark,
      surface: palette.slate800,

      headerStart: palette.brandOrange, 
      headerEnd: palette.brandOrangeDark, 
      headerText: '#ffffff', 
      headerBorder: 'rgba(255,255,255,0.1)',

      bgGradientStart: '#0f172a', 
      bgGradientEnd: '#020617',   

      bioIdle: palette.slate800,
      bioActive: palette.brandOrange,
      bioDanger: palette.red,
      bioDangerSoft: palette.redSoft,
    }
  },
};

export type Theme = typeof AppTheme.light;

export function useAppTheme(): Theme {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? AppTheme.dark : AppTheme.light;
}