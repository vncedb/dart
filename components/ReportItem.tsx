// filepath: components/ReportItem.tsx
import {
    Alert02Icon,
    ArrowRight01Icon,
    CloudSavingDone01Icon,
    CloudUploadIcon,
    Rocket01Icon,
    Target02Icon,
    Task01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { differenceInMinutes, format } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

interface ReportItemProps {
    item: any;
    index: number;
    job?: any;
    onPress: () => void;
}

// Global reference to ensure only ONE tooltip is open across all ReportItems
let globalTooltipCloser: (() => void) | null = null;

const ReportItem = ({
    item,
    job,
    onPress
}: ReportItemProps) => {
    const theme = useAppTheme();
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const attendances = useMemo(() => item.attendances || [], [item.attendances]);
    
    const hasAttendance = attendances.length > 0;
    const isCompleted = hasAttendance && attendances.every((a: any) => a.clock_out);
    
    const [y, m, d] = item.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    const isSynced = item.is_synced === 1 || item.is_synced === true || item.is_synced === 'true';
    const taskCount = item.accomplishments?.length || 0;

    const { durationText, isOvertime, isEarly, isGoalMet, earliestIn, latestOut } = useMemo(() => {
        if (!hasAttendance) return { durationText: '0h 0m', isOvertime: false, isEarly: false, isGoalMet: false, earliestIn: null, latestOut: null };
        
        let totalMins = 0;
        let firstIn = new Date(attendances[0].clock_in);
        let lastOut: Date | null = null;

        attendances.forEach((a: any) => {
            const s = new Date(a.clock_in);
            const e = a.clock_out ? new Date(a.clock_out) : new Date(); 
            
            if (a.clock_out) {
                const outDate = new Date(a.clock_out);
                if (!lastOut || outDate > lastOut) lastOut = outDate;
            }
            
            let diff = differenceInMinutes(e, s);
            
            if (a.remarks && a.remarks.includes('BreakMs:')) {
                const match = a.remarks.match(/BreakMs:(\d+)/);
                if (match) diff -= Math.floor(parseInt(match[1], 10) / 60000);
            }
            totalMins += Math.max(0, diff);
        });

        const hours = Math.floor(totalMins / 60);
        const minutes = totalMins % 60;
        const isGoal = totalMins >= 480; 

        let earlyTag = false;
        let otTag = false;

        if (job?.work_schedule) {
            const ws = typeof job.work_schedule === 'string' ? JSON.parse(job.work_schedule) : job.work_schedule;
            
            if (ws?.start && firstIn) {
                const [h, m] = ws.start.split(':').map(Number);
                const shiftStartMins = h * 60 + m;
                const inMins = firstIn.getHours() * 60 + firstIn.getMinutes();
                if (inMins < shiftStartMins) earlyTag = true;
            }

            const validLastOut = lastOut as Date | null;
            if (ws?.end && validLastOut) {
                const [h, m] = ws.end.split(':').map(Number);
                const shiftEndMins = h * 60 + m;
                const outMins = validLastOut.getHours() * 60 + validLastOut.getMinutes();
                if (outMins > shiftEndMins) otTag = true;
            }
        } else {
            if (totalMins > 540) otTag = true;
        }

        return {
            durationText: `${hours}h ${minutes}m`, 
            isOvertime: otTag,
            isEarly: earlyTag,
            isGoalMet: isGoal,
            earliestIn: firstIn,
            latestOut: lastOut
        };
    }, [attendances, hasAttendance, job]);

    const isPast = dateObj < new Date(new Date().setHours(0,0,0,0));
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const absentLabel = (isPast && !isWeekend) ? 'Missed' : 'No Record';
    const absentTooltip = absentLabel === 'Missed' ? 'Missed Shift' : 'No Attendance Record';

    const closeTooltip = useCallback(() => {
        setActiveTooltip(null);
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    }, []);

    useEffect(() => {
        return () => {
            if (globalTooltipCloser === closeTooltip) {
                globalTooltipCloser = null;
            }
            if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        };
    }, [closeTooltip]);

    const handleShowTooltip = (message: string) => {
        if (activeTooltip === message) {
            closeTooltip();
            if (globalTooltipCloser === closeTooltip) globalTooltipCloser = null;
            return;
        }

        if (globalTooltipCloser && globalTooltipCloser !== closeTooltip) {
            globalTooltipCloser();
        }

        setActiveTooltip(message);
        globalTooltipCloser = closeTooltip;

        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = setTimeout(() => {
            setActiveTooltip(null);
            if (globalTooltipCloser === closeTooltip) globalTooltipCloser = null;
        }, 2500); 
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.touchable}>
                
                <View style={[styles.dateBadge, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.border }]}>
                    <Text style={[styles.weekdayText, { color: theme.colors.textSecondary }]}>{format(dateObj, 'EEE')}</Text>
                    <Text style={[styles.dayText, { color: theme.colors.text }]}>{format(dateObj, 'dd')}</Text>
                    <View style={[styles.monthPill, { backgroundColor: theme.colors.primary + '15' }]}>
                        <Text style={[styles.monthText, { color: theme.colors.primary }]}>{format(dateObj, 'MMM')}</Text>
                    </View>
                </View>

                <View style={styles.contentBlock}>
                    <View style={styles.topRow}>
                        
                        <View style={styles.leftColumn}>
                            {hasAttendance ? (
                                <Text 
                                    style={[styles.timeText, { color: theme.colors.text }]} 
                                    numberOfLines={1} 
                                    adjustsFontSizeToFit 
                                    minimumFontScale={0.6}
                                >
                                    {format(earliestIn as Date, 'h:mm a')} 
                                    <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium' }}> → </Text> 
                                    {isCompleted && latestOut ? format(latestOut as Date, 'h:mm a') : 'Now'}
                                </Text>
                            ) : (
                                <Text 
                                    style={[styles.timeText, { color: theme.colors.danger }]}
                                    numberOfLines={1} 
                                    adjustsFontSizeToFit 
                                    minimumFontScale={0.6}
                                >
                                    {absentLabel}
                                </Text>
                            )}

                            <View style={styles.tagsContainer}>
                                {isEarly && (
                                    <TouchableOpacity activeOpacity={0.6} onPress={() => handleShowTooltip("Clocked in Early")} style={[styles.tagBadge, { backgroundColor: theme.colors.success + '15' }]}>
                                        <HugeiconsIcon icon={Rocket01Icon} size={11} color={theme.colors.success} />
                                    </TouchableOpacity>
                                )}
                                {isCompleted && isOvertime && (
                                    <TouchableOpacity activeOpacity={0.6} onPress={() => handleShowTooltip("Overtime Logged")} style={[styles.tagBadge, { backgroundColor: theme.colors.warning + '15' }]}>
                                        <Text style={[styles.tagText, { color: theme.colors.warning }]}>OT</Text>
                                    </TouchableOpacity>
                                )}
                                {isCompleted && isGoalMet && !isOvertime && !isEarly && (
                                    <TouchableOpacity activeOpacity={0.6} onPress={() => handleShowTooltip("Target Goal Reached")} style={[styles.tagBadge, { backgroundColor: theme.colors.success + '15' }]}>
                                        <HugeiconsIcon icon={Target02Icon} size={11} color={theme.colors.success} />
                                    </TouchableOpacity>
                                )}
                                {hasAttendance && (
                                    <TouchableOpacity activeOpacity={0.6} onPress={() => handleShowTooltip(isSynced ? "Synced to Cloud" : "Pending Sync")} style={[styles.tagBadge, { backgroundColor: (isSynced ? theme.colors.primary : theme.colors.danger) + '15' }]}>
                                        <HugeiconsIcon icon={isSynced ? CloudSavingDone01Icon : CloudUploadIcon} size={11} color={isSynced ? theme.colors.primary : theme.colors.danger} />
                                    </TouchableOpacity>
                                )}
                                {!hasAttendance && (
                                    <TouchableOpacity activeOpacity={0.6} onPress={() => handleShowTooltip(absentTooltip)} style={[styles.tagBadge, { backgroundColor: theme.colors.danger + '15' }]}>
                                        <HugeiconsIcon icon={Alert02Icon} size={11} color={theme.colors.danger} />
                                    </TouchableOpacity>
                                )}

                                {activeTooltip && (
                                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.tooltipBubble, { backgroundColor: theme.colors.text }]}>
                                        <Text style={[styles.tooltipText, { color: theme.colors.card }]}>{activeTooltip}</Text>
                                    </Animated.View>
                                )}
                            </View>
                        </View>

                        <View style={styles.metricsColumn}>
                            <Text style={[styles.metricText, { color: hasAttendance ? theme.colors.textSecondary : 'transparent', marginBottom: 4 }]}>
                                {hasAttendance ? durationText : '0h 0m'}
                            </Text>
                            
                            <View style={styles.taskInline}>
                                <HugeiconsIcon icon={Task01Icon} size={12} color={theme.colors.textSecondary} />
                                <Text style={[styles.metricText, { color: theme.colors.textSecondary }]}>
                                    {taskCount} {taskCount === 1 ? 'Entry' : 'Entries'}
                                </Text>
                            </View>
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
    container: { 
        marginHorizontal: 20, 
        marginBottom: 10, 
        borderRadius: 20, 
        borderWidth: 1, 
        overflow: 'hidden'
    },
    touchable: { flexDirection: 'row', padding: 12, alignItems: 'center' },
    
    dateBadge: { 
        width: 52, 
        height: 64, 
        borderRadius: 14, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginRight: 12,
        borderWidth: 1,
        paddingVertical: 4
    },
    weekdayText: { fontSize: 9, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', opacity: 0.7, marginBottom: 1 },
    dayText: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', lineHeight: 22, marginBottom: 2 },
    monthPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    monthText: { fontSize: 8, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 },
    
    contentBlock: { flex: 1, justifyContent: 'center' },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    
    leftColumn: { flex: 1, paddingRight: 8, justifyContent: 'center' },
    
    timeText: { 
        fontSize: 18, 
        fontFamily: 'Nunito_700Bold', 
        letterSpacing: -0.3, 
        marginBottom: 6 
    },
    
    tagsContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, position: 'relative' },
    tagBadge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    tagText: { fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    
    tooltipBubble: { 
        position: 'absolute', 
        top: -30, 
        left: 0, 
        paddingHorizontal: 10, 
        paddingVertical: 6, 
        borderRadius: 8, 
        zIndex: 10,
        elevation: 4
    },
    tooltipText: { fontSize: 11, fontFamily: 'Nunito_700Bold' },

    metricsColumn: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 50 },
    taskInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metricText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
    
    actionZone: { paddingLeft: 8, justifyContent: 'center' }
});

export default React.memo(ReportItem);