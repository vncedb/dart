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

// UPDATED: Added 'day' to FilterType to fix TS error
export type FilterType = 'period' | 'week' | 'month' | 'day';

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
const INITIAL_HEIGHT = SCREEN_HEIGHT * 0.5;
const SNAP_TOP = 0;
const SNAP_MID = MAX_HEIGHT - INITIAL_HEIGHT;
const SNAP_CLOSE = MAX_HEIGHT;

export default function ReportFilterModal({ visible, onClose, onSelect, availableDates, currentRange }: ReportFilterModalProps) {
    const theme = useAppTheme();
    const [activeTab, setActiveTab] = useState<FilterType>('period');
    const [groups, setGroups] = useState<DateRange[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const translateY = useSharedValue(SNAP_CLOSE);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        if (visible) {
            translateY.value = SNAP_CLOSE;
            translateY.value = withTiming(SNAP_MID, { duration: 350, easing: Easing.out(Easing.quad) });
        }
    }, [visible]);

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
                    label = `${format(s, 'MMM d')} - ${format(e, 'd')}`;
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
        translateY.value = withTiming(SNAP_CLOSE, { duration: 250 }, () => runOnJS(onClose)());
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
            else translateY.value = withTiming(SNAP_MID);
        });

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>
                <GestureDetector gesture={pan}>
                    <Animated.View style={[styles.sheet, { backgroundColor: theme.colors.card, height: MAX_HEIGHT }, animatedStyle]}>
                        <View style={styles.handleContainer}><View style={[styles.handle, { backgroundColor: theme.colors.border }]} /></View>
                        <ModalHeader title="Select Range" subtitle="Filter Reports" onClose={close} position="bottom" />
                        <View style={styles.contentContainer}>
                            <View style={[styles.tabContainer, { backgroundColor: theme.colors.background }]}>
                                {[{ id: 'period', label: 'Period' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }].map((tab: any) => (
                                    <TouchableOpacity 
                                        key={tab.id} 
                                        onPress={() => setActiveTab(tab.id)}
                                        style={[styles.tab, activeTab === tab.id && [styles.activeTab, { backgroundColor: theme.colors.card }]]}
                                    >
                                        <Text style={[styles.tabText, { color: activeTab === tab.id ? theme.colors.text : theme.colors.textSecondary }]}>{tab.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {isLoading ? <ActivityIndicator color={theme.colors.primary} /> : (
                                <FlatList
                                    data={groups}
                                    keyExtractor={item => item.label}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity onPress={() => { onSelect(item); close(); }} style={[styles.item, { backgroundColor: currentRange?.label === item.label ? theme.colors.primary + '10' : theme.colors.background }]}>
                                            <View style={styles.itemLeft}>
                                                <HugeiconsIcon icon={Calendar02Icon} size={20} color={theme.colors.text} />
                                                <Text style={[styles.itemLabel, { color: theme.colors.text }]}>{item.label}</Text>
                                            </View>
                                            {currentRange?.label === item.label && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color={theme.colors.primary} />}
                                        </TouchableOpacity>
                                    )}
                                    contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
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
    sheet: { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, position: 'absolute', bottom: 0, shadowColor: "#000", shadowOpacity: 0.1, elevation: 10 },
    handleContainer: { alignItems: 'center', paddingVertical: 12 },
    handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
    contentContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
    tabContainer: { flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 16, height: 40 },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    activeTab: { shadowColor: "#000", shadowOpacity: 0.05, elevation: 1 },
    tabText: { fontWeight: '600', fontSize: 13 },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12 },
    itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemLabel: { fontSize: 14, fontWeight: '600' }
});