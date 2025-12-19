/**
 * This file is located in app/constants/Colors.ts
 * Expo Router treats files in app/ as routes, so we must export a default component
 * to suppress the "missing required default export" warning.
 */

// Dummy component to satisfy Expo Router
export default function ColorsRoute() {
  return null;
}

// Actual Constants
export const Colors = {
  primary: '#4f46e5',
  secondary: '#64748b',
  background: '#F1F5F9',
  white: '#FFFFFF',
  text: '#0f172a',
  light: {
    text: '#0f172a',
    background: '#fff',
    tint: '#4f46e5',
    icon: '#64748b',
    tabIconDefault: '#64748b',
    tabIconSelected: '#4f46e5',
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: '#fff',
    icon: '#9ba1a6',
    tabIconDefault: '#9ba1a6',
    tabIconSelected: '#fff',
  },
};