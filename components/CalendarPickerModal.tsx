import {
    ArrowDown01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    format,
    isSameDay,
    isSameMonth,
    setMonth,
    setYear,
    startOfMonth,
    startOfWeek,
    subMonths
} from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAppTheme } from '../constants/theme';

interface CalendarPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    selectedDate?: Date;
}

type ViewMode = 'calendar' | 'month' | 'year';

export default function CalendarPickerModal({ visible, onClose, onSelect, selectedDate = new Date() }: CalendarPickerModalProps) {
    const theme = useAppTheme();
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
    const [viewMode, setViewMode] = useState<ViewMode>('calendar');

    // Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setCurrentMonth(new Date(selectedDate));
            setViewMode('calendar');
        }
    }, [visible, selectedDate]);

    // --- CALENDAR LOGIC (Fixed 6 Weeks) ---
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const startDate = startOfWeek(monthStart);
        const endDate = addDays(startDate, 41);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonth]);

    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const handleDateSelect = (date: Date) => {
        onSelect(date);
        onClose();
    };

    // --- MONTH/YEAR DATA ---
    const months = Array.from({ length: 12 }, (_, i) => new Date(0, i));
    const generateYears = () => {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 50;
        return Array.from({ length: 100 }, (_, i) => startYear + i);
    };
    const years = useMemo(generateYears, []);

    // --- RENDERERS ---
    const renderHeader = () => (
        <View style={styles.header}>
            {viewMode === 'calendar' ? (
                <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))} style={styles.navButton}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={theme.colors.text} />
                </TouchableOpacity>
            ) : (
                <View style={{ width: 36 }} /> 
            )}

            <View style={styles.headerTitleContainer}>
                <TouchableOpacity 
                    style={[styles.dropdownButton, viewMode === 'month' && styles.dropdownActive]}
                    onPress={() => setViewMode(viewMode === 'month' ? 'calendar' : 'month')}
                >
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                        {format(currentMonth, 'MMMM')}
                    </Text>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.dropdownButton, viewMode === 'year' && styles.dropdownActive]}
                    onPress={() => setViewMode(viewMode === 'year' ? 'calendar' : 'year')}
                >
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                        {format(currentMonth, 'yyyy')}
                    </Text>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {viewMode === 'calendar' ? (
                <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))} style={styles.navButton}>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.text} />
                </TouchableOpacity>
            ) : (
                <View style={{ width: 36 }} />
            )}
        </View>
    );

    const renderCalendarView = () => (
        <>
            <View style={styles.weekDaysRow}>
                {weekDays.map((day) => (
                    <Text key={day} style={[styles.weekDayText, { color: theme.colors.textSecondary }]}>
                        {day}
                    </Text>
                ))}
            </View>
            <View style={styles.daysGrid}>
                {calendarDays.map((day) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <TouchableOpacity
                            key={day.toISOString()}
                            onPress={() => handleDateSelect(day)}
                            style={styles.dayCell}
                        >
                            <View style={[
                                styles.dayCircle,
                                isSelected && { backgroundColor: theme.colors.primary },
                                !isSelected && isToday && { borderWidth: 1, borderColor: theme.colors.primary }
                            ]}>
                                <Text style={[
                                    styles.dayText,
                                    { color: isCurrentMonth ? theme.colors.text : theme.colors.textSecondary },
                                    isSelected && { color: '#fff', fontWeight: 'bold' },
                                    !isSelected && isToday && { color: theme.colors.primary, fontWeight: 'bold' }
                                ]}>
                                    {format(day, 'd')}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </>
    );

    const renderMonthSelector = () => (
        <View style={styles.selectorGrid}>
            {months.map((m, i) => (
                <TouchableOpacity
                    key={i}
                    style={[
                        styles.selectorItem, 
                        m.getMonth() === currentMonth.getMonth() && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary, borderWidth: 1 }
                    ]}
                    onPress={() => {
                        setCurrentMonth(setMonth(currentMonth, i));
                        setViewMode('calendar');
                    }}
                >
                    <Text style={[
                        styles.selectorText, 
                        { color: theme.colors.text },
                        m.getMonth() === currentMonth.getMonth() && { color: theme.colors.primary, fontWeight: 'bold' }
                    ]}>
                        {format(m, 'MMM')}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderYearSelector = () => (
        <FlatList
            data={years}
            keyExtractor={(item) => item.toString()}
            initialScrollIndex={years.indexOf(currentMonth.getFullYear())}
            getItemLayout={(data, index) => ({ length: 58, offset: 58 * index, index })}
            contentContainerStyle={{ paddingVertical: 10 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={[
                        styles.yearItem,
                        item === currentMonth.getFullYear() && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary, borderWidth: 1 }
                    ]}
                    onPress={() => {
                        setCurrentMonth(setYear(currentMonth, item));
                        setViewMode('calendar');
                    }}
                >
                    <Text style={[
                        styles.yearText,
                        { color: theme.colors.text },
                        item === currentMonth.getFullYear() && { color: theme.colors.primary, fontWeight: 'bold', fontSize: 18 }
                    ]}>
                        {item}
                    </Text>
                </TouchableOpacity>
            )}
        />
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card }]} onPress={(e) => e.stopPropagation()}>
                    {renderHeader()}
                    
                    <View style={styles.contentContainer}>
                        {viewMode === 'calendar' && renderCalendarView()}
                        {viewMode === 'month' && renderMonthSelector()}
                        {viewMode === 'year' && renderYearSelector()}
                    </View>

                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Text style={[styles.closeButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        padding: 20,
        height: 480, // FIXED HEIGHT
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        height: 44,
    },
    headerTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    dropdownActive: {
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    navButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
    },
    contentContainer: {
        flex: 1,
    },
    weekDaysRow: {
        flexDirection: 'row',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        paddingBottom: 8,
    },
    weekDayText: {
        width: '14.28%',
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '600',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        fontSize: 14,
    },
    selectorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingTop: 10,
    },
    selectorItem: {
        width: '30%',
        aspectRatio: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    selectorText: {
        fontSize: 14,
        fontWeight: '600',
    },
    yearItem: {
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        marginVertical: 4,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    yearText: {
        fontSize: 16,
        fontWeight: '500',
    },
    closeButton: {
        alignItems: 'center',
        marginTop: 16,
        paddingVertical: 8,
    },
    closeButtonText: {
        fontWeight: '600',
        fontSize: 14,
    },
});