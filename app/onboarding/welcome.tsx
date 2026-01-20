import { ArrowRight01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
    const router = useRouter();
    
    // Animation Values
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const textOpacity = useSharedValue(0);

    useEffect(() => {
        // Start Animations
        scale.value = withSpring(1, { damping: 10 });
        opacity.value = withTiming(1, { duration: 800 });
        textOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    }, [scale, opacity, textOpacity]); // Added dependencies

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value,
        transform: [{ translateY: withTiming(textOpacity.value === 1 ? 0 : 20) }]
    }));

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <Image 
                source={require('../../assets/images/intro/welcome.avif')}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
                blurRadius={80} 
            />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15, 23, 42, 0.8)' }]} />

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <Animated.View style={[styles.iconContainer, iconStyle]}>
                        {/* Removed variant="solid" to fix TS error */}
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={80} color="#fff" />
                    </Animated.View>

                    <Animated.View style={[styles.textContainer, textStyle]}>
                        <Text style={styles.title}>All Set!</Text>
                        <Text style={styles.subtitle}>
                            Your account has been created successfully. Let&apos;s get your profile set up.
                        </Text>
                    </Animated.View>
                </View>

                <Animated.View style={[{ width: '100%' }, textStyle]}>
                    <TouchableOpacity 
                        onPress={() => router.replace('/onboarding/info')}
                        style={styles.button}
                    >
                        <Text style={styles.buttonText}>Setup Profile</Text>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="#0f172a" strokeWidth={2.5} />
                    </TouchableOpacity>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    safeArea: { flex: 1, padding: 30, justifyContent: 'space-between' },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    iconContainer: {
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: "#8b5cf6", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 30,
        marginBottom: 40
    },
    textContainer: { alignItems: 'center', gap: 12 },
    title: { fontSize: 40, fontWeight: '900', color: '#fff' },
    subtitle: { fontSize: 18, color: '#c4b5fd', textAlign: 'center', lineHeight: 26 },
    button: {
        backgroundColor: '#fff', height: 60, borderRadius: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: "#fff", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10
    },
    buttonText: { fontSize: 18, fontWeight: '800', color: '#0f172a' }
});