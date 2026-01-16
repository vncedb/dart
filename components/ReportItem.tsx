import {
    ArrowRight01Icon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    CloudValidationIcon,
    Task01Icon,
    Tick02Icon,
    WifiOff01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { differenceInMinutes, format } from 'date-fns';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

interface ReportItemProps {
    item: any;
    index: number;
    selectionMode: boolean;
    isSelected: boolean;
    onPress: () => void;
    onLongPress: () => void;
}

const ReportItem = ({
    item,
    index,
    selectionMode,
    isSelected,
    onPress,
    onLongPress
}: ReportItemProps) => {
    const theme = useAppTheme();

    const hasAttendance = item.status !== 'no-attendance' && item.clock_in && item.clock_out;
    const [y, m, d] = item.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    // --- Status Logic ---
    const isUnsynced = item.is_synced === 0 || item.is_synced === false; 
    const taskCount = item.accomplishments?.length || 0;

    // --- Time & Overtime Calculation ---
    const { durationText, isOvertime, isGoalMet } = useMemo(() => {
        if (!hasAttendance) return { durationText: '0h 0m', isOvertime: false, isGoalMet: false };
        
        const start = new Date(item.clock_in);
        const end = new Date(item.clock_out);
        const diffMins = differenceInMinutes(end, start);
        
        const hours = Math.floor(diffMins / 60);
        const minutes = diffMins % 60;
        
        const isOT = diffMins > (9 * 60); 
        const isGoal = diffMins >= (8 * 60);

        return {
            durationText: `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`,
            isOvertime: isOT,
            isGoalMet: isGoal
        };
    }, [hasAttendance, item.clock_in, item.clock_out]);

    // --- Animation Styles ---
    // Fix: Keep borderWidth constant to prevent layout glitch. 
    // Animate Border Color and Opacity/Scale only.
    const containerAnimatedStyle = useAnimatedStyle(() => ({
        borderColor: withTiming(isSelected ? theme.colors.primary : 'transparent', { duration: 150 }),
        transform: [{ scale: withTiming(selectionMode && isSelected ? 0.98 : 1, { duration: 150 }) }]
    }));

    return (
        <Animated.View entering={FadeInDown.delay(index * 20).duration(300)}>
            <Animated.View style={[styles.container, containerAnimatedStyle, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    style={styles.touchable}
                >
                    {/* LEFT: Calendar Block */}
                    <View style={[styles.dateBlock, { backgroundColor: theme.colors.background }]}>
                        <Text style={[styles.monthText, { color: theme.colors.primary }]}>
                            {format(dateObj, 'MMM')}
                        </Text>
                        <Text style={[styles.dayText, { color: theme.colors.text }]}>
                            {format(dateObj, 'dd')}
                        </Text>
                        <Text style={[styles.weekdayText, { color: theme.colors.textSecondary }]}>
                            {format(dateObj, 'EEE')}
                        </Text>
                    </View>

                    {/* CENTER: Details Stack */}
                    <View style={styles.infoBlock}>
                        
                        {/* 1. Time Range (Top) */}
                        <View style={styles.row}>
                            <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.textSecondary} />
                            {hasAttendance ? (
                                <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                    {format(new Date(item.clock_in), 'h:mm a')} 
                                    <Text style={{ color: theme.colors.textSecondary }}> - </Text> 
                                    {format(new Date(item.clock_out), 'h:mm a')}
                                </Text>
                            ) : (
                                <Text style={[styles.absentText, { color: theme.colors.danger }]}>
                                    No Attendance
                                </Text>
                            )}
                        </View>

                        {/* 2. Total Hours (Middle) */}
                        {hasAttendance && (
                            <View style={[styles.row, { marginTop: 2 }]}>
                                <Text style={[styles.durationLabel, { color: theme.colors.textSecondary }]}>
                                    Total: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{durationText}</Text>
                                </Text>
                            </View>
                        )}

                        {/* 3. Activities & Status (Bottom) */}
                        <View style={[styles.row, { marginTop: 6, justifyContent: 'space-between' }]}>
                            
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {/* Activity Count */}
                                <View style={[styles.pill, { backgroundColor: theme.colors.background }]}>
                                    <HugeiconsIcon icon={Task01Icon} size={12} color={theme.colors.textSecondary} />
                                    <Text style={[styles.pillText, { color: theme.colors.textSecondary }]}>
                                        {taskCount} {taskCount === 1 ? 'Activity' : 'Activities'}
                                    </Text>
                                </View>

                                {/* Status Badges */}
                                <View style={styles.badgesRow}>
                                    {isUnsynced && (
                                        <View style={[styles.statusIconBox, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                                            <HugeiconsIcon icon={WifiOff01Icon} size={12} color={theme.colors.textSecondary} />
                                        </View>
                                    )}
                                    {isOvertime && (
                                        <View style={[styles.badge, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning + '30' }]}>
                                            <Text style={[styles.badgeText, { color: theme.colors.warning }]}>OT</Text>
                                        </View>
                                    )}
                                    {/* Synced Icon */}
                                    {!isUnsynced && hasAttendance && (
                                        <View style={[styles.statusIconBox, { backgroundColor: theme.colors.primary + '10' }]}>
                                            <HugeiconsIcon icon={CloudValidationIcon} size={12} color={theme.colors.primary} />
                                        </View>
                                    )}
                                    {/* Goal Met Icon */}
                                    {isGoalMet && !isOvertime && (
                                        <View style={[styles.statusIconBox, { backgroundColor: theme.colors.success + '15' }]}>
                                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color={theme.colors.success} />
                                        </View>
                                    )}
                                </View>
                            </View>

                        </View>
                    </View>

                    {/* RIGHT: Selection / Chevron */}
                    <View style={styles.actionBlock}>
                        {selectionMode ? (
                            <View style={[
                                styles.checkbox, 
                                { 
                                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                    backgroundColor: isSelected ? theme.colors.primary : 'transparent'
                                }
                            ]}>
                                {isSelected && <HugeiconsIcon icon={Tick02Icon} size={12} color="#fff" strokeWidth={4} />}
                            </View>
                        ) : (
                            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.border} />
                        )}
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginBottom: 10,
        borderRadius: 18,
        borderWidth: 1, // Constant border width to prevent glitch
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    touchable: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    // LEFT
    dateBlock: {
        width: 60,
        height: 72,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    monthText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 1,
    },
    dayText: {
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 24,
        letterSpacing: -0.5,
    },
    weekdayText: {
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.6,
        marginTop: 2,
        textTransform: 'uppercase',
    },
    // CENTER
    infoBlock: {
        flex: 1,
        justifyContent: 'center',
        gap: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#000',
        marginLeft: 6,
        letterSpacing: -0.2,
    },
    absentText: {
        fontSize: 14,
        fontWeight: '600',
        fontStyle: 'italic',
        marginLeft: 6,
    },
    durationLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 20, // Align with text above (icon width + gap)
    },
    // Badges & Pills
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    pillText: {
        fontSize: 11,
        fontWeight: '600',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusIconBox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    // RIGHT
    actionBlock: {
        paddingLeft: 12,
        justifyContent: 'center',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default React.memo(ReportItem);