import { PauseCircleIcon, PlayCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

interface BreakModeAlertProps {
    visible: boolean;
    onResume: () => void;
}

const BreakModeAlert = ({ visible, onResume }: BreakModeAlertProps) => {
    const theme = useAppTheme();
    const [duration, setDuration] = useState(0);

    // Timer Logic
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (visible) {
            interval = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            setDuration(0);
        }
        return () => clearInterval(interval);
    }, [visible]);

    const formatTime = (secs: number) => {
        const hours = Math.floor(secs / 3600);
        const minutes = Math.floor((secs % 3600) / 60);
        const seconds = secs % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleResume = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onResume();
    };

    if (!visible) return null;

    return (
        <Animated.View 
            // Removed springify() to eliminate the bounce, using a smooth duration instead
            entering={FadeInDown.duration(350)} 
            exiting={FadeOutDown.duration(250)}
            style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
            <View style={styles.left}>
                <View style={styles.iconBox}>
                    <HugeiconsIcon icon={PauseCircleIcon} size={26} color="#F59E0B" />
                </View>
                <View style={styles.textWrapper}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>On Break</Text>
                    <Text style={[styles.subtitle, { color: '#F59E0B' }]}>
                        Paused for <Text style={styles.timerText}>{formatTime(duration)}</Text>
                    </Text>
                </View>
            </View>

            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleResume}
                style={[styles.resumeBtn, { backgroundColor: theme.colors.primary }]}
            >
                <HugeiconsIcon icon={PlayCircleIcon} size={18} color="#FFF" />
                <Text style={styles.resumeText}>Resume</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 110, // Sits directly above the tab bar
        alignSelf: 'center',
        width: '85%', // Matches the CustomTabBar width perfectly
        borderRadius: 24, 
        borderWidth: 1,
        padding: 12,
        paddingRight: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 10,
        zIndex: 1000,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F59E0B15', 
        alignItems: 'center',
        justifyContent: 'center',
    },
    textWrapper: {
        justifyContent: 'center',
    },
    title: {
        fontSize: 15,
        fontFamily: 'Nunito_700Bold',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'Nunito_600SemiBold',
    },
    timerText: {
        fontVariant: ['tabular-nums'], 
        fontFamily: 'Nunito_700Bold',
    },
    resumeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    resumeText: {
        color: '#FFF',
        fontSize: 13,
        fontFamily: 'Nunito_700Bold',
    }
});

export default BreakModeAlert;