import { FingerPrintIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useAppTheme } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BiometricButtonProps {
  onSuccess: () => void;
  isClockedIn: boolean;
  isLoading: boolean;
  settings?: any;
}

const HOLD_DURATION_MS = 850;

export default function BiometricButton({ onSuccess, isClockedIn, isLoading, settings }: BiometricButtonProps) {
  const theme = useAppTheme();
  const progress = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.25);
  const completedRef = useRef(false);

  const SIZE = 126;
  const STROKE_WIDTH = 7;
  const RADIUS = SIZE / 2;
  const CIRCLE_RADIUS = (SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  const accentColor = isClockedIn ? theme.colors.danger : theme.colors.primary;

  const gradientStops = useMemo(
    () => (theme.dark ? [theme.colors.card, '#0f172a'] : ['#ffffff', '#f8fafc']),
    [theme.colors.card, theme.dark]
  );

  const safeHaptic = async (type: 'impact' | 'notification') => {
    if (settings?.vibrationEnabled === false) return;
    try {
      if (type === 'impact') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (type === 'notification') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // ignored intentionally
    }
  };

  const stopIdleAnimation = useCallback(() => {
    cancelAnimation(pulseScale);
    cancelAnimation(glowOpacity);
    pulseScale.value = 1;
    glowOpacity.value = 0.25;
  }, [glowOpacity, pulseScale]);

  const startIdleAnimation = useCallback(() => {
    stopIdleAnimation();
    if (isLoading) return;

    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1300 }),
        withTiming(1, { duration: 1300 })
      ),
      -1,
      true
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 1300 }),
        withTiming(0.2, { duration: 1300 })
      ),
      -1,
      true
    );
  }, [glowOpacity, isLoading, pulseScale, stopIdleAnimation]);

  const resetHoldState = useCallback((restartIdle = !isLoading) => {
    completedRef.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    pressScale.value = withSpring(1, { damping: 14, stiffness: 220 });

    if (restartIdle) {
      startIdleAnimation();
    } else {
      stopIdleAnimation();
    }
  }, [isLoading, pressScale, progress, startIdleAnimation, stopIdleAnimation]);

  useEffect(() => {
    resetHoldState(!isLoading);

    return () => {
      cancelAnimation(progress);
      cancelAnimation(pressScale);
      stopIdleAnimation();
    };
  }, [isClockedIn, isLoading, pressScale, progress, resetHoldState, stopIdleAnimation]);

  const handleAnimationComplete = (finished: boolean) => {
    if (!finished || isLoading) return;
    completedRef.current = true;
    safeHaptic('notification');
    onSuccess();
  };

  const handlePressIn = () => {
    if (isLoading) return;

    completedRef.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    stopIdleAnimation();

    pressScale.value = withSpring(0.96, { damping: 14, stiffness: 220 });
    safeHaptic('impact');

    progress.value = withTiming(1, { duration: HOLD_DURATION_MS, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(handleAnimationComplete)(true);
      }
    });
  };

  const handlePressOut = () => {
    cancelAnimation(progress);
    pressScale.value = withSpring(1, { damping: 14, stiffness: 220 });
    progress.value = withTiming(0, { duration: completedRef.current ? 120 : 180 });
    completedRef.current = false;
    startIdleAnimation();
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={styles.wrapper}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={isLoading}>
        <Animated.View style={[styles.container, { width: SIZE, height: SIZE }, containerStyle]}>
          <Animated.View style={[styles.glow, { backgroundColor: accentColor }, glowStyle]} />

          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="bioBtnGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={gradientStops[0]} stopOpacity="1" />
                <Stop offset="1" stopColor={gradientStops[1]} stopOpacity="1" />
              </LinearGradient>
            </Defs>

            <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="url(#bioBtnGrad)" />

            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={theme.colors.border}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              opacity={0.5}
            />

            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={CIRCLE_RADIUS}
              stroke={accentColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeLinecap="round"
              animatedProps={progressProps}
              rotation="-90"
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </Svg>

          <View style={styles.iconContainer}>
            <HugeiconsIcon icon={FingerPrintIcon} size={52} color={accentColor} />
          </View>
        </Animated.View>
      </Pressable>

      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {isLoading ? 'Processing...' : isClockedIn ? 'Hold To Time Out' : 'Hold To Time In'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  iconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 20,
    fontSize: 12,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
