// filepath: components/ReportItem.tsx
import {
    Alert02Icon,
    ArrowRight01Icon,
    CloudSavingDone01Icon,
    CloudUploadIcon,
    Rocket01Icon,
    Target02Icon,
    Task01Icon,
    Time04Icon
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

type TagItem = {
    id: string;
    color: string;
    tooltip: string;
    text?: string;
    icon?: any;
};

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
        if (!hasAttendance) return { durationText: '0h', isOvertime: false, isEarly: false, isGoalMet: false, earliestIn: null, latestOut: null };
        
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
            if (diff < 0) diff = 0; 
            
            if (a.remarks && a.remarks.includes('BreakMs:')) {
                const match = a.remarks.match(/BreakMs:(\d+)/);
                if (match) diff -= Math.floor(parseInt(match[1], 10) / 60000);
            }
            totalMins += Math.max(0, diff);
        });

        const hours = Math.floor(totalMins / 60);
        const minutes = totalMins % 60;
        const isGoal = totalMins >= 480; 
        
        const formattedDuration = totalMins > 0 ? `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`.trim() : '0h';

        let earlyTag = false;
        let otTag = false;

        if (job?.work_schedule) {
            const ws = typeof job.work_schedule === 'string' ? JSON.parse(job.work_schedule) : job.work_schedule;
            
            if (ws?.start && firstIn) {
                const [h, m_] = ws.start.split(':').map(Number);
                const shiftStartMins = h * 60 + m_;
                const inMins = firstIn.getHours() * 60 + firstIn.getMinutes();
                if (inMins < shiftStartMins) earlyTag = true;
            }

            const validLastOut = lastOut as Date | null;
            if (ws?.end && validLastOut) {
                const [h, m_] = ws.end.split(':').map(Number);
                const shiftEndMins = h * 60 + m_;
                const outMins = validLastOut.getHours() * 60 + validLastOut.getMinutes();
                if (outMins > shiftEndMins) otTag = true;
            }
        } else {
            if (totalMins > 540) otTag = true;
        }

        return {
            durationText: formattedDuration, 
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

    const renderTags = () => {
        const activeTags: TagItem[] = [];
        
        if (isEarly) activeTags.push({ id: 'early', icon: Rocket01Icon, color: theme.colors.success, tooltip: "Clocked in Early" });
        if (isCompleted && isOvertime) activeTags.push({ id: 'ot', text: 'OT', color: theme.colors.warning, tooltip: "Overtime Logged" });
        if (isCompleted && isGoalMet && !isOvertime && !isEarly) activeTags.push({ id: 'goal', icon: Target02Icon, color: theme.colors.success, tooltip: "Target Goal Reached" });
        if (hasAttendance) activeTags.push({ id: 'sync', icon: isSynced ? CloudSavingDone01Icon : CloudUploadIcon, color: isSynced ? theme.colors.primary : theme.colors.danger, tooltip: isSynced ? "Synced to Cloud" : "Pending Sync" });
        else activeTags.push({ id: 'absent', icon: Alert02Icon, color: theme.colors.danger, tooltip: absentTooltip });

        return (
            <View style={styles.tagsContainer}>
                <View style={[styles.tagsGrid, activeTags.length === 4 ? { alignContent: 'center', justifyContent: 'center' } : { alignContent: 'flex-start', justifyContent: 'flex-end' }]}>
                    {activeTags.map(t => (
                        <TouchableOpacity 
                            key={t.id} 
                            activeOpacity={0.6} 
                            onLongPress={() => handleShowTooltip(t.tooltip)} 
                            delayLongPress={200}
                            style={[styles.tagBadge, { backgroundColor: t.color + '15' }]}
                        >
                            {t.text ? (
                                <Text style={[styles.tagText, { color: t.color }]}>{t.text}</Text>
                            ) : t.icon ? (
                                <HugeiconsIcon icon={t.icon} size={12} color={t.color} />
                            ) : null}
                        </TouchableOpacity>
                    ))}
                </View>

                {activeTooltip && (
                    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.tooltipBubble, { backgroundColor: theme.colors.text }]}>
                        <Text style={[styles.tooltipText, { color: theme.colors.card }]}>{activeTooltip}</Text>
                    </Animated.View>
                )}
            </View>
        );
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
                                <Text style={[styles.timeText, { color: theme.colors.text }]} numberOfLines={1}>
                                    {format(earliestIn as Date, 'h:mm a')} 
                                    <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium' }}> → </Text> 
                                    {isCompleted && latestOut ? format(latestOut as Date, 'h:mm a') : 'Now'}
                                </Text>
                            ) : (
                                <Text style={[styles.timeText, { color: theme.colors.danger }]} numberOfLines={1}>
                                    {absentLabel}
                                </Text>
                            )}

                            <View style={styles.metricsRow}>
                                <View style={styles.taskInline}>
                                    <HugeiconsIcon icon={Task01Icon} size={14} color={theme.colors.textSecondary} />
                                    <Text style={[styles.metricText, { color: theme.colors.textSecondary }]}>
                                        {taskCount} {taskCount === 1 ? 'Entry' : 'Entries'}
                                    </Text>
                                </View>
                                
                                <View style={[styles.taskInline, { marginLeft: 16 }]}>
                                    <HugeiconsIcon icon={Time04Icon} size={14} color={hasAttendance ? theme.colors.textSecondary : 'transparent'} />
                                    <Text style={[styles.metricText, { color: hasAttendance ? theme.colors.textSecondary : 'transparent' }]}>
                                        {hasAttendance ? durationText : '0h'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.rightColumn}>
                            {renderTags()}
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
    },
    touchable: { flexDirection: 'row', padding: 8, alignItems: 'center' },
    
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
    topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    
    leftColumn: { flex: 1, paddingRight: 4, justifyContent: 'flex-start', zIndex: 1 },
    
    timeText: { 
        fontSize: 16, 
        fontFamily: 'Nunito_800ExtraBold', 
        letterSpacing: -0.3, 
        marginBottom: 6,
    },

    metricsRow: { flexDirection: 'row', alignItems: 'center' },
    taskInline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metricText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
    
    rightColumn: { width: 52, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2, zIndex: 10 },
    tagsContainer: { position: 'relative', zIndex: 10 },
    tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 52, gap: 4, minHeight: 24 },
    tagBadge: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    tagText: { fontSize: 9, fontFamily: 'Nunito_800ExtraBold' },
    
    tooltipBubble: { 
        position: 'absolute', 
        right: 60, 
        top: 0,
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 8, 
        zIndex: 9999,
        elevation: 10,
        flexDirection: 'row', 
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    tooltipText: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold' },
    
    actionZone: { paddingLeft: 8, justifyContent: 'center' }
});

export default React.memo(ReportItem);