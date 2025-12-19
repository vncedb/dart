import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Login03Icon,
  Logout03Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SlideInUp,
  SlideOutUp
} from 'react-native-reanimated';

type AlertType = 'success' | 'error' | 'check-in' | 'check-out';

interface FloatingAlertProps {
  visible: boolean;
  message: string;
  type?: AlertType;
  onHide: () => void;
}

const FloatingAlert = ({ visible, message, type = 'success', onHide }: FloatingAlertProps) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  // Configuration based on type
  const config = {
    'success': { icon: CheckmarkCircle02Icon, color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
    'error': { icon: AlertCircleIcon, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
    'check-in': { icon: Login03Icon, color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
    'check-out': { icon: Logout03Icon, color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  }[type];

  return (
    <Animated.View
      entering={SlideInUp.duration(400).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutUp.duration(300).easing(Easing.in(Easing.cubic))}
      style={[styles.container, { 
        backgroundColor: config.bg, 
        borderColor: config.border 
      }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: config.color }]}>
        <HugeiconsIcon icon={config.icon} size={20} color="#ffffff" strokeWidth={2.5} />
      </View>
      <Text style={[styles.text, { color: '#1e293b' }]}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 99, // Pill shape
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minWidth: '85%',
    maxWidth: '92%',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  text: {
    flex: 1,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

export default FloatingAlert;