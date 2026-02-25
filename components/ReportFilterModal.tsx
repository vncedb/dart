import {
    Calendar02Icon,
    Tick01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../constants/theme';
import ModalHeader from './ModalHeader';

export type FilterType = 'period' | 'week' | 'month' | 'day' | 'custom';

export interface DateRange {
    start: string;
    end: string;
    label: string;
    type: FilterType;
}

interface ReportFilterModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (range: DateRange) => void;
    availableDates: string[];
    currentRange: DateRange | null;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_HEIGHT = SCREEN_HEIGHT * 0.92;
const INITIAL_HEIGHT = SCREEN_HEIGHT * 0.55;
const SNAP_TOP = 0;
const SNAP_MID = MAX_HEIGHT - INITIAL_HEIGHT;
const SNAP_CLOSE = MAX_HEIGHT;

export default function ReportFilterModal({ 
    visible, 
    onClose, 
    onSelect, 
    availableDates, 
    currentRange 
}: ReportFilterModalProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    
    const [activeTab, setActiveTab] = useState<FilterType>('period');
    const [groups, setGroups] = useState<DateRange[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const translateY = useSharedValue(SNAP_CLOSE);
    const context = useSharedValue({ y: 0 });

    // Sync active tab with currentRange when opened
    useEffect(() => {
        if (visible) {
            if (currentRange?.type && ['period', 'week', 'month'].includes(currentRange.type)) {
                setActiveTab(currentRange.type);
            }
            translateY.value = SNAP_CLOSE;
            // Smooth linear easing (No Spring)
            translateY.value = withTiming(SNAP_MID, { duration: 300, easing: Easing.out(Easing.ease) });
        }
    }, [visible, currentRange, translateY]);

    useEffect(() => {
        setIsLoading(true);
        setTimeout(() => {
            if (!availableDates.length) {
                setGroups([]);
                setIsLoading(false);
                return;
            }
            const sorted = [...availableDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            const uniqueRanges = new Map<string, DateRange>();

            sorted.forEach(dateStr => {
                const date = new Date(dateStr);
                let startStr = '', endStr = '', label = '', key = '';

                if (activeTab === 'period') {
                    const day = date.getDate();
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    let s, e;
                    if (day <= 15) {
                        s = new Date(year, month, 1);
                        e = new Date(year, month, 15);
                        label = `${format(s, 'MMM 1')} - ${format(e, '15, yyyy')}`;
                    } else {
                        s = new Date(year, month, 16);
                        e = endOfMonth(date);
                        label = `${format(s, 'MMM 16')} - ${format(e, 'd, yyyy')}`;
                    }
                    startStr = format(s, 'yyyy-MM-dd');
                    endStr = format(e, 'yyyy-MM-dd');
                    key = label;
                } else if (activeTab === 'week') {
                    const s = startOfWeek(date, { weekStartsOn: 1 });
                    const e = endOfWeek(date, { weekStartsOn: 1 });
                    label = `${format(s, 'MMM d')} - ${format(e, 'd, yyyy')}`;
                    startStr = format(s, 'yyyy-MM-dd');
                    endStr = format(e, 'yyyy-MM-dd');
                    key = label;
                } else if (activeTab === 'month') {
                    const s = startOfMonth(date);
                    const e = endOfMonth(date);
                    label = format(s, 'MMMM yyyy');
                    startStr = format(s, 'yyyy-MM-dd');
                    endStr = format(e, 'yyyy-MM-dd');
                    key = label;
                }
                
                if (!uniqueRanges.has(key) && startStr) {
                    uniqueRanges.set(key, { start: startStr, end: endStr, label, type: activeTab });
                }
            });
            setGroups(Array.from(uniqueRanges.values()));
            setIsLoading(false);
        }, 10);
    }, [activeTab, availableDates]);

    const close = () => {
        translateY.value = withTiming(SNAP_CLOSE, { duration: 250, easing: Easing.in(Easing.ease) }, () => runOnJS(onClose)());
    };

    const pan = Gesture.Pan()
        .onStart(() => { context.value = { y: translateY.value }; })
        .onUpdate((e) => {
            let newY = context.value.y + e.translationY;
            if (newY < SNAP_TOP) newY = SNAP_TOP + (newY - SNAP_TOP) * 0.2;
            translateY.value = newY;
        })
        .onEnd((e) => {
            if (e.velocityY > 500 || (e.translationY > 100)) runOnJS(close)();
            else translateY.value = withTiming(SNAP_MID, { duration: 300, easing: Easing.out(Easing.ease) });
        });

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>

                <GestureDetector gesture={pan}>
                    <Animated.View style={[styles.sheet, { backgroundColor: theme.colors.background, height: MAX_HEIGHT }, animatedStyle]}>
                        
                        {/* Drag Indicator */}
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                        </View>

                        {/* Updated Modal Header with Title & Subtitle */}
                        <ModalHeader 
                            title="Select Range" 
                            subtitle="Filter Reports"
                            position="bottom" 
                            onClose={close} 
                        />

                        <View style={styles.contentContainer}>
                            
                            {/* Modern Segmented Control / Tabs */}
                            <View style={[styles.tabContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                {[{ id: 'period', label: 'Period' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }].map((tab: any) => (
                                    <TouchableOpacity 
                                        key={tab.id} 
                                        activeOpacity={0.8}
                                        onPress={() => setActiveTab(tab.id)}
                                        style={[
                                            styles.tab, 
                                            activeTab === tab.id && [styles.activeTab, { backgroundColor: theme.colors.background }]
                                        ]}
                                    >
                                        <Text style={[
                                            styles.tabText, 
                                            { color: activeTab === tab.id ? theme.colors.text : theme.colors.textSecondary }
                                        ]}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={theme.colors.primary} />
                                </View>
                            ) : (
                                <FlatList
                                    data={groups}
                                    keyExtractor={item => item.label}
                                    showsVerticalScrollIndicator={false}
                                    renderItem={({ item }) => {
                                        const isSelected = currentRange?.label === item.label && currentRange?.type === item.type;

                                        return (
                                            <TouchableOpacity 
                                                activeOpacity={0.7}
                                                onPress={() => { onSelect(item); close(); }} 
                                                style={[
                                                    styles.itemCard, 
                                                    { 
                                                        backgroundColor: isSelected ? theme.colors.primary + '08' : theme.colors.card,
                                                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                                    }
                                                ]}
                                            >
                                                <View style={styles.itemLeft}>
                                                    <View style={[
                                                        styles.iconBox,
                                                        { backgroundColor: isSelected ? theme.colors.primary : theme.colors.background }
                                                    ]}>
                                                        <HugeiconsIcon 
                                                            icon={Calendar02Icon} 
                                                            size={20} 
                                                            color={isSelected ? '#fff' : theme.colors.textSecondary} 
                                                        />
                                                    </View>
                                                    <Text style={[
                                                        styles.itemLabel, 
                                                        { color: isSelected ? theme.colors.primary : theme.colors.text }
                                                    ]}>
                                                        {item.label}
                                                    </Text>
                                                </View>
                                                
                                                {isSelected && (
                                                    <HugeiconsIcon icon={Tick01Icon} size={24} color={theme.colors.primary} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }}
                                    contentContainerStyle={{ gap: 12, paddingBottom: Math.max(insets.bottom, 40) }}
                                    ListEmptyComponent={
                                        <View style={styles.emptyContainer}>
                                            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                                                No dates available for this filter.
                                            </Text>
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
    overlay: { 
        flex: 1, 
        justifyContent: 'flex-end' 
    },
    backdrop: { 
        ...StyleSheet.absoluteFillObject 
    },
    sheet: { 
        width: '100%', 
        borderTopLeftRadius: 32, 
        borderTopRightRadius: 32, 
        position: 'absolute', 
        bottom: 0, 
        shadowColor: "#000", 
        shadowOpacity: 0.15, 
        shadowRadius: 30,
        shadowOffset: { width: 0, height: -10 },
        elevation: 20 
    },
    handleContainer: { 
        alignItems: 'center', 
        paddingTop: 12,
        paddingBottom: 4 
    },
    handle: { 
        width: 40, 
        height: 5, 
        borderRadius: 3, 
        opacity: 0.5 
    },
    contentContainer: { 
        flex: 1, 
        paddingHorizontal: 24, 
        paddingTop: 16 
    },
    tabContainer: { 
        flexDirection: 'row', 
        padding: 4, 
        borderRadius: 14, 
        marginBottom: 20, 
        height: 44,
        borderWidth: 1,
    },
    tab: { 
        flex: 1, 
        alignItems: 'center', 
        justifyContent: 'center', 
        borderRadius: 10 
    },
    activeTab: { 
        shadowColor: "#000", 
        shadowOpacity: 0.08, 
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2 
    },
    tabText: { 
        fontFamily: 'Nunito_700Bold', 
        fontSize: 13 
    },
    loadingContainer: {
        paddingTop: 40,
        alignItems: 'center'
    },
    itemCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 16, 
        borderRadius: 16, 
        borderWidth: 1.5 
    },
    itemLeft: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 14 
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemLabel: { 
        fontSize: 15, 
        fontFamily: 'Nunito_700Bold' 
    },
    emptyContainer: {
        padding: 30,
        alignItems: 'center'
    },
    emptyText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14
    }
});