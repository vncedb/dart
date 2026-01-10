import { FingerPrintIcon, SquareLock01Icon, SquareUnlock01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../constants/theme';

export default function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const theme = useAppTheme();
  const [status, setStatus] = useState('Locked');
  
  // Refs to manage scanning state
  const isScanning = useRef(false);
  const isUnlocked = useRef(false);
  const appState = useRef(AppState.currentState);

  const shake = useSharedValue(0);

  const authenticate = async () => {
    // Prevent double calls
    if (isScanning.current || isUnlocked.current) return;
    
    isScanning.current = true;

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // If no hardware/enrollment, unlock automatically to prevent getting stuck
      if (!hasHardware || !isEnrolled) {
        unlockApp();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock DART',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel'
      });

      if (result.success) {
        unlockApp();
      } else {
        setStatus('Try Again');
        triggerShake();
        // Allow retry after a short delay
        setTimeout(() => {
            isScanning.current = false; 
        }, 1000);
      }
    } catch (error) {
      console.log("Biometric Error:", error);
      isScanning.current = false; 
    }
  };

  const unlockApp = () => {
      isUnlocked.current = true;
      setStatus('Unlocked');
      // Small delay for UI feedback
      setTimeout(() => {
          onUnlock();
      }, 500);
  };

  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  // Initial Scan on Mount
  useEffect(() => {
    // Small timeout to allow the view to settle before invoking system UI
    const timer = setTimeout(() => {
        authenticate();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shake.value }],
    };
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Animated.View entering={FadeInUp.delay(200)} style={styles.content}>
        
        {/* Lock Icon */}
        <Animated.View style={[styles.iconContainer, animatedIconStyle, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <HugeiconsIcon 
            icon={status === 'Unlocked' ? SquareUnlock01Icon : SquareLock01Icon} 
            size={64} 
            color={status === 'Unlocked' ? theme.colors.success : theme.colors.primary} 
          />
        </Animated.View>

        {/* Text */}
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>DART Locked</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Identity verification required
          </Text>
        </View>

        {/* Biometric Button (Manual Retry) */}
        <Animated.View entering={FadeInDown.delay(400)} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={() => { isScanning.current = false; authenticate(); }}
              activeOpacity={0.7}
              style={[styles.authButton, { backgroundColor: theme.colors.primary }]}
            >
              <HugeiconsIcon icon={FingerPrintIcon} size={28} color="#FFF" />
              <Text style={styles.authButtonText}>Tap to Unlock</Text>
            </TouchableOpacity>
        </Animated.View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '80%', gap: 32 },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  textContainer: { alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center' },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 99,
    width: '100%',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' }
});