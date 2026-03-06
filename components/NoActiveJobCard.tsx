import { Layers01Icon, Settings02Icon, WifiOffIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    SlideInDown,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import ScaleButton from './ScaleButton';

interface NoActiveJobCardProps {
    theme: any;
    isOffline: boolean;
    highlightTrigger?: number; // <-- ADDED PROP
}

export default function NoActiveJobCard({ theme, isOffline, highlightTrigger = 0 }: NoActiveJobCardProps) {
    const router = useRouter();
    
    // Animation value for the button pulse effect
    const buttonScale = useSharedValue(1);

    // Trigger the pulse effect when highlightTrigger increments
    useEffect(() => {
        if (highlightTrigger > 0) {
            buttonScale.value = withSequence(
                withTiming(1.06, { duration: 150 }),
                withTiming(1, { duration: 150 }),
                withTiming(1.06, { duration: 150 }),
                withTiming(1, { duration: 150 })
            );
        }
    }, [highlightTrigger, buttonScale]);

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }]
    }));

    return (
        <Animated.View 
            entering={FadeIn.duration(600).delay(100)} 
            style={[
                styles.card, 
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
            ]}
        >
            <View style={[styles.bgAccent, { backgroundColor: theme.colors.primary, opacity: 0.03 }]} />

            <View style={styles.content}>
                <Animated.View entering={SlideInDown.duration(500).delay(200)} style={[styles.iconContainer, { backgroundColor: theme.dark ? '#1F2937' : '#F3F4F6' }]}>
                    <HugeiconsIcon icon={isOffline ? WifiOffIcon : Settings02Icon} size={36} color={theme.colors.textSecondary} />
                </Animated.View>
                
                <Animated.View entering={SlideInDown.duration(500).delay(300)} style={styles.textContainer}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>
                        {isOffline ? 'Offline Mode' : 'No Active Job Set'}
                    </Text>
                    <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                        {isOffline 
                            ? "Your job details couldn't be loaded because you are currently offline." 
                            : "You need an active job profile to start tracking your time and generating reports."
                        }
                    </Text>
                </Animated.View>

                {!isOffline && (
                    <Animated.View 
                        entering={SlideInDown.duration(500).delay(400)} 
                        style={[{ width: '100%' }, animatedButtonStyle]} // Applied Pulse Animation Here
                    >
                        <ScaleButton onPress={() => router.push('/job/job')}>
                            <View style={[
                                styles.button, 
                                { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }
                            ]}>
                                <HugeiconsIcon icon={Layers01Icon} size={20} color="#ffffff" />
                                <Text style={styles.buttonText}>Manage Jobs</Text>
                            </View>
                        </ScaleButton>
                    </Animated.View>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
        position: 'relative',
    },
    bgAccent: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75 },
    content: { padding: 32, alignItems: 'center' },
    iconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    textContainer: { alignItems: 'center', marginBottom: 28 },
    title: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
    description: { fontFamily: 'Nunito_500Medium', fontSize: 15, lineHeight: 24, textAlign: 'center', opacity: 0.9, paddingHorizontal: 8 },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 20, width: '100%', gap: 10, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
    buttonText: { fontFamily: 'Nunito_700Bold', color: '#ffffff', fontSize: 16, letterSpacing: 0.3 },
});