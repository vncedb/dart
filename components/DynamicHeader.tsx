import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    return <View style={[{ width, height, borderRadius, backgroundColor: theme.colors.textSecondary, opacity: 0.15 }, style]} />;
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
    const pulseAnim = useSharedValue(1);

    const getStatusConfig = () => {
        if (isClockedIn) {
            if (isOvertime) {
                return { label: 'Overtime', color: '#F59E0B' }; 
            }
            return { label: 'On Duty', color: theme.colors.success };
        }
        return { label: 'Off Duty', color: theme.colors.textSecondary };
    };

    const { label: statusLabel, color: statusColor } = getStatusConfig();

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (isClockedIn && !isLoading) {
            pulseAnim.value = withRepeat(withTiming(0.6, { duration: 1000 }), -1, true);
        } else {
            pulseAnim.value = withTiming(1);
        }
    }, [isClockedIn, isLoading, pulseAnim]);

    useEffect(() => {
        if (isLoading) {
            progressAnim.value = withTiming(0);
            return;
        }
        const goalMins = dailyGoal * 60;
        const percent = goalMins > 0 ? Math.min(workedMinutes / goalMins, 1) : 0;
        progressAnim.value = withTiming(percent, { duration: 1000 });
    }, [workedMinutes, dailyGoal, isLoading, progressAnim]);

    // --- Interaction ---
    const handlePressIn = () => {
        scaleAnim.value = withSpring(0.98, { damping: 10 });
    };

    const handlePressOut = () => {
        scaleAnim.value = withSpring(1, { damping: 10 });
    };

    // --- Styles ---
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }],
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value * 100}%`,
        backgroundColor: statusColor,
    }));

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseAnim.value,
        transform: [{ scale: pulseAnim.value }]
    }));

    return (
        <View style={[styles.wrapper, { top: insets.top + 12 }]}>
            <Pressable 
                onPress={() => Haptics.selectionAsync()}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isLoading}
            >
                <Animated.View 
                    style={[
                        styles.islandContainer, 
                        containerStyle, 
                        { 
                            backgroundColor: theme.colors.card,
                            borderColor: theme.colors.border,
                        }
                    ]}
                >
                    {/* Top Row: Date & Time */}
                    <View style={styles.primaryRow}>
                        {isLoading ? (
                            <SkeletonBox width={120} height={26} borderRadius={6} />
                        ) : (
                            <Text style={[styles.dateText, { color: theme.colors.text }]}>
                                {format(selectedDate, 'MMMM d')}
                            </Text>
                        )}
                        
                        <View style={styles.timeContainer}>
                            {isLoading ? (
                                <SkeletonBox width={80} height={26} borderRadius={6} />
                            ) : (
                                <>
                                    <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                        {format(currentTime, 'h:mm')}
                                    </Text>
                                    <Text style={[styles.secondaryText, { color: theme.colors.textSecondary, marginLeft: 2, marginBottom: 2 }]}>
                                        {format(currentTime, 'a')}
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Bottom Row: Year/Day & Status */}
                    <View style={styles.secondaryRow}>
                        {isLoading ? (
                            <SkeletonBox width={140} height={14} borderRadius={4} />
                        ) : (
                            <Text style={[styles.secondaryText, { color: theme.colors.textSecondary }]}>
                                {format(selectedDate, 'yyyy')}, {format(selectedDate, 'EEEE')}
                            </Text>
                        )}
                        
                        {isLoading ? (
                            <SkeletonBox width={60} height={20} borderRadius={12} />
                        ) : (
                            <View style={[styles.statusBadge, { backgroundColor: theme.colors.background }]}>
                                <Animated.View 
                                    style={[
                                        styles.statusDot, 
                                        pulseStyle,
                                        { backgroundColor: statusColor }
                                    ]} 
                                />
                                <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>
                                    {statusLabel}
                                </Text>
                            </View>
                        )}
                    </View>
                    
                    {/* Bottom Progress Bar */}
                    <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.border }]}>
                        <Animated.View style={[styles.progressBarFill, progressBarStyle]} />
                    </View>

                </Animated.View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        alignItems: 'center',
        width: '100%',
        zIndex: 100,
    },
    islandContainer: {
        width: SCREEN_WIDTH - 32,
        height: 94,
        borderRadius: 24,
        paddingHorizontal: 22,
        paddingTop: 16,
        paddingBottom: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 6,
        justifyContent: 'flex-start',
    },
    primaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 6,
        height: 28, 
    },
    dateText: {
        fontSize: 20, 
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    timeText: {
        fontSize: 22, 
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    secondaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        height: 20,
    },
    secondaryText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.2,
    },
    progressBarContainer: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        width: '100%',
        marginTop: 'auto',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
});