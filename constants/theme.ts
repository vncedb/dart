import { useColorScheme } from 'nativewind';

/**
 * Modern Theme Configuration
 * "Professional Tech" Theme
 */

const palette = {
  // Brand / Professional Colors
  indigo600: '#4f46e5',
  indigo500: '#6366f1',
  violet500: '#8b5cf6',
  
  // Dark Mode Accents
  orange500: '#f97316',
  orange600: '#ea580c',

  // Grayscale (Clean & Neutral)
  slate50: '#f8fafc',  // Ultra light gray (almost white)
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',
  
  white: '#ffffff',
  red: '#ef4444',
  green: '#10b981', // Emerald green (more professional than lime)
  
  glassLight: 'rgba(255, 255, 255, 0.9)',
  glassDark: 'rgba(15, 23, 42, 0.9)',
};

export const AppTheme = {
  light: {
    dark: false,
    colors: {
      primary: palette.indigo600,
      primaryLight: '#e0e7ff',
      background: palette.slate50, // Plain, clean background
      card: palette.white,
      text: palette.slate900,
      textSecondary: palette.slate500,
      border: palette.slate200,
      icon: palette.slate400,
      iconBg: palette.slate100,
      accent: palette.indigo500,
      success: palette.green,
      successLight: 'rgba(16, 185, 129, 0.1)',
      warning: palette.orange500,
      warningLight: 'rgba(249, 115, 22, 0.1)',
      danger: palette.red,
      dangerLight: 'rgba(239, 68, 68, 0.1)',
      glass: palette.glassLight,
      surface: palette.white,
      
      // DYNAMIC HEADER (Professional Gradient)
      headerStart: palette.indigo600, 
      headerEnd: palette.violet500,   
      headerText: '#ffffff',          // High contrast white text
      headerBorder: 'rgba(255,255,255,0.1)',

      // DEPRECATED: Gradients removed for plain background preference
      bgGradientStart: palette.slate50, 
      bgGradientEnd: palette.slate50,   
      
      bioIdle: '#e0e7ff',
      bioActive: palette.indigo600,
      bioDanger: palette.red,
      bioDangerSoft: 'rgba(239, 68, 68, 0.1)',
    }
  },
  dark: {
    dark: true,
    colors: {
      primary: palette.orange500,
      primaryLight: 'rgba(249, 115, 22, 0.15)',
      background: palette.slate950, // Deep midnight
      card: palette.slate900,
      text: palette.white,
      textSecondary: palette.slate400,
      border: palette.slate800,
      icon: palette.slate500,
      iconBg: palette.slate800,
      accent: palette.orange500,
      success: palette.green,
      successLight: 'rgba(16, 185, 129, 0.2)',
      warning: palette.orange500,
      warningLight: 'rgba(249, 115, 22, 0.2)',
      danger: palette.red,
      dangerLight: 'rgba(239, 68, 68, 0.2)',
      glass: palette.glassDark,
      surface: palette.slate800,

      // DYNAMIC HEADER (Sleek Dark)
      headerStart: palette.slate800, 
      headerEnd: palette.slate900, 
      headerText: '#ffffff',
      headerBorder: 'rgba(255,255,255,0.1)',

      bgGradientStart: palette.slate950, 
      bgGradientEnd: palette.slate950,   

      bioIdle: palette.slate800,
      bioActive: palette.orange500,
      bioDanger: palette.red,
      bioDangerSoft: 'rgba(239, 68, 68, 0.15)',
    }
  },
};

export type Theme = typeof AppTheme.light;

export function useAppTheme(): Theme {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? AppTheme.dark : AppTheme.light;
}