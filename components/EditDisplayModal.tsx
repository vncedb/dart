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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const HEADER_HEIGHT = 80; 
const ITEM_HEIGHT = 70;
const SECTION_HEADER_HEIGHT = 50; 
const FOOTER_HEIGHT = Platform.OS === 'ios' ? 100 : 90; 
const HANDLE_HEIGHT = 30;
const LIST_PADDING = 24;

const TOTAL_ITEMS = AVAILABLE_JOB_FIELDS.length;
const TOTAL_CONTENT_HEIGHT = HEADER_HEIGHT + (TOTAL_ITEMS * ITEM_HEIGHT) + SECTION_HEADER_HEIGHT + FOOTER_HEIGHT + HANDLE_HEIGHT + LIST_PADDING;

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
    
    const translateY = useSharedValue(SNAP_CLOSE);

    useEffect(() => {
        if (visible) {
            setActiveKeys(selectedKeys);
            translateY.value = SNAP_CLOSE;
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

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    const renderActiveItem = ({ item, drag, isActive }: RenderItemParams<typeof AVAILABLE_JOB_FIELDS[0]>) => {
        return (
            <ShadowDecorator>
                <View style={[{ paddingVertical: 5 }, isActive && { zIndex: 999 }]}>
                    <TouchableOpacity
                        activeOpacity={0.95}
                        style={[
                            styles.item,
                            {
                                // When active/dragging use card, otherwise use background to contrast with the modal sheet
                                backgroundColor: isActive ? theme.colors.card : theme.colors.background,
                                borderColor: isActive ? theme.colors.primary : theme.colors.border,
                                borderWidth: 1,
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: isActive ? 6 : 0 },
                                shadowOpacity: isActive ? 0.15 : 0,
                                shadowRadius: isActive ? 8 : 0,
                                elevation: isActive ? 8 : 0,
                                transform: [{ scale: isActive ? 1.03 : 1 }]
                            }
                        ]}
                    >
                        <View style={styles.itemLeft}>
                            {/* Smooth drag execution with hitSlop */}
                            <TouchableOpacity 
                                onPressIn={drag} 
                                style={[styles.iconBox, { backgroundColor: isActive ? theme.colors.primary + '15' : theme.colors.card }]}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                <HugeiconsIcon icon={Menu01Icon} size={20} color={isActive ? theme.colors.primary : theme.colors.textSecondary} />
                            </TouchableOpacity>
                            
                            {/* Fixed structural wrapper to prevent text glitches on active */}
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={[styles.itemLabel, { color: theme.colors.text }]} numberOfLines={1}>
                                    {item.label}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity onPress={() => toggleItem(item.key, true)} hitSlop={12} style={[styles.removeBtn, { backgroundColor: theme.colors.danger + '10' }]}>
                            <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </View>
            </ShadowDecorator>
        );
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>

                <Animated.View style={[
                    styles.sheet, 
                    // Set exactly to theme.colors.card to match EditAvatarModal
                    { backgroundColor: theme.colors.card, height: SHEET_HEIGHT },
                    animatedStyle
                ]}>
                    <View style={styles.handleContainer}>
                        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                    </View>

                    <ModalHeader 
                        title="Customize Job Card" 
                        subtitle="Hold and drag to arrange items" 
                        onClose={close} 
                        position="bottom"
                    />

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
                                                        <HugeiconsIcon icon={Add01Icon} size={20} color={theme.colors.primary} />
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

                    <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
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
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 130, 
        paddingTop: 8,
    },
    sectionTitle: { 
        fontSize: 11, 
        fontWeight: '800', 
        opacity: 0.6, 
        marginBottom: 12, 
        letterSpacing: 1, 
        textTransform: 'uppercase' 
    },
    item: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 14, 
        paddingRight: 16,
        borderRadius: 18,
    },
    inactiveItem: {
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 14, 
        paddingRight: 16,
        borderRadius: 18,
        marginBottom: 8,
        borderWidth: 1,
        borderStyle: 'dashed'
    },
    itemLeft: { 
        flex: 1,
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 14 
    },
    iconBox: { 
        width: 38, 
        height: 38, 
        borderRadius: 12, 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    itemLabel: { 
        fontSize: 15, 
        letterSpacing: -0.2,
        fontWeight: '700'
    },
    inactiveItemLabel: {
        fontSize: 15, 
        letterSpacing: -0.2,
        fontWeight: '600'
    },
    removeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center'
    },
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