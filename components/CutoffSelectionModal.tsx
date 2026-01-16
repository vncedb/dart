import {
    Calendar02Icon,
    CheckmarkCircle02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { FlatList, Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import ModalHeader from './ModalHeader';

export type FilterType = 'period' | 'week' | 'month';

export interface DateRange {
    start: string;
    end: string;
    label: string;
    type: FilterType;
}

interface CutoffSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (range: DateRange) => void;
    availableDates: string[];
    currentRange: DateRange | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_HEIGHT = SCREEN_HEIGHT * 0.92;
const INITIAL_HEIGHT = SCREEN_HEIGHT * 0.5;

const SNAP_TOP = 0;
const SNAP_MID = MAX_HEIGHT - INITIAL_HEIGHT;
const SNAP_CLOSE = MAX_HEIGHT;

export default function CutoffSelectionModal({ visible, onClose, onSelect, availableDates, currentRange }: CutoffSelectionModalProps) {
    const theme = useAppTheme();
    
    // Data States
    const [activeTab, setActiveTab] = useState<FilterType>('period');
    const [groups, setGroups] = useState<DateRange[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // UI Logic States
    const [isExpanded, setIsExpanded] = useState(false);

    // Reanimated Values
    const translateY = useSharedValue(SNAP_CLOSE);
    const context = useSharedValue({ y: 0 });

    // Reset position when modal opens
    useEffect(() => {
        if (visible) {
            translateY.value = SNAP_CLOSE;
            translateY.value = withTiming(SNAP_MID, { 
                duration: 350, 
                easing: Easing.out(Easing.quad) 
            });
            setIsExpanded(false);
        }
    }, [visible]);

    // Data Calculation
    useEffect(() => {
        setIsLoading(true);
        const task = setTimeout(() => {
            if (!availableDates.length) {
                setGroups([]);
                setIsLoading(false);
                return;
            }

            const sorted = [...availableDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            const uniqueRanges = new Map<string, DateRange>();

            sorted.forEach(dateStr => {
                const date = new Date(dateStr);
                let start, end, label, key;

                if (activeTab === 'period') {
                    const day = date.getDate();
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    
                    if (day <= 15) {
                        start = new Date(year, month, 1);
                        end = new Date(year, month, 15);
                        label = `${format(start, 'MMM 1')} - ${format(end, '15, yyyy')}`;
                    } else {
                        start = new Date(year, month, 16);
                        end = endOfMonth(date);
                        label = `${format(start, 'MMM 16')} - ${format(end, 'd, yyyy')}`;
                    }
                    key = label;
                } else if (activeTab === 'week') {
                    start = startOfWeek(date, { weekStartsOn: 1 });
                    end = endOfWeek(date, { weekStartsOn: 1 });
                    label = `${format(start, 'MMM d')} - ${format(end, 'd')}`;
                    key = label;
                } else if (activeTab === 'month') {
                    start = startOfMonth(date);
                    end = endOfMonth(date);
                    label = format(start, 'MMMM yyyy');
                    key = label;
                } else {
                    return;
                }

                if (!uniqueRanges.has(key) && start && end) {
                    uniqueRanges.set(key, {
                        start: start.toISOString(),
                        end: end.toISOString(),
                        label,
                        type: activeTab
                    });
                }
            });

            setGroups(Array.from(uniqueRanges.values()));
            setIsLoading(false);
        }, 10); 

        return () => clearTimeout(task);
    }, [activeTab, availableDates]);

    const close = () => {
        translateY.value = withTiming(SNAP_CLOSE, { duration: 250 }, () => {
            runOnJS(onClose)();
        });
    };

    // --- Gestures ---
    const pan = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            let newY = context.value.y + event.translationY;
            if (newY < SNAP_TOP) {
                newY = SNAP_TOP + (newY - SNAP_TOP) * 0.2;
            }
            translateY.value = newY;
        })
        .onEnd((event) => {
            const { velocityY, translationY } = event;
            const currentY = translateY.value;
            const snapConfig = { duration: 300, easing: Easing.out(Easing.quad) };

            if (velocityY > 500 || (translationY > 100 && velocityY > -500)) {
                if (currentY < SNAP_MID - 100) {
                     translateY.value = withTiming(SNAP_MID, snapConfig);
                     runOnJS(setIsExpanded)(false);
                } else {
                    runOnJS(close)();
                }
            } else if (velocityY < -500 || (translationY < -100 && velocityY < 500)) {
                translateY.value = withTiming(SNAP_TOP, snapConfig);
                runOnJS(setIsExpanded)(true);
            } else {
                const distToTop = Math.abs(currentY - SNAP_TOP);
                const distToMid = Math.abs(currentY - SNAP_MID);
                const distToClose = Math.abs(currentY - SNAP_CLOSE);

                if (distToTop < distToMid && distToTop < distToClose) {
                    translateY.value = withTiming(SNAP_TOP, snapConfig);
                    runOnJS(setIsExpanded)(true);
                } else if (distToMid < distToClose) {
                    translateY.value = withTiming(SNAP_MID, snapConfig);
                    runOnJS(setIsExpanded)(false);
                } else {
                    runOnJS(close)();
                }
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    const handleSelect = (item: DateRange) => {
        onSelect(item);
        close();
    };

    const tabs: { id: FilterType; label: string }[] = [
        { id: 'period', label: 'Pay Period' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
    ];

    const getSectionTitle = () => {
        switch (activeTab) {
            case 'period': return 'PAY PERIOD';
            case 'week': return 'THIS WEEK';
            case 'month': return 'THIS MONTH';
            default: return 'AVAILABLE';
        }
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                {/* Backdrop: Fade In Only (Decoupled from drag) */}
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>

                {/* Draggable Sheet */}
                <GestureDetector gesture={pan}>
                    <Animated.View 
                        style={[
                            styles.sheet, 
                            { backgroundColor: theme.colors.card, height: MAX_HEIGHT },
                            animatedStyle
                        ]}
                    >
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                        </View>

                        <ModalHeader 
                            title="Select Range" 
                            subtitle="Select Reports to Display"
                            onClose={close}
                            position="bottom"
                        />

                        <View style={styles.contentContainer}>
                            <View style={[styles.tabContainer, { backgroundColor: theme.colors.background }]}>
                                {tabs.map(tab => {
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <TouchableOpacity 
                                            key={tab.id} 
                                            onPress={() => setActiveTab(tab.id)}
                                            activeOpacity={0.8}
                                            style={[
                                                styles.tab, 
                                                isActive && [styles.activeTab, { backgroundColor: theme.colors.card }]
                                            ]}
                                        >
                                            <Text style={[styles.tabText, { color: isActive ? theme.colors.text : theme.colors.textSecondary, fontWeight: isActive ? '600' : '500' }]}>{tab.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>{getSectionTitle()}</Text>

                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color={theme.colors.primary} />
                                </View>
                            ) : (
                                <FlatList
                                    data={groups}
                                    keyExtractor={item => item.label}
                                    scrollEnabled={isExpanded}
                                    contentContainerStyle={styles.listContent}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => {
                                        const isSelected = currentRange?.label === item.label;
                                        return (
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={() => handleSelect(item)}
                                                style={[styles.item, { backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.background }]}
                                            >
                                                <View style={styles.itemLeft}>
                                                    <View style={[styles.iconBox, { backgroundColor: theme.colors.card }]}>
                                                        <HugeiconsIcon icon={Calendar02Icon} size={20} color={isSelected ? theme.colors.primary : theme.colors.textSecondary} />
                                                    </View>
                                                    <Text style={[styles.itemLabel, { color: isSelected ? theme.colors.primary : theme.colors.text, fontWeight: isSelected ? '700' : '500' }]}>{item.label}</Text>
                                                </View>
                                                {isSelected && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color={theme.colors.primary} />}
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListEmptyComponent={
                                        <View style={styles.emptyState}>
                                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No records available.</Text>
                                        </View>
                                    }
                                />
                            )}
                        </View>
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: { 
        width: '100%', 
        borderTopLeftRadius: 28, 
        borderTopRightRadius: 28, 
        overflow: 'hidden', 
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: -4 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 12, 
        elevation: 10, 
        position: 'absolute', 
        bottom: 0 
    },
    handleContainer: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
    contentContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    tabContainer: { flexDirection: 'row', padding: 4, borderRadius: 14, marginBottom: 20, height: 44 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    activeTab: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    tabText: { fontSize: 13, letterSpacing: 0.2 },
    sectionLabel: { fontSize: 11, fontWeight: '800', opacity: 0.5, marginBottom: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
    listContent: { paddingBottom: 24, gap: 8 },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingRight: 16, borderRadius: 16 },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    itemLabel: { fontSize: 14, letterSpacing: -0.1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 20 },
    emptyState: { padding: 20, alignItems: 'center' },
    emptyText: { fontSize: 14 }
});