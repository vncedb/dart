import {
    AlertCircleIcon,
    ArrowLeft02Icon,
    ArrowRight02Icon,
    Clock01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
    addDays,
    addMonths,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek,
    subMonths
} from 'date-fns';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

type AttendanceRecord = { 
    id: string; 
    clock_in: string; 
    clock_out: string | null; 
    date: string; 
};

interface AttendanceCalendarProps {
    records: AttendanceRecord[];
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    onMonthChange: (date: Date) => void;
    showIndicators?: boolean;
    showDetails?: boolean; 
}

export default function AttendanceCalendar({ 
    records, 
    selectedDate, 
    onSelectDate, 
    onMonthChange,
    showIndicators = true,
    showDetails = true 
}: AttendanceCalendarProps) {
    const theme = useAppTheme();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [sessionIndex, setSessionIndex] = useState(0);

    useEffect(() => {
        setSessionIndex(0);
    }, [selectedDate]);

    // Generate fixed 6-week grid
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart); 
    
    const calendarDays = [];
    let day = startDate;
    for (let i = 0; i < 42; i++) {
        calendarDays.push(day);
        day = addDays(day, 1);
    }

    const handlePrevMonth = () => {
        const newDate = subMonths(currentMonth, 1);
        setCurrentMonth(newDate);
        onMonthChange(newDate);
    };

    const handleNextMonth = () => {
        const newDate = addMonths(currentMonth, 1);
        setCurrentMonth(newDate);
        onMonthChange(newDate);
    };

    const getRecordsForDay = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return records
            .filter(r => r.date === dayStr)
            .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
    };

    const selectedRecords = getRecordsForDay(selectedDate);
    const currentRecord = selectedRecords[sessionIndex] || null;

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
            
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={handlePrevMonth} style={[styles.arrowBtn, { backgroundColor: theme.colors.background }]}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                    {format(currentMonth, 'MMMM yyyy')}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={[styles.arrowBtn, { backgroundColor: theme.colors.background }]}>
                    <HugeiconsIcon icon={ArrowRight02Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {/* Grid */}
            <View style={styles.gridContainer}>
                <View style={styles.row}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <View key={i} style={styles.dayCell}>
                            <Text style={[styles.weekdayText, { color: theme.colors.textSecondary }]}>{day}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.daysContainer}>
                    {calendarDays.map((dayItem, i) => {
                        const isSelected = isSameDay(dayItem, selectedDate);
                        const isCurrentMonth = isSameMonth(dayItem, currentMonth);
                        const isTodayDate = isToday(dayItem);
                        
                        const dayRecords = getRecordsForDay(dayItem);
                        const hasRecord = dayRecords.length > 0;
                        const isPending = dayRecords.some(r => !r.clock_out);

                        return (
                            <View key={i} style={styles.dayCellWrapper}>
                                <TouchableOpacity 
                                    onPress={() => onSelectDate(dayItem)}
                                    activeOpacity={0.7}
                                    style={[
                                        styles.dayBtn,
                                        isSelected && { backgroundColor: theme.colors.primary },
                                        !isSelected && isTodayDate && { borderWidth: 1.5, borderColor: theme.colors.primary }
                                    ]}
                                >
                                    <Text style={[
                                        styles.dayText,
                                        isSelected && styles.selectedText,
                                        !isSelected && { color: theme.colors.text },
                                        !isSelected && isTodayDate && { color: theme.colors.primary, fontWeight: '800' },
                                        !isCurrentMonth && { color: theme.colors.border, opacity: 0.5 }
                                    ]}>
                                        {format(dayItem, 'd')}
                                    </Text>
                                    
                                    {showIndicators && hasRecord && !isSelected && isCurrentMonth && (
                                        <View style={[
                                            styles.dot, 
                                            { backgroundColor: !isPending ? theme.colors.success : theme.colors.warning }
                                        ]} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Footer Details */}
            {showDetails && (
                <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background + '80' }]}>
                    <View style={styles.footerHeader}>
                        <Text style={[styles.footerTitle, { color: theme.colors.textSecondary }]}>
                            {format(selectedDate, 'EEEE, MMMM d')}
                        </Text>

                        {selectedRecords.length > 1 && (
                            <View style={[styles.navContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <TouchableOpacity 
                                    onPress={() => setSessionIndex(prev => Math.max(0, prev - 1))}
                                    disabled={sessionIndex === 0}
                                    style={[styles.navBtn, sessionIndex === 0 && styles.navBtnDisabled]}
                                >
                                    <HugeiconsIcon icon={ArrowLeft02Icon} size={14} color={theme.colors.text} />
                                </TouchableOpacity>
                                <Text style={[styles.navText, { color: theme.colors.textSecondary }]}>
                                    Session {sessionIndex + 1}
                                </Text>
                                <TouchableOpacity 
                                    onPress={() => setSessionIndex(prev => Math.min(selectedRecords.length - 1, prev + 1))}
                                    disabled={sessionIndex === selectedRecords.length - 1}
                                    style={[styles.navBtn, sessionIndex === selectedRecords.length - 1 && styles.navBtnDisabled]}
                                >
                                    <HugeiconsIcon icon={ArrowRight02Icon} size={14} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    
                    {currentRecord ? (
                        <View style={styles.detailsRow}>
                            <View style={[styles.detailCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <Text style={[styles.label, { color: theme.colors.success }]}>TIME IN</Text>
                                <View style={styles.timeRow}>
                                    <HugeiconsIcon icon={Clock01Icon} size={16} color={theme.colors.success} />
                                    <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                        {format(new Date(currentRecord.clock_in), 'h:mm a')}
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.detailCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <Text style={[styles.label, { color: currentRecord.clock_out ? theme.colors.primary : theme.colors.warning }]}>
                                    {currentRecord.clock_out ? 'TIME OUT' : 'STATUS'}
                                </Text>
                                <View style={styles.timeRow}>
                                    <HugeiconsIcon 
                                        icon={currentRecord.clock_out ? Clock01Icon : AlertCircleIcon} 
                                        size={16} 
                                        color={currentRecord.clock_out ? theme.colors.primary : theme.colors.warning} 
                                    />
                                    <Text style={[
                                        styles.timeText, 
                                        { color: currentRecord.clock_out ? theme.colors.text : theme.colors.warning },
                                        !currentRecord.clock_out && { fontStyle: 'italic', fontSize: 13 }
                                    ]}>
                                        {currentRecord.clock_out ? format(new Date(currentRecord.clock_out), 'h:mm a') : 'Ongoing'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={[styles.emptyDot, { backgroundColor: theme.colors.border }]} />
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No records found.</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    arrowBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridContainer: {
        padding: 16,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 32,
    },
    dayCellWrapper: {
        width: '14.28%', 
        aspectRatio: 1,
        padding: 3,
    },
    dayBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    selectedText: {
        color: 'white',
        fontWeight: '800',
    },
    weekdayText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        opacity: 0.6,
    },
    dayText: {
        fontSize: 14,
        fontWeight: '600',
    },
    dot: {
        position: 'absolute',
        bottom: 5,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
    },
    footerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    footerTitle: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    navContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        gap: 8,
    },
    navBtn: {
        padding: 4,
    },
    navBtnDisabled: {
        opacity: 0.3,
    },
    navText: {
        fontSize: 11,
        fontWeight: '600',
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    detailCard: {
        flex: 1,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    label: { 
        fontSize: 10, 
        fontWeight: '800', 
        letterSpacing: 0.5, 
        marginBottom: 6 
    },
    timeRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 8 
    },
    timeText: { 
        fontWeight: '700',
        fontSize: 15,
    },
    emptyState: { 
        flexDirection: 'row',
        alignItems: 'center', 
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 8
    },
    emptyDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    emptyText: { 
        fontWeight: '500',
        fontSize: 13
    },
});