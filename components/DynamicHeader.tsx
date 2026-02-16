import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../constants/theme';

interface DynamicHeaderProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    isClockedIn: boolean;
    isOvertime?: boolean;
    workedMinutes: number;
    dailyGoal: number;
    isLoading?: boolean;
}

const SkeletonBox = ({ width, height, borderRadius = 4, style }: any) => {
    const theme = useAppTheme();
    return (
        <View 
            style={[
                { 
                    width, 
                    height, 
                    borderRadius, 
                    backgroundColor: theme.colors.border, 
                    opacity: 0.3 
                }, 
                style
            ]} 
        />
    );
};

export default function DynamicHeader({ 
    selectedDate, 
    isClockedIn,
    isOvertime = false,
    workedMinutes,
    dailyGoal,
    isLoading = false
}: DynamicHeaderProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    
    const [currentTime, setCurrentTime] = useState(new Date());

    // --- Animations ---
    const progressAnim = useSharedValue(0);
    const scaleAnim = useSharedValue(1);

    const getStatusConfig = () => {
        if (isClockedIn) {
            if (isOvertime) {
                return { label: 'Overtime', color: '#F59E0B', bg: '#FFF7ED' }; 
            }
            return { label: 'Active', color: theme.colors.success, bg: '#F0FDF4' };
        }
        return { label: 'Offline', color: theme.colors.textSecondary, bg: theme.colors.background };
    };

    const status = getStatusConfig();

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (isLoading) {
            progressAnim.value = withTiming(0);
            return;
        }
        const goalMins = dailyGoal * 60;
        const percent = goalMins > 0 ? Math.min(workedMinutes / goalMins, 1) : 0;
        progressAnim.value = withTiming(percent, { duration: 1000 });
    }, [workedMinutes, dailyGoal, isLoading]);

    const handlePressIn = () => {
        scaleAnim.value = withSpring(0.98, { damping: 10 });
    };

    const handlePressOut = () => {
        scaleAnim.value = withSpring(1, { damping: 10 });
    };

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }],
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value * 100}%`,
        backgroundColor: status.color,
    }));

    return (
        <View style={[styles.wrapper, { paddingTop: insets.top + 8 }]}>
            <Pressable 
                onPress={() => Haptics.selectionAsync()}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isLoading}
                style={styles.pressable}
            >
                <Animated.View 
                    style={[
                        styles.container, 
                        containerStyle, 
                        { 
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                        }
                    ]}
                >
                    {/* Header Top: Date & Status */}
                    <View style={styles.rowBetween}>
                        <View style={{ justifyContent: 'center' }}>
                            {isLoading ? (
                                <SkeletonBox width={90} height={12} borderRadius={4} style={{marginBottom: 4}} />
                            ) : (
                                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                                    {format(selectedDate, 'EEEE, MMM d')}
                                </Text>
                            )}
                            
                            {isLoading ? (
                                <SkeletonBox width={50} height={20} borderRadius={6} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                    <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                        {format(currentTime, 'h:mm')}
                                    </Text>
                                    <Text style={[styles.ampmText, { color: theme.colors.textSecondary }]}>
                                        {format(currentTime, 'a')} {/* Removed toLowerCase to keep Uppercase */}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Status Badge */}
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                             {isLoading ? (
                                <SkeletonBox width={60} height={24} borderRadius={12} />
                             ) : (
                                <View style={[styles.badge, { backgroundColor: theme.dark ? theme.colors.background : status.bg, borderColor: theme.colors.border }]}>
                                    <View style={[styles.dot, { backgroundColor: status.color }]} />
                                    <Text style={[styles.badgeText, { color: theme.dark ? theme.colors.text : status.color }]}>
                                        {status.label}
                                    </Text>
                                </View>
                             )}
                        </View>
                    </View>

                    {/* Progress Bar (Bottom Line) */}
                    <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                        <Animated.View style={[styles.progressFill, progressBarStyle]} />
                    </View>

                </Animated.View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        paddingHorizontal: 20, 
        zIndex: 10,
    },
    pressable: {
        width: '100%',
    },
    container: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 12, 
        borderRadius: 16,    
        borderWidth: 1,
        // Removed elevation/shadow for smoother scroll performance
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        opacity: 0.6,
        marginBottom: 0,
        letterSpacing: 0.5,
    },
    timeText: {
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: -0.5,
        fontVariant: ['tabular-nums'],
    },
    ampmText: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 100,
        borderWidth: 1,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginRight: 6,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    progressTrack: {
        height: 3,
        borderRadius: 1.5,
        width: '100%',
        overflow: 'hidden',
        opacity: 0.5
    },
    progressFill: {
        height: '100%',
        borderRadius: 1.5,
    },
});