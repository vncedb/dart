import {
    ArrowRight01Icon,
    Clock01Icon,
    DatabaseSyncIcon,
    Target02Icon,
    Task01Icon,
    Tick02Icon,
    WifiOff01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { differenceInMinutes, format } from 'date-fns';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
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
    selectionMode,
    isSelected,
    onPress,
    onLongPress
}: ReportItemProps) => {
    const theme = useAppTheme();

    const hasAttendance = item.status !== 'no-attendance' && item.clock_in && item.clock_out;
    const [y, m, d] = item.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    // --- ACCURATE STATUS ---
    // If it's 1 or true, it's synced. If 0 or false or null, it's unsynced.
    const isSynced = item.is_synced === 1 || item.is_synced === true || item.is_synced === 'true';
    
    const taskCount = item.accomplishments?.length || 0;

    const { durationText, isOvertime, isGoalMet } = useMemo(() => {
        if (!hasAttendance) return { durationText: '0h 0m', isOvertime: false, isGoalMet: false };
        
        const start = new Date(item.clock_in);
        const end = new Date(item.clock_out);
        const diffMins = differenceInMinutes(end, start);
        
        const hours = Math.floor(diffMins / 60);
        const minutes = diffMins % 60;
        
        const isGoal = diffMins >= 480; // 8 hours
        const isOT = diffMins > 540;    // 9 hours

        return {
            durationText: `${hours}h ${minutes > 0 ? ` ${minutes}m` : ''}`,
            isOvertime: isOT,
            isGoalMet: isGoal
        };
    }, [hasAttendance, item.clock_in, item.clock_out]);

    // --- GLITCH-FREE ANIMATION ---
    // Only animate the border color. No scale, no background color changes.
    const containerStyle = useAnimatedStyle(() => ({
        borderColor: withTiming(isSelected ? theme.colors.primary : theme.colors.card, { duration: 150 }),
    }));

    return (
        <Animated.View style={[styles.container, containerStyle, { backgroundColor: theme.colors.card }]}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.touchable}
            >
                {/* DATE BLOCK */}
                <View style={[styles.dateBlock, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.monthText, { color: theme.colors.primary }]}>{format(dateObj, 'MMM')}</Text>
                    <Text style={[styles.dayText, { color: theme.colors.text }]}>{format(dateObj, 'dd')}</Text>
                    <Text style={[styles.weekdayText, { color: theme.colors.textSecondary }]}>{format(dateObj, 'EEE')}</Text>
                </View>

                {/* INFO */}
                <View style={styles.infoBlock}>
                    <View style={styles.row}>
                        <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.textSecondary} />
                        {hasAttendance ? (
                            <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                {format(new Date(item.clock_in), 'h:mm a')} 
                                <Text style={{ color: theme.colors.textSecondary }}> - </Text> 
                                {format(new Date(item.clock_out), 'h:mm a')}
                            </Text>
                        ) : (
                            <Text style={[styles.absentText, { color: theme.colors.danger }]}>No Attendance</Text>
                        )}
                    </View>

                    {hasAttendance && (
                        <View style={[styles.row, { marginTop: 2 }]}>
                            <Text style={[styles.durationLabel, { color: theme.colors.textSecondary }]}>
                                Total: <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{durationText}</Text>
                            </Text>
                        </View>
                    )}

                    <View style={styles.footerRow}>
                        <View style={[styles.activityPill, { backgroundColor: theme.colors.background }]}>
                            <HugeiconsIcon icon={Task01Icon} size={12} color={theme.colors.textSecondary} />
                            <Text style={[styles.activityText, { color: theme.colors.textSecondary }]}>
                                {taskCount} {taskCount === 1 ? 'Activity' : 'Activities'}
                            </Text>
                        </View>

                        <View style={styles.badgeContainer}>
                            {/* SYNC STATUS */}
                            {hasAttendance && (
                                isSynced ? (
                                    <View style={[styles.miniBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                        <HugeiconsIcon icon={DatabaseSyncIcon} size={12} color={theme.colors.primary} />
                                    </View>
                                ) : (
                                    <View style={[styles.miniBadge, { backgroundColor: theme.colors.danger + '15' }]}>
                                        <HugeiconsIcon icon={WifiOff01Icon} size={12} color={theme.colors.danger} />
                                    </View>
                                )
                            )}
                            
                            {/* GOAL */}
                            {isGoalMet && !isOvertime && (
                                <View style={[styles.miniBadge, { backgroundColor: theme.colors.success + '15' }]}>
                                    <HugeiconsIcon icon={Target02Icon} size={12} color={theme.colors.success} />
                                </View>
                            )}

                            {/* OVERTIME */}
                            {isOvertime && (
                                <View style={[styles.miniBadge, { backgroundColor: theme.colors.warning + '20', paddingHorizontal: 6 }]}>
                                    <Text style={[styles.miniBadgeText, { color: theme.colors.warning }]}>OT</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* ACTION COLUMN (Fixed Width) */}
                <View style={styles.actionColumn}>
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
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 20,
        marginBottom: 10,
        borderRadius: 18,
        borderWidth: 2,
        overflow: 'hidden',
        // Minimal shadow to avoid Android grey glitch
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    touchable: { flexDirection: 'row', padding: 12, alignItems: 'center' },
    dateBlock: { width: 60, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    monthText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 1 },
    dayText: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
    weekdayText: { fontSize: 10, fontWeight: '600', opacity: 0.6, marginTop: 2, textTransform: 'uppercase' },
    infoBlock: { flex: 1, justifyContent: 'center', gap: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: 14, fontWeight: '700' },
    absentText: { fontSize: 14, fontWeight: '600', fontStyle: 'italic' },
    durationLabel: { fontSize: 12, fontWeight: '500', marginLeft: 20 },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    activityPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    activityText: { fontSize: 11, fontWeight: '600' },
    badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    miniBadge: { height: 22, width: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    miniBadgeText: { fontSize: 9, fontWeight: '800' },
    actionColumn: { width: 44, alignItems: 'center', justifyContent: 'center', paddingLeft: 8 },
    checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(ReportItem);