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
    const theme = useAppTheme(); // Hook for theme colors
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [sessionIndex, setSessionIndex] = useState(0);

    useEffect(() => {
        setSessionIndex(0);
    }, [selectedDate]);

    // Generate fixed 6-week grid (42 days)
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
            <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.arrowBtn}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={theme.colors.icon} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                    {format(currentMonth, 'MMMM yyyy')}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.arrowBtn}>
                    <HugeiconsIcon icon={ArrowRight02Icon} size={20} color={theme.colors.icon} />
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
                                    style={[
                                        styles.dayBtn,
                                        isSelected && { backgroundColor: theme.colors.primary },
                                        !isSelected && isTodayDate && { backgroundColor: theme.colors.primaryLight, borderWidth: 1, borderColor: theme.colors.primary }
                                    ]}
                                >
                                    <Text style={[
                                        styles.dayText,
                                        isSelected && styles.selectedText,
                                        !isSelected && { color: theme.colors.text },
                                        !isSelected && isTodayDate && { color: theme.colors.primary },
                                        !isCurrentMonth && { color: theme.colors.border }
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
            <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <View style={styles.footerHeader}>
                    <Text style={[styles.footerTitle, { color: theme.colors.textSecondary }]}>
                        {format(selectedDate, 'EEEE, MMMM d')}
                    </Text>

                    {showDetails && selectedRecords.length > 1 && (
                        <View style={[styles.navContainer, { backgroundColor: theme.colors.iconBg }]}>
                            <TouchableOpacity 
                                onPress={() => setSessionIndex(prev => Math.max(0, prev - 1))}
                                disabled={sessionIndex === 0}
                                style={[styles.navBtn, sessionIndex === 0 && styles.navBtnDisabled]}
                            >
                                <HugeiconsIcon icon={ArrowLeft02Icon} size={16} color={sessionIndex === 0 ? theme.colors.border : theme.colors.icon} />
                            </TouchableOpacity>
                            <Text style={[styles.navText, { color: theme.colors.textSecondary }]}>
                                {sessionIndex + 1} / {selectedRecords.length}
                            </Text>
                            <TouchableOpacity 
                                onPress={() => setSessionIndex(prev => Math.min(selectedRecords.length - 1, prev + 1))}
                                disabled={sessionIndex === selectedRecords.length - 1}
                                style={[styles.navBtn, sessionIndex === selectedRecords.length - 1 && styles.navBtnDisabled]}
                            >
                                <HugeiconsIcon icon={ArrowRight02Icon} size={16} color={sessionIndex === selectedRecords.length - 1 ? theme.colors.border : theme.colors.icon} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                
                {/* Only show details if enabled */}
                {showDetails && (
                    currentRecord ? (
                        <View style={styles.detailsRow}>
                            <View style={[styles.detailCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.successLight }]}>
                                <Text style={[styles.label, { color: theme.colors.success }]}>Check In</Text>
                                <View style={styles.timeRow}>
                                    <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.success} />
                                    <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                        {format(new Date(currentRecord.clock_in), 'hh:mm a')}
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.detailCard, { backgroundColor: theme.colors.card, borderColor: currentRecord.clock_out ? theme.colors.successLight : theme.colors.dangerLight }]}>
                                <Text style={[styles.label, { color: currentRecord.clock_out ? theme.colors.success : theme.colors.warning }]}>
                                    {currentRecord.clock_out ? 'Check Out' : 'Status'}
                                </Text>
                                <View style={styles.timeRow}>
                                    <HugeiconsIcon icon={currentRecord.clock_out ? Clock01Icon : AlertCircleIcon} size={14} color={currentRecord.clock_out ? theme.colors.success : theme.colors.warning} />
                                    <Text style={[styles.timeText, !currentRecord.clock_out && { color: theme.colors.warning, fontStyle: 'italic' }, { color: currentRecord.clock_out ? theme.colors.text : theme.colors.warning }]}>
                                        {currentRecord.clock_out ? format(new Date(currentRecord.clock_out), 'hh:mm a') : 'Pending Out'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No attendance for selected date.</Text>
                        </View>
                    )
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    arrowBtn: {
        padding: 8,
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
        padding: 2,
    },
    dayBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
    },
    selectedText: {
        color: 'white',
    },
    weekdayText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    dayText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    dot: {
        position: 'absolute',
        bottom: 6,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
    },
    footerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 0,
    },
    footerTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12, 
    },
    navContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 2,
        marginBottom: 12,
    },
    navBtn: {
        padding: 4,
    },
    navBtnDisabled: {
        opacity: 0.5,
    },
    navText: {
        fontSize: 10,
        fontWeight: 'bold',
        marginHorizontal: 8,
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    detailCard: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    label: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontWeight: 'bold' },
    emptyState: { alignItems: 'center', paddingVertical: 8 },
    emptyText: { fontWeight: '500' },
});