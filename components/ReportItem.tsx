import {
    ArrowRight01Icon,
    Clock01Icon,
    DatabaseSyncIcon,
    Target02Icon,
    Task01Icon,
    WifiOff01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { differenceInMinutes, format } from 'date-fns';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface ReportItemProps {
    item: any;
    index: number;
    onPress: () => void;
}

const ReportItem = ({
    item,
    onPress
}: ReportItemProps) => {
    const theme = useAppTheme();

    const attendances = item.attendances || [];
    const hasAttendance = attendances.length > 0;
    // It is fully completed only if EVERY session has a clock_out
    const isCompleted = hasAttendance && attendances.every((a: any) => a.clock_out);
    
    const [y, m, d] = item.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    const isSynced = item.is_synced === 1 || item.is_synced === true || item.is_synced === 'true';
    const taskCount = item.accomplishments?.length || 0;

    const { durationText, isOvertime, isGoalMet, earliestIn, latestOut } = useMemo(() => {
        if (!hasAttendance) return { durationText: '0h 0m', isOvertime: false, isGoalMet: false, earliestIn: null, latestOut: null };
        
        let totalMins = 0;
        let firstIn = new Date(attendances[0].clock_in);
        let lastOut: Date | null = null;

        attendances.forEach((a: any) => {
            const s = new Date(a.clock_in);
            const e = a.clock_out ? new Date(a.clock_out) : new Date(); // If running, use now
            
            if (a.clock_out) {
                const outDate = new Date(a.clock_out);
                if (!lastOut || outDate > lastOut) lastOut = outDate;
            }
            
            let diff = differenceInMinutes(e, s);
            
            // Subtract recorded breaks
            if (a.remarks && a.remarks.includes('BreakMs:')) {
                const match = a.remarks.match(/BreakMs:(\d+)/);
                if (match) diff -= Math.floor(parseInt(match[1], 10) / 60000);
            }
            totalMins += Math.max(0, diff);
        });

        const hours = Math.floor(totalMins / 60);
        const minutes = totalMins % 60;
        
        const isGoal = totalMins >= 480; 
        const isOT = totalMins > 540;    

        return {
            durationText: `${hours}h ${minutes}m`, // Always shows minutes
            isOvertime: isOT,
            isGoalMet: isGoal,
            earliestIn: firstIn,
            latestOut: lastOut
        };
    }, [attendances, hasAttendance]);

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPress}
                style={styles.touchable}
            >
                <View style={[styles.dateBadge, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text style={[styles.monthText, { color: theme.colors.textSecondary }]}>{format(dateObj, 'MMM')}</Text>
                    <Text style={[styles.dayText, { color: theme.colors.text }]}>{format(dateObj, 'dd')}</Text>
                </View>

                <View style={styles.contentBlock}>
                    <View style={styles.topRow}>
                        
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            {hasAttendance ? (
                                <View style={styles.timeWrapper}>
                                    <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.textSecondary} />
                                    <Text style={[styles.timeText, { color: theme.colors.text }]} numberOfLines={1}>
                                        {format(earliestIn as Date, 'h:mm a')} 
                                        <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium' }}> → </Text> 
                                        {isCompleted && latestOut ? format(latestOut, 'h:mm a') : 'Now'}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={[styles.absentText, { color: theme.colors.danger }]} numberOfLines={1}>
                                    Missed / No Record
                                </Text>
                            )}
                        </View>

                        <View style={styles.iconRow}>
                            {isCompleted && isOvertime && (
                                <View style={[styles.otBadge, { backgroundColor: theme.colors.warning + '15' }]}>
                                    <Text style={[styles.otText, { color: theme.colors.warning }]}>OT</Text>
                                </View>
                            )}
                            {isCompleted && isGoalMet && !isOvertime && (
                                <View style={[styles.otBadge, { backgroundColor: theme.colors.success + '15' }]}>
                                    <HugeiconsIcon icon={Target02Icon} size={12} color={theme.colors.success} />
                                </View>
                            )}
                            {hasAttendance && isSynced ? (
                                <HugeiconsIcon icon={DatabaseSyncIcon} size={14} color={theme.colors.primary} />
                            ) : hasAttendance ? (
                                <HugeiconsIcon icon={WifiOff01Icon} size={14} color={theme.colors.danger} />
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.metricsRow}>
                        {hasAttendance ? (
                            <View style={styles.metricItem}>
                                <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Logged:</Text>
                                <Text style={[styles.metricValue, { color: theme.colors.text }]}>{durationText}</Text>
                            </View>
                        ) : (
                            <View style={styles.metricItem} />
                        )}
                        
                        <View style={[styles.taskPill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                            <HugeiconsIcon icon={Task01Icon} size={12} color={theme.colors.textSecondary} />
                            <Text style={[styles.taskPillText, { color: theme.colors.textSecondary }]}>
                                {taskCount} {taskCount === 1 ? 'Entry' : 'Entries'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionZone}>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.border} />
                </View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginHorizontal: 20, marginBottom: 12, borderRadius: 24, borderWidth: 1, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 }, android: { elevation: 2 } }) },
    touchable: { flexDirection: 'row', padding: 16, alignItems: 'center' },
    dateBadge: { width: 56, height: 60, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    monthText: { fontSize: 10, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', marginBottom: 1, letterSpacing: 0.5 },
    dayText: { fontSize: 19, fontFamily: 'Nunito_700Bold', lineHeight: 22 },
    contentBlock: { flex: 1, justifyContent: 'center' },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    timeWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: 14, fontFamily: 'Nunito_700Bold', letterSpacing: -0.2 },
    absentText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', fontStyle: 'italic' },
    iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    otBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    otText: { fontSize: 9, fontFamily: 'Nunito_700Bold', letterSpacing: 0.5 },
    metricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    metricItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metricLabel: { fontSize: 11, fontFamily: 'Nunito_600SemiBold' },
    metricValue: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
    taskPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
    taskPillText: { fontSize: 11, fontFamily: 'Nunito_700Bold' },
    actionZone: { paddingLeft: 12, justifyContent: 'center' }
});

export default React.memo(ReportItem);