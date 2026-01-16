import {
    Camera01Icon,
    Delete02Icon
} from '@hugeicons/core-free-icons';
import React, { useEffect } from 'react';
import {
    Modal,
    Platform,
    StyleSheet,
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
import ListButton from './ListButton';
import ModalHeader from './ModalHeader';

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

                {/* Draggable Sheet - Slide Up */}
                <Animated.View 
                    entering={SlideInDown.duration(400).easing(Easing.out(Easing.quad))} 
                    exiting={SlideOutDown.duration(300)}
                    style={styles.modalContainerWrapper}
                >
                    <GestureDetector gesture={pan}>
                        <Animated.View style={[
                            styles.modalContainer, 
                            { backgroundColor: theme.colors.card },
                            animatedSheetStyle
                        ]}>
                            {/* Unified Modal Header */}
                            <ModalHeader 
                                title="Edit Profile Picture" 
                                subtitle="Change your look" 
                                onClose={close} 
                                position="bottom"
                            />

                            {/* Content */}
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
                            </View>
                        </Animated.View>
                    </GestureDetector>
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
        justifyContent: 'flex-end' 
    },
    modalContainer: {
        width: '100%',
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
    content: { padding: 24, paddingTop: 16 },
});