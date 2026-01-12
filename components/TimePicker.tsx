import { Cancel01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import Button from './Button';

type PickerMode = 'duration' | 'time';

interface TimePickerProps {
    visible: boolean;
    mode?: PickerMode;
    onClose: () => void;
    onConfirm: (hours: number, minutes: number, period?: 'AM' | 'PM') => void;
    title?: string;
    initialHours?: number;
    initialMinutes?: number;
    initialPeriod?: 'AM' | 'PM';
}

const ITEM_HEIGHT = 50;

export default function TimePicker({
    visible,
    mode = 'time',
    onClose,
    onConfirm,
    title,
    initialHours = 0,
    initialMinutes = 0,
    initialPeriod = 'PM',
}: TimePickerProps) {
    const theme = useAppTheme();
    
    // Normalize initial values
    const startHour = mode === 'time' ? (initialHours === 0 ? 12 : initialHours > 12 ? initialHours - 12 : initialHours) : initialHours;
    
    const [selectedHour, setSelectedHour] = useState(startHour);
    const [selectedMinute, setSelectedMinute] = useState(initialMinutes);
    const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initialPeriod || 'PM');

    useEffect(() => {
        if (visible) {
            setSelectedHour(startHour);
            setSelectedMinute(initialMinutes);
            setSelectedPeriod(initialPeriod || 'PM');
        }
    }, [visible]);

    // Data Arrays
    const hours = mode === 'time' 
        ? Array.from({ length: 12 }, (_, i) => i + 1) // 1-12
        : Array.from({ length: 24 }, (_, i) => i);    // 0-23
        
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const periods = ['AM', 'PM'];

    const renderItem = ({ item, type }: { item: string | number; type: 'hour' | 'minute' | 'period' }) => {
        let isSelected = false;
        if (type === 'hour') isSelected = item === selectedHour;
        if (type === 'minute') isSelected = item === selectedMinute;
        if (type === 'period') isSelected = item === selectedPeriod;

        return (
            <View style={[styles.pickerItem, { height: ITEM_HEIGHT }]}>
                <Text style={[
                    styles.pickerText, 
                    { 
                        color: isSelected ? theme.colors.primary : theme.colors.textSecondary,
                        fontSize: isSelected ? 22 : 18,
                        fontWeight: isSelected ? '700' : '400',
                        opacity: isSelected ? 1 : 0.5
                    }
                ]}>
                    {type === 'minute' ? item.toString().padStart(2, '0') : item}
                </Text>
            </View>
        );
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>, type: 'hour' | 'minute' | 'period') => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        
        if (type === 'hour') {
            if (index >= 0 && index < hours.length) setSelectedHour(hours[index]);
        } else if (type === 'minute') {
            if (index >= 0 && index < minutes.length) setSelectedMinute(minutes[index]);
        } else if (type === 'period') {
            if (index >= 0 && index < periods.length) setSelectedPeriod(periods[index] as 'AM' | 'PM');
        }
    };

    const getItemLayout = (_: any, index: number) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
    });

    const handleConfirm = () => {
        onConfirm(selectedHour, selectedMinute, selectedPeriod);
        onClose();
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={onClose} animationType="none" statusBarTranslucent>
            <View style={styles.overlay}>
                <Animated.View 
                    entering={FadeIn.duration(200)} 
                    exiting={FadeOut.duration(200)} 
                    style={styles.backdrop}
                >
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                </Animated.View>

                <Animated.View 
                    entering={SlideInDown.duration(300)} 
                    exiting={SlideOutDown.duration(300)}
                    style={[styles.container, { backgroundColor: theme.colors.card }]}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            {title || (mode === 'time' ? "Set Time" : "Set Duration")}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <HugeiconsIcon icon={Cancel01Icon} size={24} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Picker Wheels */}
                    <View style={styles.pickerContainer}>
                        {/* Selection Highlight Bar */}
                        <View style={[styles.highlightBar, { backgroundColor: theme.colors.border, opacity: 0.15 }]} />

                        {/* Hours */}
                        <View style={styles.column}>
                            <Text style={[styles.columnLabel, { color: theme.colors.textSecondary }]}>
                                {mode === 'time' ? 'Hour' : 'Hours'}
                            </Text>
                            <FlatList
                                data={hours}
                                renderItem={(props) => renderItem({ ...props, type: 'hour' })}
                                keyExtractor={(i) => `h-${i}`}
                                showsVerticalScrollIndicator={false}
                                snapToInterval={ITEM_HEIGHT}
                                decelerationRate="fast"
                                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 1.5 }}
                                onMomentumScrollEnd={(e) => handleScroll(e, 'hour')}
                                getItemLayout={getItemLayout}
                                initialScrollIndex={hours.indexOf(selectedHour)}
                            />
                        </View>

                        {/* Separator */}
                        <Text style={[styles.separator, { color: theme.colors.text }]}>:</Text>

                        {/* Minutes */}
                        <View style={styles.column}>
                            <Text style={[styles.columnLabel, { color: theme.colors.textSecondary }]}>Min</Text>
                            <FlatList
                                data={minutes}
                                renderItem={(props) => renderItem({ ...props, type: 'minute' })}
                                keyExtractor={(i) => `m-${i}`}
                                showsVerticalScrollIndicator={false}
                                snapToInterval={ITEM_HEIGHT}
                                decelerationRate="fast"
                                contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 1.5 }}
                                onMomentumScrollEnd={(e) => handleScroll(e, 'minute')}
                                getItemLayout={getItemLayout}
                                initialScrollIndex={minutes.indexOf(selectedMinute)}
                            />
                        </View>

                        {/* AM/PM Column (Time Mode Only) */}
                        {mode === 'time' && (
                            <>
                                <View style={{ width: 10 }} />
                                <View style={styles.column}>
                                    <Text style={[styles.columnLabel, { color: theme.colors.textSecondary }]}>Period</Text>
                                    <FlatList
                                        data={periods}
                                        renderItem={(props) => renderItem({ ...props, type: 'period' })}
                                        keyExtractor={(i) => `p-${i}`}
                                        showsVerticalScrollIndicator={false}
                                        snapToInterval={ITEM_HEIGHT}
                                        decelerationRate="fast"
                                        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 1.5 }}
                                        onMomentumScrollEnd={(e) => handleScroll(e, 'period')}
                                        getItemLayout={getItemLayout}
                                        initialScrollIndex={periods.indexOf(selectedPeriod)}
                                    />
                                </View>
                            </>
                        )}
                    </View>

                    {/* Footer */}
                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <Button 
                            title="Confirm"
                            variant="primary"
                            onPress={handleConfirm}
                            icon={CheckmarkCircle01Icon}
                            fullWidth
                            size="lg"
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    container: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        width: '100%',
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
    },
    title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
    closeBtn: { padding: 4 },
    pickerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        height: 220,
        position: 'relative',
        marginVertical: 10,
    },
    column: {
        width: 70,
        alignItems: 'center',
        height: '100%',
    },
    columnLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 10,
        position: 'absolute',
        top: -15,
        textAlign: 'center',
        width: '100%',
    },
    pickerItem: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerText: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    separator: {
        fontSize: 24,
        fontWeight: '700',
        marginHorizontal: 4,
        marginTop: 6,
    },
    highlightBar: {
        position: 'absolute',
        top: '50%',
        height: ITEM_HEIGHT,
        width: '90%',
        marginTop: -ITEM_HEIGHT / 2,
        borderRadius: 12,
    },
    footer: {
        padding: 24,
        paddingTop: 16,
        borderTopWidth: 1,
    }
});