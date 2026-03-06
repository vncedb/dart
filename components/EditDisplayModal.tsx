import {
    Add01Icon,
    Delete02Icon,
    DragDropVerticalIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import DraggableFlatList, {
    RenderItemParams,
    ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import Button from './Button';
import ModalHeader from './ModalHeader';

export const AVAILABLE_JOB_FIELDS = [
    { key: 'employment_status', label: 'Employment Status' },
    { key: 'shift', label: 'Shift Schedule' },
    { key: 'rate', label: 'Pay Rate' },
    { key: 'rate_type', label: 'Pay Type' },
    { key: 'payroll', label: 'Payroll Schedule' },
    { key: 'period_target', label: 'Target Duration' },
    { key: 'breaks', label: 'Unpaid Breaks' },
];

interface EditDisplayModalProps {
    visible: boolean;
    onClose: () => void;
    selectedKeys: string[];
    onSave: (keys: string[]) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 60;
const ROW_GAP = 6;
const HEADER_AND_HANDLE = 112;
const EXTRA_SPACE = 96;
const SNAP_OPEN = 0;

export default function EditDisplayModal({
    visible,
    onClose,
    selectedKeys,
    onSave
}: EditDisplayModalProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const [activeKeys, setActiveKeys] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const footerHeight = Platform.OS === 'ios' ? Math.max(86, insets.bottom + 66) : 80;
    const estimatedRows = AVAILABLE_JOB_FIELDS.length * (ITEM_HEIGHT + ROW_GAP);
    const sheetHeight = Math.min(
        SCREEN_HEIGHT * 0.92,
        HEADER_AND_HANDLE + estimatedRows + footerHeight + EXTRA_SPACE
    );

    const translateY = useSharedValue(SCREEN_HEIGHT);

    useEffect(() => {
        if (visible) {
            setActiveKeys(selectedKeys);
            setIsDragging(false);
            translateY.value = SCREEN_HEIGHT;
            translateY.value = withTiming(SNAP_OPEN, {
                duration: 320,
                easing: Easing.out(Easing.quad)
            });
        }
    }, [visible, selectedKeys, translateY]);

    const close = useCallback(() => {
        setIsDragging(false);
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 240 }, () => {
            runOnJS(onClose)();
        });
    }, [onClose, translateY]);

    const handleSave = useCallback(() => {
        onSave(activeKeys);
        close();
    }, [activeKeys, onSave, close]);

    const activeItems = useMemo(
        () => activeKeys.map(key => AVAILABLE_JOB_FIELDS.find(f => f.key === key)).filter(Boolean) as typeof AVAILABLE_JOB_FIELDS,
        [activeKeys]
    );

    const inactiveItems = useMemo(
        () => AVAILABLE_JOB_FIELDS.filter(f => !activeKeys.includes(f.key)),
        [activeKeys]
    );

    const toggleItem = useCallback((key: string, isActive: boolean) => {
        if (isActive) setActiveKeys(prev => prev.filter(k => k !== key));
        else setActiveKeys(prev => [...prev, key]);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    const renderActiveItem = useCallback(({ item, drag, isActive }: RenderItemParams<typeof AVAILABLE_JOB_FIELDS[0]>) => {
        return (
            <ScaleDecorator activeScale={1.015}>
                <View style={{ marginBottom: ROW_GAP }}>
                    <TouchableOpacity
                        activeOpacity={0.95}
                        disabled={isActive}
                        style={[
                            styles.item,
                            {
                                backgroundColor: isActive ? theme.colors.primary + '12' : theme.colors.card,
                                borderColor: isActive ? theme.colors.primary + '35' : theme.colors.border,
                                borderWidth: 1,
                                height: ITEM_HEIGHT,
                            }
                        ]}
                    >
                        <View style={styles.itemLeft}>
                            <Pressable
                                onLongPress={drag}
                                delayLongPress={110}
                                style={[styles.iconBox, { backgroundColor: isActive ? theme.colors.primary + '20' : theme.colors.background }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <HugeiconsIcon icon={DragDropVerticalIcon} size={18} color={isActive ? theme.colors.primary : theme.colors.textSecondary} />
                            </Pressable>

                            <View style={{ flex: 1, paddingRight: 10, justifyContent: 'center' }}>
                                <Text style={[styles.itemLabel, { color: theme.colors.text }]} numberOfLines={1}>
                                    {item.label}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity onPress={() => toggleItem(item.key, true)} hitSlop={12} style={[styles.actionBtn, { backgroundColor: theme.colors.danger + '10' }]}>
                            <HugeiconsIcon icon={Delete02Icon} size={16} color={theme.colors.danger} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
            </ScaleDecorator>
        );
    }, [theme, toggleItem]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View
                    entering={FadeIn.duration(220)}
                    exiting={FadeOut.duration(220)}
                    style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} disabled={isDragging} />
                </Animated.View>

                <Animated.View style={[
                    styles.sheet,
                    { backgroundColor: theme.colors.card, height: sheetHeight },
                    animatedStyle
                ]}>
                    <View style={styles.handleContainer}>
                        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                    </View>

                    <ModalHeader
                        title="Customize Job Card"
                        subtitle="Drag to reorder"
                        onClose={close}
                        position="bottom"
                    />

                    <View style={{ flex: 1 }}>
                        <DraggableFlatList
                            data={activeItems}
                            onDragBegin={() => setIsDragging(true)}
                            onRelease={() => setIsDragging(false)}
                            onDragEnd={({ data }) => {
                                setIsDragging(false);
                                setActiveKeys(data.map(i => i.key));
                            }}
                            keyExtractor={(item) => item.key}
                            renderItem={renderActiveItem}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                            animationConfig={{ damping: 18, stiffness: 220 }}
                            activationDistance={14}
                            autoscrollThreshold={48}
                            autoscrollSpeed={160}
                            dragItemOverflow
                            scrollEnabled
                            ListFooterComponent={
                                inactiveItems.length > 0 ? (
                                    <View style={{ marginTop: 12 }}>
                                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                                            AVAILABLE DETAILS
                                        </Text>
                                        {inactiveItems.map((item) => (
                                            <TouchableOpacity
                                                key={item.key}
                                                onPress={() => toggleItem(item.key, false)}
                                                activeOpacity={0.7}
                                                style={[
                                                    styles.inactiveItem,
                                                    {
                                                        backgroundColor: theme.colors.background,
                                                        borderColor: theme.colors.border,
                                                    }
                                                ]}
                                            >
                                                <View style={styles.itemLeft}>
                                                    <View style={[styles.iconBox, { backgroundColor: theme.colors.card }]}>
                                                        <HugeiconsIcon icon={Add01Icon} size={18} color={theme.colors.primary} />
                                                    </View>
                                                    <Text style={[styles.inactiveItemLabel, { color: theme.colors.textSecondary }]}> 
                                                        {item.label}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : null
                            }
                        />
                    </View>

                    <View style={[
                        styles.footer,
                        {
                            backgroundColor: theme.colors.card,
                            borderTopColor: theme.colors.border,
                            paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24,
                        }
                    ]}>
                        <Button title="Save Layout" variant="primary" onPress={handleSave} />
                    </View>
                </Animated.View>
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
        position: 'absolute',
        bottom: 0,
    },
    handleContainer: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 164,
        paddingTop: 14,
    },
    sectionTitle: {
        fontSize: 10,
        fontFamily: 'Nunito_700Bold',
        opacity: 0.6,
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        borderRadius: 14,
        height: ITEM_HEIGHT,
    },
    inactiveItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        height: ITEM_HEIGHT,
        borderRadius: 14,
        marginBottom: ROW_GAP,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    itemLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    itemLabel: {
        fontSize: 14,
        letterSpacing: -0.2,
        fontFamily: 'Nunito_600SemiBold'
    },
    inactiveItemLabel: {
        fontSize: 14,
        letterSpacing: -0.2,
        fontFamily: 'Nunito_600SemiBold'
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center'
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 24,
        borderTopWidth: 1
    }
});
