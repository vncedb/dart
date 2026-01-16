import {
    Add01Icon,
    Delete02Icon,
    Menu01Icon
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
    ShadowDecorator
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

export default function EditDisplayModal({
    visible,
    onClose,
    selectedKeys,
    onSave
}: EditDisplayModalProps) {
    const theme = useAppTheme();
    const [activeKeys, setActiveKeys] = useState<string[]>([]);
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            translateY.value = 0;
            setActiveKeys(selectedKeys);
        }
    }, [visible, selectedKeys]);

    const activeItems = activeKeys.map(key => AVAILABLE_JOB_FIELDS.find(f => f.key === key)).filter(Boolean) as typeof AVAILABLE_JOB_FIELDS;
    const inactiveItems = AVAILABLE_JOB_FIELDS.filter(f => !activeKeys.includes(f.key));

    const toggleItem = (key: string, isActive: boolean) => {
        if (isActive) setActiveKeys(prev => prev.filter(k => k !== key));
        else setActiveKeys(prev => [...prev, key]);
    };

    const handleSave = () => {
        onSave(activeKeys);
        onClose();
    };

    const close = () => onClose();

    const pan = Gesture.Pan()
        .onChange((event) => {
            if (event.translationY > 0) translateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (event.translationY > 100 || event.velocityY > 500) runOnJS(close)();
            else translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
        });

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    const renderActiveItem = ({ item, drag, isActive }: RenderItemParams<typeof AVAILABLE_JOB_FIELDS[0]>) => {
        return (
            <ShadowDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    activeOpacity={1}
                    style={[
                        styles.itemRow,
                        {
                            backgroundColor: theme.colors.card,
                            borderColor: isActive ? theme.colors.primary : theme.colors.border,
                            borderWidth: 1,
                            elevation: isActive ? 5 : 0
                        }
                    ]}
                >
                    <TouchableOpacity onLongPress={drag} delayLongPress={100} style={styles.dragHandle}>
                        <HugeiconsIcon icon={Menu01Icon} size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={styles.contentContainer}>
                        <Text style={[styles.itemLabel, { color: theme.colors.text }]}>{item.label}</Text>
                        <TouchableOpacity onPress={() => toggleItem(item.key, true)}>
                            <HugeiconsIcon icon={Delete02Icon} size={22} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </ShadowDecorator>
        );
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.backdrop}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
                </Animated.View>

                <Animated.View entering={SlideInDown.duration(400)} exiting={SlideOutDown.duration(300)} style={styles.modalContainerWrapper}>
                    <Animated.View style={[styles.modalContainer, { backgroundColor: theme.colors.card }, animatedSheetStyle]}>
                        <GestureDetector gesture={pan}>
                            <View>
                                {/* Bottom Modal: Left Aligned Title, Close on Right */}
                                <ModalHeader 
                                    title="Customize Job Card" 
                                    subtitle="Hold and drag to reorder" 
                                    onClose={close} 
                                    position="bottom"
                                />
                            </View>
                        </GestureDetector>

                        <View style={{ flex: 1 }}>
                            <DraggableFlatList
                                data={activeItems}
                                onDragEnd={({ data }) => setActiveKeys(data.map(i => i.key))}
                                keyExtractor={(item) => item.key}
                                renderItem={renderActiveItem}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                                activationDistance={10}
                                ListFooterComponent={
                                    inactiveItems.length > 0 ? (
                                        <View style={{ marginTop: 24 }}>
                                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Unused Details</Text>
                                            {inactiveItems.map((item) => (
                                                <TouchableOpacity
                                                    key={item.key}
                                                    onPress={() => toggleItem(item.key, false)}
                                                    style={[styles.itemRow, { backgroundColor: theme.colors.background, borderColor: 'transparent', borderWidth: 1 }]}
                                                >
                                                    <View style={[styles.dragHandle, { opacity: 0 }]}><HugeiconsIcon icon={Menu01Icon} size={20} /></View>
                                                    <View style={styles.contentContainer}>
                                                        <Text style={[styles.itemLabel, { color: theme.colors.textSecondary }]}>{item.label}</Text>
                                                        <HugeiconsIcon icon={Add01Icon} size={22} color={theme.colors.primary} variant="solid" />
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null
                                }
                            />
                        </View>

                        <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
                            <Button title="Save Changes" variant="primary" onPress={handleSave} />
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
    modalContainerWrapper: { flex: 1, justifyContent: 'flex-end' },
    modalContainer: { height: '75%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', elevation: 10 },
    sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
    itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, height: 58, marginBottom: 10 },
    dragHandle: { height: '100%', paddingLeft: 16, paddingRight: 12, justifyContent: 'center', alignItems: 'center' },
    contentContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', height: '100%', paddingRight: 16, justifyContent: 'space-between' },
    itemLabel: { fontSize: 15, fontWeight: '600' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1 }
});