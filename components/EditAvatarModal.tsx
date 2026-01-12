import {
    Camera01Icon,
    Cancel01Icon,
    Delete02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect } from 'react';
import {
    Modal,
    Platform,
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
    withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import Button from './Button';
import ListButton from './ListButton';

interface EditAvatarModalProps {
    visible: boolean;
    onClose: () => void;
    onPickImage: () => void;
    onRemoveImage: () => void;
}

export default function EditAvatarModal({
    visible,
    onClose,
    onPickImage,
    onRemoveImage
}: EditAvatarModalProps) {
    const theme = useAppTheme();
    const translateY = useSharedValue(0);

    useEffect(() => {
        if (visible) translateY.value = 0;
    }, [visible]);

    const close = () => {
        onClose();
    };

    // Drag-to-dismiss gesture
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

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                {/* Backdrop Fade */}
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={styles.backdrop}
                >
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
                </Animated.View>

                {/* Draggable Sheet - Simple Slide Up */}
                <GestureDetector gesture={pan}>
                    <Animated.View 
                        entering={SlideInDown.duration(400).easing(Easing.out(Easing.quad))} 
                        exiting={SlideOutDown.duration(300)}
                        style={[styles.modalContainerWrapper]}
                    >
                        <Animated.View style={[
                            styles.modalContainer, 
                            { backgroundColor: theme.colors.card },
                            animatedSheetStyle
                        ]}>
                            <View style={styles.header}>
                                <View>
                                    <Text style={[styles.title, { color: theme.colors.text }]}>Edit Profile Picture</Text>
                                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Change your look</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={close} 
                                    style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.content}>
                                <ListButton 
                                    title="Choose from Library"
                                    subtitle="Select a photo from your gallery"
                                    icon={Camera01Icon}
                                    onPress={onPickImage}
                                />
                                
                                <ListButton 
                                    title="Remove Current Photo"
                                    subtitle="Revert to default avatar"
                                    icon={Delete02Icon}
                                    iconColor="#ef4444"
                                    onPress={onRemoveImage}
                                />

                                <View style={{ marginTop: 8 }}>
                                    <Button 
                                        title="Cancel" 
                                        variant="secondary" 
                                        onPress={close} 
                                        fullWidth
                                    />
                                </View>
                            </View>
                        </Animated.View>
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContainerWrapper: { width: '100%' },
    modalContainer: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
        borderBottomColor: 'rgba(0,0,0,0.05)'
    },
    title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
    subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    closeBtn: { padding: 8, borderRadius: 50 },
    content: { padding: 24, paddingTop: 16 },
});