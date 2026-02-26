import { PauseCircleIcon, PlayCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
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
        let interval: NodeJS.Timeout;
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
        const minutes = Math.floor(secs / 60);
        const seconds = secs % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!visible) return null;

    return (
        <Animated.View 
            entering={FadeInDown.springify()} 
            exiting={FadeOutDown}
            style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
            <View style={styles.left}>
                <View style={[styles.iconBox, { backgroundColor: '#F59E0B' + '20' }]}>
                    <HugeiconsIcon icon={PauseCircleIcon} size={24} color="#F59E0B" />
                </View>
                <View>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Break Mode Active</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Paused for {formatTime(duration)}
                    </Text>
                </View>
            </View>

            <TouchableOpacity 
                onPress={onResume}
                style={[styles.resumeBtn, { backgroundColor: theme.colors.primary }]}
            >
                <HugeiconsIcon icon={PlayCircleIcon} size={20} color="#FFF" />
                <Text style={styles.resumeText}>Resume</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 135, // Increased spacing from 100 to 135
        left: 20,
        right: 20,
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 1000,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 12,
    },
    resumeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    resumeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    }
});

export default BreakModeAlert;