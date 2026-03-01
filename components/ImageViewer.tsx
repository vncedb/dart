import {
    Cancel01Icon,
    CheckmarkCircle02Icon,
    Download01Icon,
    Share08Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    FadeInUp,
    FadeOut,
    FadeOutUp,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
}

export default function ImageViewer({ visible, imageUri, onClose }: ImageViewerProps) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [controlsVisible, setControlsVisible] = useState(true);

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const backdropOpacity = useSharedValue(1);

    useEffect(() => {
        if (visible && imageUri) {
            backdropOpacity.value = withTiming(1, { duration: 250 });
            resetTransform();
        } else {
            backdropOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible, imageUri]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 2500);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const resetTransform = () => {
        scale.value = withSpring(1, { damping: 18, stiffness: 120 });
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    };

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withSpring(1, { damping: 18, stiffness: 120 });
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else if (scale.value > 4) {
                scale.value = withSpring(4);
                savedScale.value = 4;
            } else {
                savedScale.value = scale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            } else {
                translateY.value = e.translationY;
                backdropOpacity.value = Math.max(0.3, 1 - Math.abs(e.translationY) / 400);
            }
        })
        .onEnd((e) => {
            if (scale.value > 1) {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            } else {
                if (Math.abs(e.translationY) > 80 || Math.abs(e.velocityY) > 300) {
                    runOnJS(onClose)();
                } else {
                    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
                    backdropOpacity.value = withTiming(1);
                }
            }
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                scale.value = withSpring(2.5);
                savedScale.value = 2.5;
            }
        });

    const tapGesture = Gesture.Tap()
        .onEnd(() => {
            runOnJS(setControlsVisible)((v) => !v);
        });

    const composedGesture = Gesture.Simultaneous(
        pinchGesture,
        Gesture.Race(panGesture, doubleTapGesture, tapGesture)
    );

    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
        backgroundColor: '#0a0a0a',
    }));

    const handleSave = async () => {
        if (!imageUri) return;
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                setToast({ message: 'Permission required to save photos', type: 'error' });
                return;
            }
            setLoading(true);
            let uriToSave = imageUri;
            if (imageUri.startsWith('http')) {
                const filename = imageUri.split('/').pop() || `img_${Date.now()}.jpg`;
                const fileUri = (FileSystem.documentDirectory || FileSystem.cacheDirectory || '') + filename;
                const { uri } = await FileSystem.downloadAsync(imageUri, fileUri);
                uriToSave = uri;
            }
            await MediaLibrary.saveToLibraryAsync(uriToSave);
            setToast({ message: 'Saved to gallery', type: 'success' });
        } catch {
            setToast({ message: 'Failed to save', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!imageUri) return;
        try {
            await Share.share({ url: imageUri });
        } catch {
            /* ignore */
        }
    };

    if (!visible || !imageUri) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <GestureHandlerRootView style={styles.root}>
                <Animated.View style={[StyleSheet.absoluteFill, animatedBackdropStyle]}>
                    {/* Header - minimal, auto-hide */}
                    {controlsVisible && (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(150)}
                            style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}
                        >
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.headerBtn}
                                activeOpacity={0.7}
                            >
                                <HugeiconsIcon icon={Cancel01Icon} size={24} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.headerActions}>
                                <TouchableOpacity onPress={handleShare} style={styles.headerBtn} activeOpacity={0.7}>
                                    <HugeiconsIcon icon={Share08Icon} size={22} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSave}
                                    style={styles.headerBtn}
                                    disabled={loading}
                                    activeOpacity={0.7}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <HugeiconsIcon icon={Download01Icon} size={22} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}

                    {/* Hint - tap to toggle controls */}
                    {!controlsVisible && (
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            onPress={() => setControlsVisible(true)}
                            activeOpacity={1}
                        />
                    )}

                    {/* Toast */}
                    {toast && (
                        <Animated.View
                            entering={FadeInUp.duration(250)}
                            exiting={FadeOutUp.duration(200)}
                            style={styles.toast}
                        >
                            <HugeiconsIcon
                                icon={toast.type === 'success' ? CheckmarkCircle02Icon : Cancel01Icon}
                                size={20}
                                color={toast.type === 'success' ? '#4ade80' : '#f87171'}
                            />
                            <Text style={styles.toastText}>{toast.message}</Text>
                        </Animated.View>
                    )}

                    {/* Image */}
                    <GestureDetector gesture={composedGesture}>
                        <View style={styles.imageContainer}>
                            <Animated.Image
                                source={{ uri: imageUri }}
                                style={[styles.image, animatedImageStyle]}
                                resizeMode="contain"
                            />
                        </View>
                    </GestureDetector>

                    {/* Bottom hint - only when controls visible */}
                    {controlsVisible && (
                        <Animated.View
                            entering={FadeIn.duration(200)}
                            exiting={FadeOut.duration(150)}
                            style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}
                        >
                            <Text style={styles.footerHint}>Pinch to zoom • Double-tap to zoom • Swipe down to close</Text>
                        </Animated.View>
                    )}
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0a0a0a' },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        zIndex: 10,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.7,
    },
    toast: {
        position: 'absolute',
        top: 120,
        alignSelf: 'center',
        backgroundColor: 'rgba(30,30,30,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 10,
        zIndex: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    toastText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: 'Nunito_600SemiBold',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    footerHint: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 12,
        fontFamily: 'Nunito_500Medium',
    },
});
