import {
    Add01Icon,
    Delete02Icon,
    Menu01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useMemo, useState } from 'react';
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
    ShadowDecorator
} from 'react-native-draggable-flatlist';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
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
import Button from './Button';
import ModalHeader from './ModalHeader';

export const AVAILABLE_JOB_FIELDS = [
    { key: 'employment_status', label: 'Employment Status' },
    { key: 'shift', label: 'Shift Schedule' },
    { key: 'rate', label: 'Pay Rate' },
    { key: 'rate_type', label: 'Pay Type' },
    { key: 'payroll', label: 'Payroll Schedule' },
    { key: 'breaks', label: 'Unpaid Breaks' },
];

interface EditDisplayModalProps {
    visible: boolean;
    onClose: () => void;
    selectedKeys: string[];
    onSave: (keys: string[]) => void;
}

// --- Dynamic Height Calculation ---
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Exact measurements to match content
const HEADER_HEIGHT = 80; 
const ITEM_HEIGHT = 68; // 52px item + 8px margin + borders
const SECTION_HEADER_HEIGHT = 50; 
const FOOTER_HEIGHT = Platform.OS === 'ios' ? 100 : 90; 
const HANDLE_HEIGHT = 30;
const LIST_PADDING = 24;

const TOTAL_ITEMS = AVAILABLE_JOB_FIELDS.length;
const TOTAL_CONTENT_HEIGHT = HEADER_HEIGHT + (TOTAL_ITEMS * ITEM_HEIGHT) + SECTION_HEADER_HEIGHT + FOOTER_HEIGHT + HANDLE_HEIGHT + LIST_PADDING;

// Cap at 92% of screen, otherwise use exact content height
const SHEET_HEIGHT = Math.min(TOTAL_CONTENT_HEIGHT, SCREEN_HEIGHT * 0.92);

const SNAP_OPEN = 0; 
const SNAP_CLOSE = SHEET_HEIGHT; 

export default function EditDisplayModal({
    visible,
    onClose,
    selectedKeys,
    onSave
}: EditDisplayModalProps) {
    const theme = useAppTheme();
    const [activeKeys, setActiveKeys] = useState<string[]>([]);
    
    // Reanimated Values
    const translateY = useSharedValue(SNAP_CLOSE);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        if (visible) {
            setActiveKeys(selectedKeys);
            translateY.value = SNAP_CLOSE;
            // Slide up to 0 (fully visible)
            translateY.value = withTiming(SNAP_OPEN, { 
                duration: 350, 
                easing: Easing.out(Easing.quad) 
            });
        }
    }, [visible, selectedKeys]);

    const close = () => {
        translateY.value = withTiming(SNAP_CLOSE, { duration: 250 }, () => {
            runOnJS(onClose)();
        });
    };

    const handleSave = () => {
        onSave(activeKeys);
        close();
    };

    // Memoized Lists
    const activeItems = useMemo(() => 
        activeKeys.map(key => AVAILABLE_JOB_FIELDS.find(f => f.key === key)).filter(Boolean) as typeof AVAILABLE_JOB_FIELDS,
    [activeKeys]);

    const inactiveItems = useMemo(() => 
        AVAILABLE_JOB_FIELDS.filter(f => !activeKeys.includes(f.key)),
    [activeKeys]);

    const toggleItem = (key: string, isActive: boolean) => {
        if (isActive) setActiveKeys(prev => prev.filter(k => k !== key));
        else setActiveKeys(prev => [...prev, key]);
    };

    // --- Gestures ---
    const pan = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            let newY = context.value.y + event.translationY;
            // Resistance when dragging up past the top
            if (newY < SNAP_OPEN) newY = SNAP_OPEN + (newY - SNAP_OPEN) * 0.2;
            translateY.value = newY;
        })
        .onEnd((event) => {
            const { velocityY, translationY } = event;
            // Dragging down -> Close
            if (velocityY > 500 || (translationY > 100 && velocityY > -500)) {
                runOnJS(close)();
            } else {
                // Snap back to open
                translateY.value = withTiming(SNAP_OPEN, { duration: 300, easing: Easing.out(Easing.quad) });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    // Render Active Item
    const renderActiveItem = ({ item, drag, isActive }: RenderItemParams<typeof AVAILABLE_JOB_FIELDS[0]>) => {
        return (
            <ShadowDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    activeOpacity={0.9}
                    style={[
                        styles.item,
                        {
                            backgroundColor: isActive ? theme.colors.card : theme.colors.card,
                            borderColor: isActive ? theme.colors.primary : 'transparent',
                            borderWidth: isActive ? 1.5 : 0,
                            elevation: isActive ? 6 : 0,
                            shadowColor: "#000",
                            shadowOpacity: isActive ? 0.15 : 0,
                            shadowRadius: 10,
                            transform: [{ scale: isActive ? 1.02 : 1 }]
                        }
                    ]}
                >
                    <View style={styles.itemLeft}>
                        <TouchableOpacity 
                            onLongPress={drag} 
                            delayLongPress={50} 
                            style={[styles.iconBox, { backgroundColor: theme.colors.background }]}
                        >
                            <HugeiconsIcon icon={Menu01Icon} size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                        
                        <Text style={[styles.itemLabel, { color: theme.colors.text }]}>
                            {item.label}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => toggleItem(item.key, true)} hitSlop={12}>
                        <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </TouchableOpacity>
            </ShadowDecorator>
        );
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                {/* Backdrop */}
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>

                {/* Draggable Sheet */}
                <GestureDetector gesture={pan}>
                    <Animated.View style={[
                        styles.sheet, 
                        { 
                            backgroundColor: theme.colors.card, 
                            height: SHEET_HEIGHT, // Dynamically set to content height
                        },
                        animatedStyle
                    ]}>
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                        </View>

                        <ModalHeader 
                            title="Customize Job Card" 
                            subtitle="Hold and drag to reorder" 
                            onClose={close} 
                            position="bottom"
                        />

                        {/* Content Area */}
                        <View style={{ flex: 1 }}>
                            <DraggableFlatList
                                data={activeItems}
                                onDragEnd={({ data }) => setActiveKeys(data.map(i => i.key))}
                                keyExtractor={(item) => item.key}
                                renderItem={renderActiveItem}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.listContent}
                                activationDistance={10}
                                scrollEnabled={true} 
                                ListFooterComponent={
                                    inactiveItems.length > 0 ? (
                                        <View style={{ marginTop: 24 }}>
                                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                                                UNUSED DETAILS
                                            </Text>
                                            {inactiveItems.map((item) => (
                                                <TouchableOpacity
                                                    key={item.key}
                                                    onPress={() => toggleItem(item.key, false)}
                                                    activeOpacity={0.7}
                                                    style={[
                                                        styles.item,
                                                        { 
                                                            backgroundColor: theme.colors.background,
                                                            marginBottom: 8 
                                                        }
                                                    ]}
                                                >
                                                    <View style={styles.itemLeft}>
                                                        <View style={[styles.iconBox, { backgroundColor: theme.colors.card }]}>
                                                            <HugeiconsIcon icon={Add01Icon} size={20} color={theme.colors.primary} />
                                                        </View>
                                                        <Text style={[styles.itemLabel, { color: theme.colors.textSecondary }]}>
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

                        {/* Sticky Footer */}
                        <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
                            <Button title="Save Changes" variant="primary" onPress={handleSave} />
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
        bottom: 0,
    },
    handleContainer: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
    
    // List Content
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 130, // Extra padding to clear the absolute footer
        paddingTop: 8,
        gap: 8
    },
    sectionTitle: { 
        fontSize: 11, 
        fontWeight: '800', 
        opacity: 0.5, 
        marginBottom: 12, 
        letterSpacing: 0.8, 
        textTransform: 'uppercase' 
    },
    
    // Item Styles
    item: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 12, 
        paddingRight: 16,
        borderRadius: 16,
        marginBottom: 8
    },
    itemLeft: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 12 
    },
    iconBox: { 
        width: 36, 
        height: 36, 
        borderRadius: 10, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    itemLabel: { 
        fontSize: 14, 
        letterSpacing: -0.1,
        fontWeight: '500'
    },
    
    // Footer
    footer: { 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        padding: 24, 
        paddingBottom: Platform.OS === 'ios' ? 40 : 24, 
        borderTopWidth: 1 
    }
});