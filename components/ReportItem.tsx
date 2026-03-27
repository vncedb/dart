// filepath: components/ReportItem.tsx
import {
    Alert02Icon,
    ArrowRight01Icon,
    File02Icon,
    CloudSavingDone01Icon,
    CloudUploadIcon,
    Rocket01Icon,
    Target02Icon,
    Task01Icon,
    Time04Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';
import { summarizeAttendances } from '../lib/report-helpers';
import InfoTooltip from './InfoTooltip'; // Ensure the path is correct

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

const ReportItem = ({
    item,
    job,
    onPress
}: ReportItemProps) => {
    const theme = useAppTheme();

    const attendances = useMemo(() => item.attendances || [], [item.attendances]);
    
    const hasAttendance = attendances.length > 0;
    const isCompleted = hasAttendance && attendances.every((a: any) => a.clock_out);
    
    const [y, m, d] = item.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    const isSynced = item.is_synced === 1 || item.is_synced === true || item.is_synced === 'true';
    const taskCount = item.accomplishments?.length || 0;

    const { durationText, isOvertime, isEarly, isGoalMet, earliestIn, latestOut } = useMemo(() => {
        if (!hasAttendance) return { durationText: '0h', isOvertime: false, isEarly: false, isGoalMet: false, earliestIn: null, latestOut: null };
        const summary = summarizeAttendances(attendances, 'exact_hm', { breakSchedule: job?.break_schedule });
        const totalMins = summary.totalMinutes;
        const firstIn = summary.earliestClockIn ? new Date(summary.earliestClockIn) : new Date(attendances[0].clock_in);
        const lastOut = summary.latestClockOut ? new Date(summary.latestClockOut) : null;

        const hours = Math.floor(totalMins / 60);
        const minutes = totalMins % 60;
        const goalMinutes = (() => {
            if (!job?.work_schedule) return 480;
            const schedule = typeof job.work_schedule === 'string' ? JSON.parse(job.work_schedule) : job.work_schedule;
            const breaks = typeof job.break_schedule === 'string' ? JSON.parse(job.break_schedule) : job.break_schedule;
            const toMinutes = (value: string) => {
                const [h, m] = String(value || '').split(':').map(Number);
                return (h || 0) * 60 + (m || 0);
            };
            let workMinutes = toMinutes(schedule?.end) - toMinutes(schedule?.start);
            if (workMinutes < 0) workMinutes += 24 * 60;
            let breakMinutes = 0;
            if (Array.isArray(breaks)) {
                breakMinutes = breaks.reduce((sum: number, current: any) => {
                    let minutes = toMinutes(current?.end) - toMinutes(current?.start);
                    if (minutes < 0) minutes += 24 * 60;
                    return sum + Math.max(0, minutes);
                }, 0);
            }
            return Math.max(0, workMinutes - breakMinutes) || 480;
        })();
        const isGoal = totalMins >= goalMinutes; 
        
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

    const renderTags = () => {
        const activeTags: TagItem[] = [];
        
        if (isEarly) activeTags.push({ id: 'early', icon: Rocket01Icon, color: theme.colors.success, tooltip: "Clocked in Early" });
        if (isCompleted && isOvertime) activeTags.push({ id: 'ot', text: 'OT', color: theme.colors.warning, tooltip: "Overtime Logged" });
        if (isCompleted && isGoalMet && !isOvertime) activeTags.push({ id: 'goal', icon: Target02Icon, color: theme.colors.success, tooltip: "Target Goal Reached" });
        if ((item.generatedReports || 0) > 0) activeTags.push({ id: 'generated', icon: File02Icon, color: theme.colors.primary, tooltip: `${item.generatedReports} generated report${item.generatedReports === 1 ? '' : 's'} saved for this date` });
        if (hasAttendance) activeTags.push({ id: 'sync', icon: isSynced ? CloudSavingDone01Icon : CloudUploadIcon, color: isSynced ? theme.colors.primary : theme.colors.danger, tooltip: isSynced ? "Synced to Cloud" : "Pending Sync" });
        else activeTags.push({ id: 'absent', icon: Alert02Icon, color: theme.colors.danger, tooltip: absentTooltip });

        return (
            <View style={styles.tagsContainer}>
                <View style={[styles.tagsGrid, activeTags.length === 4 ? { alignContent: 'center', justifyContent: 'center' } : { alignContent: 'flex-start', justifyContent: 'flex-end' }]}>
                    {activeTags.map(t => (
                        <InfoTooltip key={t.id} text={t.tooltip}>
                            {/* Inner View replaces the old TouchableOpacity */}
                            <View style={[styles.tagBadge, { backgroundColor: t.color + '15' }]}>
                                {t.text ? (
                                    <Text style={[styles.tagText, { color: t.color }]}>{t.text}</Text>
                                ) : t.icon ? (
                                    <HugeiconsIcon icon={t.icon} size={12} color={t.color} />
                                ) : null}
                            </View>
                        </InfoTooltip>
                    ))}
                </View>
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
        // Ensure overflow is visible so tooltips don't get clipped
        overflow: 'visible'
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
    
    actionZone: { paddingLeft: 8, justifyContent: 'center' }
});

export default React.memo(ReportItem);
