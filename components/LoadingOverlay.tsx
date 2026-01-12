import React, { useEffect } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

interface LoadingOverlayProps {
    visible: boolean;
    message?: string;
}

export default function LoadingOverlay({ visible, message = 'Loading...' }: LoadingOverlayProps) {
    const theme = useAppTheme();
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.5);

    useEffect(() => {
        if (visible) {
            // Breathing animation
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
            opacity.value = withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 800 }),
                    withTiming(0.4, { duration: 800 })
                ),
                -1,
                true
            );
        } else {
             scale.value = 1;
             opacity.value = 0.5;
        }
    }, [visible]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
            <Animated.View 
                entering={FadeIn.duration(200)} 
                exiting={FadeOut.duration(200)} 
                style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
            >
                {/* Glassmorphism-style Box */}
                <View style={[styles.box, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    
                    {/* Animated Pulse Ring behind spinner */}
                    <Animated.View style={[
                        styles.pulseRing, 
                        { backgroundColor: theme.colors.primary }, 
                        pulseStyle
                    ]} />

                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.background }]}>
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                    
                    <Text style={[styles.message, { color: theme.colors.text }]}>{message}</Text>
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    box: {
        width: 180,
        height: 180,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        // Shadow for depth
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10
    },
    pulseRing: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        top: 40, // Centered vertically relative to the spinner pos roughly
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        zIndex: 10,
        // Inner shadow effect logic (simulated by border/bg)
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)'
    },
    message: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
        textAlign: 'center',
        zIndex: 10
    }
});