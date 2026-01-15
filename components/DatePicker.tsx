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
import Button from './Button';
import ModalHeader from './ModalHeader';

interface DatePickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    selectedDate?: Date;
    title?: string;
}

type ViewMode = 'calendar' | 'month' | 'year';

export default function DatePicker({ 
    visible, 
    onClose, 
    onSelect, 
    selectedDate = new Date(),
    title = "Select Date"
}: DatePickerProps) {
    const theme = useAppTheme();
    // Local state for selection before confirming
    const [tempDate, setTempDate] = useState(new Date(selectedDate));
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
    const [viewMode, setViewMode] = useState<ViewMode>('calendar');

    // Months & Years Data
    const months = Array.from({ length: 12 }, (_, i) => new Date(0, i));
    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 50;
        return Array.from({ length: 100 }, (_, i) => startYear + i);
    }, []);

    useEffect(() => {
        if (visible) {
            setTempDate(new Date(selectedDate));
            setCurrentMonth(new Date(selectedDate));
            setViewMode('calendar');
        }
    }, [visible, selectedDate]);

    // Calendar Logic
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const startDate = startOfWeek(monthStart);
        const endDate = addDays(startDate, 41);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonth]);

    const handleConfirm = () => {
        onSelect(tempDate);
        onClose();
    };

    const renderCalendar = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.weekHeader}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <Text key={day} style={[styles.weekText, { color: theme.colors.textSecondary }]}>{day}</Text>
                ))}
            </View>
            <View style={styles.daysGrid}>
                {calendarDays.map((day) => {
                    const isSelected = isSameDay(day, tempDate);
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <TouchableOpacity
                            key={day.toISOString()}
                            onPress={() => setTempDate(day)} // Update local state only
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
                                    isSelected && { color: '#fff', fontWeight: '800' },
                                    !isSelected && isToday && { color: theme.colors.primary, fontWeight: '700' }
                                ]}>
                                    {format(day, 'd')}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderMonths = () => (
        <View style={styles.monthGrid}>
            {months.map((m, i) => {
                const isSelected = m.getMonth() === currentMonth.getMonth();
                return (
                    <TouchableOpacity
                        key={i}
                        style={[
                            styles.monthItem,
                            isSelected && { backgroundColor: theme.colors.primary },
                            !isSelected && { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border }
                        ]}
                        onPress={() => {
                            setCurrentMonth(setMonth(currentMonth, i));
                            setViewMode('calendar');
                        }}
                    >
                        <Text style={[styles.monthText, { color: isSelected ? '#fff' : theme.colors.text }]}>
                            {format(m, 'MMM')}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderYears = () => (
        <FlatList
            data={years}
            keyExtractor={(item) => item.toString()}
            initialScrollIndex={years.indexOf(currentMonth.getFullYear())}
            getItemLayout={(_, index) => ({ length: 56, offset: 56 * index, index })}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={({ item }) => {
                const isSelected = item === currentMonth.getFullYear();
                return (
                    <TouchableOpacity
                        style={[
                            styles.yearItem,
                            isSelected && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }
                        ]}
                        onPress={() => {
                            setCurrentMonth(setYear(currentMonth, item));
                            setViewMode('calendar');
                        }}
                    >
                        <Text style={[
                            styles.yearText,
                            { color: isSelected ? theme.colors.primary : theme.colors.text },
                            isSelected && { fontWeight: '800' }
                        ]}>
                            {item}
                        </Text>
                    </TouchableOpacity>
                );
            }}
        />
    );

    const renderNavigation = () => (
        <View style={styles.navBar}>
            {viewMode === 'calendar' ? (
                <TouchableOpacity onPress={() => setCurrentMonth(subMonths(currentMonth, 1))} style={[styles.navBtn, { backgroundColor: theme.colors.background }]}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
            ) : <View style={{ width: 36 }} />}

            <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setViewMode(viewMode === 'month' ? 'calendar' : 'month')} style={styles.dropdownBtn}>
                    <Text style={[styles.dropdownText, { color: theme.colors.text }]}>{format(currentMonth, 'MMMM')}</Text>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode(viewMode === 'year' ? 'calendar' : 'year')} style={styles.dropdownBtn}>
                    <Text style={[styles.dropdownText, { color: theme.colors.text }]}>{format(currentMonth, 'yyyy')}</Text>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {viewMode === 'calendar' ? (
                <TouchableOpacity onPress={() => setCurrentMonth(addMonths(currentMonth, 1))} style={[styles.navBtn, { backgroundColor: theme.colors.background }]}>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
            ) : <View style={{ width: 36 }} />}
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.container, { backgroundColor: theme.colors.card }]} onPress={(e) => e.stopPropagation()}>
                    
                    {/* CENTER MODAL: No Close Button */}
                    <ModalHeader title={title} />

                    {renderNavigation()}

                    <View style={styles.content}>
                        {viewMode === 'calendar' && renderCalendar()}
                        {viewMode === 'month' && renderMonths()}
                        {viewMode === 'year' && renderYears()}
                    </View>

                    {/* Footer: Cancel + Confirm */}
                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <Button 
                            title="Cancel" 
                            variant="neutral" 
                            onPress={onClose} 
                            style={{ flex: 1 }} 
                        />
                        <View style={{ width: 12 }} />
                        <Button 
                            title="Confirm" 
                            variant="primary" 
                            onPress={handleConfirm} 
                            style={{ flex: 1 }} 
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    container: { width: '100%', maxWidth: 360, borderRadius: 28, overflow: 'hidden', elevation: 10 },
    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    navBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    dropdownBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
    dropdownText: { fontSize: 15, fontWeight: '700' },
    content: { height: 340, paddingHorizontal: 16 },
    weekHeader: { flexDirection: 'row', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    weekText: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    dayText: { fontSize: 15, fontWeight: '500' },
    monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingTop: 12 },
    monthItem: { width: '31%', aspectRatio: 1.6, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderRadius: 16 },
    monthText: { fontSize: 14, fontWeight: '700' },
    yearItem: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, marginVertical: 3, borderWidth: 1 },
    yearText: { fontSize: 16, fontWeight: '600' },
    footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1 }
});