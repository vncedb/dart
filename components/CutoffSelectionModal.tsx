import {
    Calendar02Icon,
    Calendar03Icon,
    CheckmarkCircle02Icon,
    FilterHorizontalIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import React, { useMemo, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    runOnJS,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.60; // Fixed height 60%

export default function CutoffSelectionModal({ visible, onClose, onSelect, availableDates, currentRange }: CutoffSelectionModalProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<FilterType>('period');

    // Drag Animation Values
    const translateY = useSharedValue(0);

    // Reset position when modal opens
    React.useEffect(() => {
        if (visible) translateY.value = 0;
    }, [visible]);

    const pan = Gesture.Pan()
        .onChange((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > 120 || event.velocityY > 500) {
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0, { damping: 15 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    // --- GROUPING LOGIC ---
    const groups = useMemo(() => {
        if (!availableDates.length) return [];

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
                label = `${format(start, 'MMM d')} - ${format(end, 'd')}`; // Shortened for cleaner UI
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

        return Array.from(uniqueRanges.values());
    }, [availableDates, activeTab]);

    const handleSelect = (item: DateRange) => {
        onSelect(item);
        onClose();
    };

    const tabs: { id: FilterType; label: string }[] = [
        { id: 'period', label: 'Pay Period' },
        { id: 'week', label: 'Weekly' },
        { id: 'month', label: 'Monthly' },
    ];

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={onClose} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                {/* Backdrop Fade */}
                <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>

                {/* Draggable Sheet */}
                <GestureDetector gesture={pan}>
                    <Animated.View 
                        entering={SlideInDown.duration(350).easing(Easing.out(Easing.quad))} 
                        exiting={SlideOutDown.duration(250)} 
                        style={[
                            styles.sheet, 
                            { 
                                backgroundColor: theme.colors.background, 
                                height: MODAL_HEIGHT,
                                paddingBottom: Math.max(insets.bottom, 20) 
                            },
                            animatedStyle
                        ]}
                    >
                        {/* Header Area */}
                        <View>
                            <ModalHeader 
                                title="Select Range" 
                                onClose={onClose} 
                            />
                        </View>

                        {/* Segmented Control Tabs */}
                        <View style={[styles.tabContainer, { backgroundColor: theme.colors.card }]}>
                            {tabs.map(tab => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <TouchableOpacity 
                                        key={tab.id} 
                                        onPress={() => setActiveTab(tab.id)}
                                        style={[
                                            styles.tab, 
                                            isActive && [styles.activeTab, { backgroundColor: theme.colors.background, shadowColor: theme.colors.shadow }]
                                        ]}
                                    >
                                        <Text style={[
                                            styles.tabText, 
                                            { 
                                                color: isActive ? theme.colors.text : theme.colors.textSecondary, 
                                                fontWeight: isActive ? '700' : '500' 
                                            }
                                        ]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Content Header */}
                        <View style={styles.listHeaderContainer}>
                            <Text style={[styles.listHeader, { color: theme.colors.textSecondary }]}>
                                AVAILABLE {activeTab === 'period' ? 'PERIODS' : activeTab === 'week' ? 'WEEKS' : 'MONTHS'}
                            </Text>
                        </View>
                        
                        {/* List */}
                        <FlatList
                            data={groups}
                            keyExtractor={item => item.label}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isSelected = currentRange?.label === item.label;
                                return (
                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => handleSelect(item)}
                                        style={[
                                            styles.item,
                                            { 
                                                backgroundColor: theme.colors.card, 
                                                borderColor: isSelected ? theme.colors.primary : 'transparent',
                                                borderWidth: 1.5
                                            }
                                        ]}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                            <View style={[
                                                styles.iconBox, 
                                                { 
                                                    backgroundColor: isSelected ? theme.colors.primary + '15' : theme.colors.background 
                                                }
                                            ]}>
                                                <HugeiconsIcon 
                                                    icon={activeTab === 'month' ? Calendar03Icon : (activeTab === 'period' ? Calendar02Icon : FilterHorizontalIcon)} 
                                                    size={22} 
                                                    color={isSelected ? theme.colors.primary : theme.colors.textSecondary} 
                                                />
                                            </View>
                                            <Text style={[
                                                styles.itemLabel, 
                                                { 
                                                    color: theme.colors.text, 
                                                    fontWeight: isSelected ? '700' : '500' 
                                                }
                                            ]}>
                                                {item.label}
                                            </Text>
                                        </View>
                                        
                                        {isSelected && (
                                            <View style={[styles.checkCircle, { backgroundColor: theme.colors.primary }]}>
                                                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#fff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <View style={[styles.emptyIcon, { backgroundColor: theme.colors.card }]}>
                                        <HugeiconsIcon icon={Calendar03Icon} size={32} color={theme.colors.border} />
                                    </View>
                                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                        No records found for this filter.
                                    </Text>
                                </View>
                            }
                        />
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { 
        flex: 1, 
        justifyContent: 'flex-end' 
    },
    backdrop: { 
        ...StyleSheet.absoluteFillObject, 
        backgroundColor: 'rgba(0,0,0,0.5)' 
    },
    sheet: { 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 20,
    },
    // Tab Styles
    tabContainer: { 
        flexDirection: 'row', 
        padding: 4, 
        borderRadius: 16, 
        marginBottom: 20, 
        marginHorizontal: 20, 
        height: 48 
    },
    tab: { 
        flex: 1, 
        alignItems: 'center', 
        justifyContent: 'center', 
        borderRadius: 12 
    },
    activeTab: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tabText: { 
        fontSize: 13,
        letterSpacing: 0.3 
    },
    // List Styles
    listHeaderContainer: {
        paddingHorizontal: 24,
        marginBottom: 10
    },
    listHeader: { 
        fontSize: 11, 
        fontWeight: '700', 
        opacity: 0.6,
        letterSpacing: 0.5 
    },
    item: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 16, 
        borderRadius: 20,
        marginBottom: 4
    },
    itemLabel: { 
        fontSize: 15,
        letterSpacing: -0.2
    },
    iconBox: { 
        width: 44, 
        height: 44, 
        borderRadius: 14, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    // Empty State
    emptyState: {
        padding: 40, 
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center'
    }
});