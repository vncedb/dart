import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../constants/theme';
import { FontFamily, Typography } from '../constants/typography';
import { SkeletonBlock } from './Skeleton';

interface DynamicHeaderProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    isClockedIn: boolean;
    isOvertime?: boolean;
    workedMinutes: number;
    dailyGoal: number;
    isLoading?: boolean;
}

const withAlpha = (color: string, alpha: number) => {
    if (color.startsWith('#')) {
        const normalized = color.replace('#', '');
        const hex = normalized.length === 3
            ? normalized.split('').map((char) => char + char).join('')
            : normalized;

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/i);
    if (!rgbaMatch) return color;

    const values = rgbaMatch[1].split(',').map((value) => value.trim());
    const [r = '0', g = '0', b = '0'] = values;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function DynamicHeader({
    selectedDate,
    onSelectDate,
    isClockedIn,
    isOvertime = false,
    workedMinutes,
    dailyGoal,
    isLoading = false,
}: DynamicHeaderProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const [currentTime, setCurrentTime] = useState(new Date());

    const progressAnim = useSharedValue(0);
    const scaleAnim = useSharedValue(1);

    const status = useMemo(() => {
        if (isClockedIn) {
            if (isOvertime) {
                return { label: 'Overtime', color: '#F59E0B' };
            }

            return { label: 'Active Session', color: theme.colors.success };
        }

        return { label: 'Off Duty', color: theme.colors.primary };
    }, [isClockedIn, isOvertime, theme.colors.primary, theme.colors.success]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (isLoading) {
            progressAnim.value = withTiming(0, { duration: 120 });
            return;
        }

        const goalMinutes = dailyGoal * 60;
        const percent = goalMinutes > 0 ? Math.min(workedMinutes / goalMinutes, 1) : 0;
        progressAnim.value = withTiming(percent, { duration: 420 });
    }, [dailyGoal, isLoading, progressAnim, workedMinutes]);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }],
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value * 100}%`,
    }));

    const accentColor = status.color;
    const accentShade = withAlpha(accentColor, theme.dark ? 0.22 : 0.14);
    const accentEdge = withAlpha(accentColor, theme.dark ? 0.16 : 0.08);
    const dayLabel = format(selectedDate, 'EEEE, MMMM d');
    const timeLabel = format(currentTime, 'h:mm');
    const meridiemLabel = format(currentTime, 'a');
    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

    const handlePressIn = () => {
        scaleAnim.value = withSpring(0.988, { damping: 18, stiffness: 260 });
    };

    const handlePressOut = () => {
        scaleAnim.value = withSpring(1, { damping: 18, stiffness: 260 });
    };

    const handlePress = async () => {
        await Haptics.selectionAsync();
        onSelectDate(selectedDate);
    };

    return (
        <View style={[styles.wrapper, { paddingTop: insets.top + 8 }]}>
            <Pressable
                accessibilityRole="button"
                accessibilityHint="Open the activity date selector"
                disabled={isLoading}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.pressable}
            >
                <Animated.View
                    layout={LinearTransition.springify().damping(20).stiffness(220)}
                    style={[
                        styles.card,
                        containerStyle,
                        {
                            backgroundColor: theme.colors.card,
                            borderColor: accentEdge,
                            shadowColor: withAlpha(accentColor, theme.dark ? 0.28 : 0.16),
                        },
                    ]}
                >
                    <LinearGradient
                        colors={[accentShade, 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.backgroundGlow}
                    />
                    <View style={[styles.cornerOrb, { backgroundColor: withAlpha(accentColor, theme.dark ? 0.15 : 0.08) }]} />

                    <View style={styles.topRow}>
                        <View style={styles.labelStack}>
                            {isLoading ? (
                                <SkeletonBlock style={{ width: 88, height: 10, borderRadius: 999, marginBottom: 8 }} />
                            ) : (
                                <Text style={[styles.eyebrow, { color: theme.colors.textSecondary }]}>
                                    {isToday ? 'TODAY' : 'ACTIVITY DAY'}
                                </Text>
                            )}

                            {isLoading ? (
                                <SkeletonBlock style={{ width: 150, height: 14, borderRadius: 6 }} />
                            ) : (
                                <Text style={[styles.dateText, { color: theme.colors.text }]} numberOfLines={1}>
                                    {dayLabel}
                                </Text>
                            )}
                        </View>

                        {isLoading ? (
                            <SkeletonBlock style={{ width: 102, height: 28, borderRadius: 999 }} />
                        ) : (
                            <View style={[styles.badge, { backgroundColor: withAlpha(accentColor, theme.dark ? 0.2 : 0.12), borderColor: withAlpha(accentColor, theme.dark ? 0.28 : 0.18) }]}>
                                <View style={[styles.dot, { backgroundColor: accentColor }]} />
                                <Text style={[styles.badgeText, { color: accentColor }]} numberOfLines={1}>
                                    {status.label}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.mainRow}>
                        {isLoading ? (
                            <SkeletonBlock style={{ width: 126, height: 36, borderRadius: 10 }} />
                        ) : (
                            <View style={styles.timeRow}>
                                <Text style={[styles.timeText, { color: theme.colors.text }]}>{timeLabel}</Text>
                                <Text style={[styles.ampmText, { color: theme.colors.textSecondary }]}>{meridiemLabel}</Text>
                            </View>
                        )}
                    </View>

                    <View style={[styles.progressTrack, { backgroundColor: withAlpha(theme.colors.textSecondary, theme.dark ? 0.26 : 0.12) }]}>
                        <Animated.View style={[styles.progressFill, progressBarStyle, { backgroundColor: accentColor }]} />
                    </View>
                </Animated.View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        paddingHorizontal: 24,
        zIndex: 10,
        alignItems: 'center',
    },
    pressable: {
        width: '100%',
        maxWidth: 392,
    },
    card: {
        minHeight: 116,
        borderRadius: 28,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 14,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 5,
        overflow: 'hidden',
    },
    backgroundGlow: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.9,
    },
    cornerOrb: {
        position: 'absolute',
        width: 132,
        height: 132,
        borderRadius: 999,
        top: -62,
        right: -22,
        opacity: 0.95,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
    },
    labelStack: {
        flex: 1,
        paddingRight: 8,
    },
    eyebrow: {
        ...Typography.label,
        fontSize: 10,
        lineHeight: 12,
        letterSpacing: 0.9,
        marginBottom: 6,
    },
    dateText: {
        fontFamily: FontFamily.bold,
        fontSize: 14,
        lineHeight: 18,
        letterSpacing: -0.2,
    },
    badge: {
        minHeight: 28,
        maxWidth: '46%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        borderRadius: 999,
        borderWidth: 1,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 999,
        marginRight: 6,
    },
    badgeText: {
        fontFamily: FontFamily.bold,
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.2,
    },
    mainRow: {
        marginBottom: 14,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    timeText: {
        fontFamily: FontFamily.extrabold,
        fontSize: 33,
        lineHeight: 34,
        letterSpacing: -1,
        fontVariant: ['tabular-nums'],
    },
    ampmText: {
        fontFamily: FontFamily.bold,
        fontSize: 14,
        lineHeight: 18,
        marginLeft: 4,
        marginBottom: 4,
    },
    progressTrack: {
        height: 6,
        borderRadius: 999,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
    },
});

