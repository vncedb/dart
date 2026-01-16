import {
    Camera01Icon,
    Delete02Icon
} from '@hugeicons/core-free-icons';
import React, { useEffect } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    View
} from 'react-native';
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
import ListButton from './ListButton';
import ModalHeader from './ModalHeader';

interface EditAvatarModalProps {
    visible: boolean;
    onClose: () => void;
    onPickImage: () => void;
    onRemoveImage: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Smaller initial height since content is minimal
const INITIAL_HEIGHT = SCREEN_HEIGHT * 0.40; 
const MAX_HEIGHT = SCREEN_HEIGHT * 0.40; // No expansion needed for this modal
const SNAP_CLOSE = MAX_HEIGHT;
const SNAP_OPEN = MAX_HEIGHT - INITIAL_HEIGHT;

export default function EditAvatarModal({
    visible,
    onClose,
    onPickImage,
    onRemoveImage
}: EditAvatarModalProps) {
    const theme = useAppTheme();
    const translateY = useSharedValue(SNAP_CLOSE);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        if (visible) {
            translateY.value = SNAP_CLOSE;
            translateY.value = withTiming(SNAP_OPEN, { 
                duration: 350, 
                easing: Easing.out(Easing.quad) 
            });
        }
    }, [visible]);

    const close = () => {
        translateY.value = withTiming(SNAP_CLOSE, { duration: 250 }, () => {
            runOnJS(onClose)();
        });
    };

    const pan = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            let newY = context.value.y + event.translationY;
            // Elasticity at top
            if (newY < SNAP_OPEN) newY = SNAP_OPEN + (newY - SNAP_OPEN) * 0.2;
            translateY.value = newY;
        })
        .onEnd((event) => {
            if (event.translationY > 100 || event.velocityY > 500) {
                runOnJS(close)();
            } else {
                translateY.value = withTiming(SNAP_OPEN, { duration: 300, easing: Easing.out(Easing.quad) });
            }
        });

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={close} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                {/* Backdrop: Fade In Only */}
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
                        { backgroundColor: theme.colors.card, height: MAX_HEIGHT },
                        animatedSheetStyle
                    ]}>
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
                        </View>

                        <ModalHeader 
                            title="Edit Profile Picture" 
                            subtitle="Change your look" 
                            onClose={close} 
                            position="bottom"
                        />

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
    content: { padding: 24, paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
});