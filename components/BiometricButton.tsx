import { FingerPrintIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
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
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '../constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BiometricButtonProps {
  onSuccess: () => void;
  isClockedIn: boolean;
  isLoading: boolean;
  settings?: any;
}

export default function BiometricButton({ onSuccess, isClockedIn, isLoading }: BiometricButtonProps) {
  const theme = useAppTheme();
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);
  
  const [isCompleted, setIsCompleted] = useState(false);

  // --- DIMENSIONS ---
  const SIZE = 120;
  const STROKE_WIDTH = 6;
  const RADIUS = SIZE / 2;
  const CIRCLE_RADIUS = (SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

  useEffect(() => {
    startPulse();
  }, []);

  const startPulse = () => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1500 }), withTiming(1, { duration: 1500 })),
      -1,
      true
    );
  };

  const safeHaptic = async (type: 'impact' | 'notification') => {
    try {
      if (type === 'impact') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (type === 'notification') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}
  };

  const handleAnimationComplete = (finished: boolean) => {
    if (finished) {
      setIsCompleted(true);
      safeHaptic('notification');
      onSuccess();
    }
  };

  const handlePressIn = () => {
    if (isLoading) return;
    setIsCompleted(false);
    
    cancelAnimation(pulse); 
    scale.value = withSpring(0.95);
    safeHaptic('impact');

    progress.value = withTiming(1, { duration: 1000, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished) runOnJS(handleAnimationComplete)(true);
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    startPulse();
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 200 });
  };

  // Shadow Scale
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isCompleted ? 1 : Math.max(scale.value, pulse.value) }] 
  }));

  // Ring Progress
  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={styles.wrapper}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        {/* We use SVG for the shape to guarantee perfect circle on Android, avoiding "octagon" glitch from elevation + borderRadius */}
        <Animated.View style={[styles.container, { width: SIZE, height: SIZE }, containerStyle]}>
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                {/* 1. Background Fill Circle */}
                <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} fill={theme.colors.card} />
                
                {/* 2. Passive Track Ring */}
                <Circle 
                    cx={SIZE/2} cy={SIZE/2} r={CIRCLE_RADIUS} 
                    stroke={theme.colors.border} 
                    strokeWidth={STROKE_WIDTH} 
                    fill="none" 
                />
                
                {/* 3. Active Progress Ring */}
                <AnimatedCircle
                    cx={SIZE/2} cy={SIZE/2} r={CIRCLE_RADIUS}
                    stroke={isClockedIn ? theme.colors.danger : theme.colors.primary}
                    strokeWidth={STROKE_WIDTH}
                    fill="none"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeLinecap="round"
                    animatedProps={progressProps}
                    rotation="-90"
                    origin={`${SIZE/2}, ${SIZE/2}`}
                />
            </Svg>

            <View style={styles.iconContainer}>
                 <HugeiconsIcon 
                    icon={FingerPrintIcon} 
                    size={52} 
                    color={isClockedIn ? theme.colors.danger : theme.colors.primary} 
                 />
            </View>
        </Animated.View>
      </Pressable>
      
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {isLoading ? "Processing..." : isClockedIn ? "Hold to Time Out" : "Hold to Check In"}
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
    // Removing native shadow here to avoid artifacts. 
    // If shadow is needed, it should be a separate SVG layer below this.
  },
  iconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 20,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  }
});