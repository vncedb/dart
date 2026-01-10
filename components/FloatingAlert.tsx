import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Login03Icon,
  Logout03Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  SlideInUp,
  SlideOutUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../constants/theme';

type AlertType = 'success' | 'error' | 'check-in' | 'check-out' | 'info';

interface FloatingAlertProps {
  visible: boolean;
  message: string;
  type?: AlertType;
  onHide: () => void;
}

const FloatingAlert = ({ visible, message, type = 'success', onHide }: FloatingAlertProps) => {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  
  // Animation Values
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      // Reset state when shown
      translateY.value = 0;
      opacity.value = 1;
      
      const timer = setTimeout(onHide, 4000); 
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // --- Theme & Config ---
  const getConfig = () => {
    switch (type) {
      case 'error': 
        return { icon: AlertCircleIcon, color: theme.colors.danger, bg: theme.colors.dangerLight };
      case 'check-in': 
        return { icon: Login03Icon, color: theme.colors.success, bg: theme.colors.successLight };
      case 'check-out': 
        return { icon: Logout03Icon, color: theme.colors.warning, bg: theme.colors.warningLight };
      case 'info':
        return { icon: InformationCircleIcon, color: theme.colors.primary, bg: theme.colors.primaryLight };
      case 'success':
      default: 
        return { icon: CheckmarkCircle02Icon, color: theme.colors.success, bg: theme.colors.successLight };
    }
  };

  const config = getConfig();

  // --- Gestures (Swipe Up to Dismiss) ---
  const panGesture = Gesture.Pan()
    .onChange((event) => {
      // Only allow dragging UP (negative Y) to dismiss
      if (event.translationY < 0) {
        translateY.value = event.translationY;
        opacity.value = 1 - Math.abs(event.translationY) / 100; // Fade out slightly
      }
    })
    .onEnd((event) => {
      if (event.translationY < -20) {
        // Dismiss threshold reached
        runOnJS(onHide)();
      } else {
        // Spring back if not enough swipe
        translateY.value = withSpring(0);
        opacity.value = withTiming(1);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        // Gentle Entry Animation
        entering={SlideInUp.springify().damping(20).stiffness(150)}
        exiting={SlideOutUp.duration(300)}
        style={[
          styles.container, 
          animatedStyle,
          { 
            // Positioned nicely below status bar/header
            top: Platform.OS === 'ios' ? insets.top + 10 : 50,
            backgroundColor: theme.colors.card, 
            borderColor: theme.colors.border,
            // Dynamic Shadow
            shadowColor: theme.dark ? "#000" : config.color,
          }
        ]}
      >
        {/* Accent Bar (Left) */}
        <View style={[styles.accentBar, { backgroundColor: config.color }]} />

        {/* Content */}
        <View style={styles.contentRow}>
            {/* Icon Circle */}
            <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
                <HugeiconsIcon icon={config.icon} size={20} color={config.color} variant="solid" />
            </View>

            {/* Text */}
            <Text style={[styles.text, { color: theme.colors.text }]} numberOfLines={2}>
                {message}
            </Text>
        </View>

      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9999,
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden', // Clips the accent bar
    // Premium Shadow
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingLeft: 20, // Extra padding for accent bar
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  text: {
    flex: 1,
    fontFamily: 'Nunito_700Bold', 
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
});

export default FloatingAlert;