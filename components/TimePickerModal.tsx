import { CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAppTheme } from '../constants/theme';
import Button from './Button';

type PickerMode = 'duration' | 'time';

interface TimePickerModalProps {
    visible: boolean;
    mode?: PickerMode;
    onClose: () => void;
    onConfirm: (hours: number, minutes: number, period?: 'AM' | 'PM') => void;
    title?: string;
    initialHours?: number;
    initialMinutes?: number;
    initialPeriod?: 'AM' | 'PM';
}

// --- CONSTANTS ---
const ITEM_HEIGHT = 48;          
const VISIBLE_ITEMS = 3;         
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_VERTICAL = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

// --- PICKER COLUMN COMPONENT ---
interface PickerColumnProps {
    data: (string | number)[];
    value: string | number;
    onChange: (val: any) => void;
    theme: any;
}

const PickerColumn = ({ data, value, onChange, theme }: PickerColumnProps) => {
    const flatListRef = useRef<FlatList>(null);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const index = Math.round(offsetY / ITEM_HEIGHT);
        const safeIndex = Math.max(0, Math.min(index, data.length - 1));
        
        const newValue = data[safeIndex];
        if (newValue !== value) {
            onChange(newValue);
        }
    };

    useEffect(() => {
        const index = data.indexOf(value);
        if (index !== -1 && flatListRef.current) {
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({
                    offset: index * ITEM_HEIGHT,
                    animated: false
                });
            }, 50);
        }
    }, [value]); 

    return (
        <View style={styles.columnContainer}>
            <FlatList
                ref={flatListRef}
                data={data}
                keyExtractor={(item) => item.toString()}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                bounces={false}
                contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
                getItemLayout={(_, index) => ({
                    length: ITEM_HEIGHT,
                    offset: ITEM_HEIGHT * index,
                    index,
                })}
                initialScrollIndex={data.indexOf(value) !== -1 ? data.indexOf(value) : 0}
                onMomentumScrollEnd={handleScroll}
                onScrollEndDrag={handleScroll}
                renderItem={({ item }) => {
                    const isSelected = item === value;
                    return (
                        <View style={styles.itemContainer}>
                            <Text style={[
                                styles.itemText,
                                { 
                                    color: isSelected ? theme.colors.primary : theme.colors.textSecondary,
                                    fontSize: isSelected ? 22 : 18,
                                    fontWeight: isSelected ? '700' : '500',
                                    opacity: isSelected ? 1 : 0.4,
                                }
                            ]}>
                                {typeof item === 'number' ? item.toString().padStart(2, '0') : item}
                            </Text>
                        </View>
                    );
                }}
            />
        </View>
    );
};

// --- MAIN COMPONENT ---
export default function TimePickerModal({
    visible,
    mode = 'time',
    onClose,
    onConfirm,
    title,
    initialHours = 0,
    initialMinutes = 0,
    initialPeriod = 'PM',
}: TimePickerModalProps) {
    const theme = useAppTheme();
    
    const getStartHour = () => {
        if (mode === 'duration') return initialHours;
        if (initialHours === 0) return 12;
        if (initialHours > 12) return initialHours - 12;
        return initialHours;
    };

    const [selectedHour, setSelectedHour] = useState(getStartHour());
    const [selectedMinute, setSelectedMinute] = useState(initialMinutes);
    const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initialPeriod || 'PM');

    useEffect(() => {
        if (visible) {
            setSelectedHour(getStartHour());
            setSelectedMinute(initialMinutes);
            setSelectedPeriod(initialPeriod || 'PM');
        }
    }, [visible]);

    const handleConfirm = () => {
        onConfirm(selectedHour, selectedMinute, selectedPeriod);
        onClose();
    };

    const hours = useMemo(() => mode === 'time' 
        ? Array.from({ length: 12 }, (_, i) => i + 1) 
        : Array.from({ length: 24 }, (_, i) => i), [mode]);
    const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
    const periods = useMemo(() => ['AM', 'PM'], []);

    if (!visible) return null;

    return (
        <Modal 
            transparent 
            visible={visible} 
            onRequestClose={onClose} 
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1}>
                    <View style={styles.backdrop} />
                </TouchableOpacity>

                <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            {title || (mode === 'time' ? "Set Time" : "Set Duration")}
                        </Text>
                    </View>

                    <View style={styles.labelRow}>
                        <Text style={[styles.labelText, { color: theme.colors.textSecondary }]}>HOURS</Text>
                        <View style={styles.colonSpacer} />
                        <Text style={[styles.labelText, { color: theme.colors.textSecondary }]}>MINUTES</Text>
                        {mode === 'time' && (
                            <>
                                <View style={styles.spacer} />
                                <Text style={[styles.labelText, { color: theme.colors.textSecondary }]}>MERIDIEM</Text>
                            </>
                        )}
                    </View>

                    <View style={[styles.pickerWrapper, { height: CONTAINER_HEIGHT }]}>
                        <View 
                            style={[
                                styles.highlightBar, 
                                { 
                                    backgroundColor: theme.colors.primary, 
                                    opacity: 0.08,
                                    height: ITEM_HEIGHT,
                                    top: PADDING_VERTICAL 
                                }
                            ]} 
                        />

                        <View style={styles.row}>
                            <PickerColumn 
                                data={hours} 
                                value={selectedHour} 
                                onChange={setSelectedHour} 
                                theme={theme}
                            />
                            
                            {/* Colon Spacer */}
                            <View style={[styles.colonSpacer, { height: CONTAINER_HEIGHT }]}>
                                <View style={[styles.colonContainer, { height: ITEM_HEIGHT }]}>
                                    <Text style={[styles.colon, { color: theme.colors.text }]}>:</Text>
                                </View>
                            </View>
                            
                            <PickerColumn 
                                data={minutes} 
                                value={selectedMinute} 
                                onChange={setSelectedMinute} 
                                theme={theme}
                            />
                            
                            {mode === 'time' && (
                                <>
                                    <View style={styles.spacer} />
                                    <PickerColumn 
                                        data={periods} 
                                        value={selectedPeriod} 
                                        onChange={setSelectedPeriod} 
                                        theme={theme}
                                    />
                                </>
                            )}
                        </View>
                    </View>

                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <View style={{ flex: 1 }}>
                            <Button 
                                title="Cancel" 
                                variant="ghost" 
                                onPress={onClose} 
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Button 
                                title="Done" 
                                variant="primary" 
                                onPress={handleConfirm} 
                                icon={CheckmarkCircle01Icon} 
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: 24,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    container: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    labelRow: {
        flexDirection: 'row',
        width: '100%',
        marginBottom: 8,
        paddingHorizontal: 8,
    },
    labelText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    pickerWrapper: {
        position: 'relative',
        width: '100%',
        alignItems: 'center',
        marginBottom: 24,
    },
    highlightBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderRadius: 12,
        zIndex: 0,
    },
    row: {
        flexDirection: 'row',
        height: '100%',
        alignItems: 'center',
    },
    columnContainer: {
        flex: 1,
        height: '100%',
        overflow: 'hidden',
    },
    itemContainer: {
        height: ITEM_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        textAlign: 'center',
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    colonSpacer: {
        width: 24, // Widened to prevent overlay
        alignItems: 'center',
        justifyContent: 'center',
    },
    colonContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        height: ITEM_HEIGHT,
        width: '100%',
    },
    colon: {
        fontSize: 22, // Matched to active item font size
        fontWeight: '700',
        textAlign: 'center',
        includeFontPadding: false,
        textAlignVertical: 'center',
        // Removed lineHeight to rely on Flexbox centering like the numbers
        marginTop: Platform.OS === 'android' ? -2 : 0, // Slight optical adjustment for Android
    },
    spacer: {
        width: 12,
    },
    footer: {
        flexDirection: 'row',
        paddingTop: 16,
        borderTopWidth: 1,
    }
});