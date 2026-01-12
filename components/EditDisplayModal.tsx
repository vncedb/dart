import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Menu01Icon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator
} from 'react-native-draggable-flatlist';
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
  withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import Button from './Button';

export const AVAILABLE_JOB_FIELDS = [
    { key: 'employment_status', label: 'Employment Status' },
    { key: 'shift', label: 'Shift Schedule' },
    { key: 'rate', label: 'Pay Rate' },
    { key: 'rate_type', label: 'Pay Type' },
    { key: 'payroll', label: 'Payroll Schedule' },
    { key: 'breaks', label: 'Unpaid Breaks' },
];

interface JobField {
    key: string;
    label: string;
    isActive: boolean;
}

interface EditDisplayModalProps {
    visible: boolean;
    onClose: () => void;
    selectedKeys: string[];
    onSave: (keys: string[]) => void;
}

export default function EditDisplayModal({
    visible,
    onClose,
    selectedKeys,
    onSave
}: EditDisplayModalProps) {
    const theme = useAppTheme();
    const [items, setItems] = useState<JobField[]>([]);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            translateY.value = 0;
            const activeItems = selectedKeys
                .map(key => AVAILABLE_JOB_FIELDS.find(f => f.key === key))
                .filter(Boolean)
                .map(f => ({ ...f!, isActive: true }));

            const inactiveItems = AVAILABLE_JOB_FIELDS
                .filter(f => !selectedKeys.includes(f.key))
                .map(f => ({ ...f, isActive: false }));

            setItems([...activeItems, ...inactiveItems]);
        }
    }, [visible, selectedKeys]);

    const toggleItem = (key: string) => {
        setItems(prev => prev.map(item =>
            item.key === key ? { ...item, isActive: !item.isActive } : item
        ));
    };

    const handleSave = () => {
        const activeKeys = items.filter(i => i.isActive).map(i => i.key);
        onSave(activeKeys);
        onClose();
    };

    const close = () => {
        onClose();
    };

    const pan = Gesture.Pan()
        .onChange((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > 100 || event.velocityY > 500) {
                runOnJS(close)();
            } else {
                translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
            }
        });

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    const renderItem = ({ item, drag, isActive }: RenderItemParams<JobField>) => {
        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onPress={() => toggleItem(item.key)}
                    onLongPress={drag}
                    disabled={isActive}
                    activeOpacity={0.7}
                    style={[
                        styles.itemRow,
                        {
                            backgroundColor: item.isActive ? theme.colors.primary + '10' : theme.colors.background,
                            borderColor: item.isActive ? theme.colors.primary : theme.colors.border,
                            marginBottom: 10,
                            borderWidth: 1,
                        }
                    ]}
                >
                    <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
                        <HugeiconsIcon icon={Menu01Icon} size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.contentContainer}>
                        <Text style={[
                            styles.itemLabel,
                            { color: item.isActive ? theme.colors.primary : theme.colors.text }
                        ]}>
                            {item.label}
                        </Text>

                        <HugeiconsIcon
                            icon={item.isActive ? CheckmarkCircle02Icon : Tick02Icon}
                            size={22}
                            color={item.isActive ? theme.colors.primary : theme.colors.border}
                            variant={item.isActive ? 'solid' : 'stroke'}
                        />
                    </View>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View
                    entering={FadeIn.duration(300)}
                    exiting={FadeOut.duration(300)}
                    style={styles.backdrop}
                >
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
                </Animated.View>

                {/* Simple Slide Up Animation */}
                <Animated.View
                    entering={SlideInDown.duration(400).easing(Easing.out(Easing.quad))}
                    exiting={SlideOutDown.duration(300)}
                    style={styles.modalContainerWrapper}
                >
                    <Animated.View style={[
                        styles.modalContainer,
                        { backgroundColor: theme.colors.card },
                        animatedSheetStyle
                    ]}>
                        <GestureDetector gesture={pan}>
                            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                                <View>
                                    <Text style={[styles.title, { color: theme.colors.text }]}>Customize Job Card</Text>
                                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Drag to reorder • Tap to toggle</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={close}
                                    style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                        </GestureDetector>

                        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
                            <DraggableFlatList
                                data={items}
                                onDragEnd={({ data }) => setItems(data)}
                                keyExtractor={(item) => item.key}
                                renderItem={renderItem}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 100 }}
                            />
                        </View>

                        <View style={[
                            styles.footer,
                            { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }
                        ]}>
                            <Button 
                                title="Save Changes" 
                                variant="primary" 
                                size="lg" 
                                onPress={handleSave} 
                                fullWidth
                            />
                        </View>
                    </Animated.View>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContainerWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        height: '75%',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        zIndex: 10,
    },
    title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    closeBtn: { padding: 8, borderRadius: 50 },

    itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, height: 58 },
    dragHandle: { height: '100%', paddingLeft: 16, paddingRight: 12, justifyContent: 'center', alignItems: 'center' },
    contentContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%', paddingRight: 16, justifyContent: 'space-between' },
    itemLabel: { fontSize: 15, fontWeight: '600' },

    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        borderTopWidth: 1,
    }
});