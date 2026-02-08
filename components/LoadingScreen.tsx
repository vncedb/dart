import { useAppTheme } from '@/constants/theme';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
    const theme = useAppTheme();
    const animationRef = useRef<LottieView>(null);

    // Use the same assets as LoadingOverlay
    const animationSource = theme.dark
        ? require('../assets/loading/loading-darkmode.json')
        : require('../assets/loading/loading-lightmode.json');

    useEffect(() => {
        animationRef.current?.play();
    }, []);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.content}>
                <View style={styles.lottieContainer}>
                    <LottieView
                        ref={animationRef}
                        source={animationSource}
                        autoPlay
                        loop
                        style={styles.lottie}
                        resizeMode="contain"
                    />
                </View>
                <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
                    {message}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -40, // Slight visual offset to center optically
    },
    lottieContainer: {
        width: 140,
        height: 140,
        marginBottom: 16,
    },
    lottie: {
        width: '100%',
        height: '100%',
    },
    text: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.5,
    }
});