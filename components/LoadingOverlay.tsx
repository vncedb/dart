import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({ visible, message = "Loading..." }: LoadingOverlayProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation Shared Values
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Start infinite rotation
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1 // Infinite
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [visible]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View 
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.container}
      >
        {/* Backdrop */}
        <View style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)' }]} />

        {/* Loading Card */}
        <View style={[
            styles.card, 
            isDark ? styles.cardDark : styles.cardLight
        ]}>
          <Animated.View style={[styles.iconWrapper, animatedIconStyle]}>
            <HugeiconsIcon 
                icon={Loading03Icon} 
                size={32} 
                color={isDark ? '#818cf8' : '#4f46e5'} // Indigo-400 (Dark) / Indigo-600 (Light)
                strokeWidth={2.5}
            />
          </Animated.View>
          
          <Text style={[
              styles.text, 
              isDark ? styles.textDark : styles.textLight
          ]}>
            {message}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    gap: 16,
    minWidth: 200,
    justifyContent: 'center',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardDark: {
    backgroundColor: '#1e293b', // Slate 800
    borderWidth: 1,
    borderColor: '#334155', // Slate 700
  },
  iconWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System', // Or your custom font
  },
  textLight: {
    color: '#0f172a', // Slate 900
  },
  textDark: {
    color: '#f8fafc', // Slate 50
  }
});