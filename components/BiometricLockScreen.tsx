// components/BiometricLockScreen.tsx
import { SquareLock02Icon, SquareUnlock02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../constants/theme';

export default function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    const hasFiredInitialAuth = useRef(false);

    // Animation values
    const shake = useSharedValue(0);
    const errorColor = useSharedValue(0);

    const triggerErrorAnim = () => {
        // Shake sequence
        shake.value = withSequence(
            withTiming(-15, { duration: 50 }),
            withTiming(15, { duration: 50 }),
            withTiming(-15, { duration: 50 }),
            withTiming(15, { duration: 50 }),
            withTiming(0, { duration: 50 })
        );
        // Red color transition sequence (fade to red, hold, fade back to primary)
        errorColor.value = withSequence(
            withTiming(1, { duration: 150 }),
            withTiming(1, { duration: 800 }),
            withTiming(0, { duration: 400 })
        );
    };

    const animatedCircleStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: shake.value }],
            backgroundColor: interpolateColor(
                errorColor.value,
                [0, 1],
                [theme.colors.primary, theme.colors.danger]
            )
        };
    });

    const authenticate = async () => {
        if (isAuthenticating || isUnlocked) return;
        setIsAuthenticating(true);
        setErrorMsg(null);

        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                onUnlock();
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock DART',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false, 
            });

            if (result.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setIsUnlocked(true); 
                
                setTimeout(() => {
                    onUnlock();
                }, 800); 
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                if (result.error !== 'user_cancel') {
                    setErrorMsg('Authentication failed. Please try again.');
                    triggerErrorAnim();
                }
            }
        } catch {
            setErrorMsg('An error occurred. Please try again.');
            triggerErrorAnim();
        } finally {
            setIsAuthenticating(false);
        }
    };

    useEffect(() => {
        if (!hasFiredInitialAuth.current) {
            authenticate();
            hasFiredInitialAuth.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Animated.View entering={FadeIn.duration(400)} style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
            
            <View style={[styles.glow, { backgroundColor: theme.colors.primary, opacity: isDark ? 0.15 : 0.08 }]} />

            <View style={styles.content}>
                <Animated.View entering={ZoomIn.duration(600).delay(200)} style={styles.logoContainer}>
                    <Image 
                        source={isDark 
                            ? require('../assets/images/dart-logo-transparent-light.png') 
                            : require('../assets/images/dart-logo-transparent-dark.png')
                        } 
                        style={styles.logo} 
                        resizeMode="contain" 
                    />
                </Animated.View>

                <Animated.View entering={SlideInDown.duration(500).delay(300)} style={styles.textContainer}>
                    {/* UPDATED COPY HERE */}
                    <Text style={[styles.title, { color: theme.colors.text }]}>DART Locked</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Identity verification is required to open the app. Please authenticate to continue.
                    </Text>
                </Animated.View>

                <Animated.View entering={SlideInDown.duration(500).delay(400)} style={styles.actionContainer}>
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={authenticate}
                        disabled={isAuthenticating || isUnlocked}
                    >
                        <Animated.View style={[styles.authCircle, animatedCircleStyle, { shadowColor: theme.colors.primary }]}>
                            {isAuthenticating ? (
                                <ActivityIndicator color="#fff" size="large" />
                            ) : isUnlocked ? (
                                <Animated.View key="unlock" entering={ZoomIn.duration(300).springify()} exiting={FadeOut.duration(200)}>
                                    <HugeiconsIcon icon={SquareUnlock02Icon} size={36} color="#fff" />
                                </Animated.View>
                            ) : (
                                <Animated.View key="lock" entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
                                    <HugeiconsIcon icon={SquareLock02Icon} size={36} color="#fff" />
                                </Animated.View>
                            )}
                        </Animated.View>
                    </TouchableOpacity>

                    {errorMsg && (
                        <Animated.Text entering={FadeIn} style={[styles.errorText, { color: theme.colors.danger }]}>
                            {errorMsg}
                        </Animated.Text>
                    )}
                </Animated.View>
            </View>

        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glow: {
        position: 'absolute',
        top: '25%',
        width: 350,
        height: 350,
        borderRadius: 175,
        filter: 'blur(90px)', 
    },
    content: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        marginTop: -60,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 48,
    },
    logo: {
        width: 180,
        height: 60,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 56,
    },
    title: {
        fontSize: 28,
        fontFamily: 'Nunito_800ExtraBold',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        fontFamily: 'Nunito_500Medium',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    actionContainer: {
        width: '100%',
        alignItems: 'center',
        marginTop: 20,
    },
    authCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    errorText: {
        marginTop: 24,
        fontSize: 15,
        fontFamily: 'Nunito_700Bold',
        textAlign: 'center',
    }
});