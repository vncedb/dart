import { FingerPrintIcon } from '@hugeicons/core-free-icons'; // Removed Logout03Icon
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface BiometricButtonProps {
  onSuccess: () => void;
  isClockedIn: boolean;
  isLoading: boolean;
  settings?: any;
}

export default function BiometricButton({ onSuccess, isClockedIn, isLoading }: BiometricButtonProps) {
  // Shared Values for Animation
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);
  
  // State to track completion status
  const [isCompleted, setIsCompleted] = useState(false);

  // --- DIMENSIONS ---
  const SIZE = 100;
  const BORDER_WIDTH = 4; 
  const TRACK_WIDTH = 4;  
  const RADIUS = (SIZE - BORDER_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // --- IDLE PULSE ANIMATION ---
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

  // --- HAPTICS HELPER ---
  const safeHaptic = async (type: 'impact' | 'notification') => {
    try {
      if (type === 'impact') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (type === 'notification') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // Ignore
    }
  };

  // --- COMPLETION HANDLER ---
  const handleAnimationComplete = (finished: boolean) => {
    if (finished) {
      setIsCompleted(true);
      safeHaptic('notification');
      onSuccess();
    }
  };

  // --- PRESS HANDLERS ---
  const handlePressIn = () => {
    if (isLoading) return;
    setIsCompleted(false);
    
    cancelAnimation(pulse); 
    scale.value = withSpring(0.95);
    safeHaptic('impact');

    progress.value = withTiming(1, { duration: 1200, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(handleAnimationComplete)(true);
      }
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    startPulse();

    if (isCompleted) {
      progress.value = withTiming(0, { duration: 500 });
      setIsCompleted(false);
    } else {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 200 });
    }
  };

  // --- ANIMATED STYLES ---
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isCompleted ? 1 : Math.max(scale.value, pulse.value) }] 
  }));

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const fillStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
        progress.value,
        [0, 1],
        // Swaps color based on clocked in status (Red for Out, Indigo for In)
        [isClockedIn ? '#fee2e2' : '#e0e7ff', isClockedIn ? '#ef4444' : '#6366f1']
    );
    return { backgroundColor };
  });

  // Helper to determine icon color based on state and progress
  const getIconColor = () => {
     // If animation is filling (progress > 0.1), make icon white
     if (progress.value > 0.1) return "white";
     // Otherwise use Red for Check Out, Indigo for Check In
     return isClockedIn ? "#ef4444" : "#6366f1";
  };

  return (
    <View style={styles.wrapper}>
      <Pressable 
        onPressIn={handlePressIn} 
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.buttonContainer, { width: SIZE, height: SIZE, borderRadius: SIZE / 2 }, containerStyle, fillStyle]}>
            
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                {/* 1. White Border */}
                <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke="white" strokeWidth={BORDER_WIDTH} fill="none" />

                {/* 2. Track */}
                <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke="white" strokeWidth={TRACK_WIDTH} strokeOpacity={0.3} fill="none" />
                
                {/* 3. Progress */}
                <AnimatedCircle
                    cx={SIZE/2} cy={SIZE/2} r={RADIUS}
                    stroke="white"
                    strokeWidth={TRACK_WIDTH}
                    fill="none"
                    strokeDasharray={CIRCUMFERENCE}
                    animatedProps={progressProps}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${SIZE/2}, ${SIZE/2}`}
                />
            </Svg>

            {/* 4. Icon Layer - Consistent FingerPrintIcon */}
            <View style={styles.iconContainer}>
                 <HugeiconsIcon 
                    icon={FingerPrintIcon} 
                    size={48} 
                    // Dynamic color function used here because we need to read shared value on JS thread render
                    // Ideally we use animated props for color, but for simplicity in this structure:
                    color={isClockedIn ? (progress.value > 0.1 ? "white" : "#ef4444") : (progress.value > 0.1 ? "white" : "#6366f1")} 
                 />
            </View>
        </Animated.View>
      </Pressable>
      
      {/* Label */}
      <Text style={styles.label}>
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
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  iconContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 20,
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  }
});