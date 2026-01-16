import {
    Cancel01Icon,
    CheckmarkCircle02Icon,
    Download01Icon,
    Share01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as FileSystem from 'expo-file-system';
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
    View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeInUp,
    FadeOutUp,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageViewerProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
}

export default function ImageViewer({ visible, imageUri, onClose }: ImageViewerProps) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Animation Values
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            opacity.value = withTiming(1, { duration: 300 });
            resetTransform();
        } else {
            opacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const resetTransform = () => {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    };

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
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
                // Fade out background on drag down
                opacity.value = withTiming(1 - Math.abs(e.translationY) / 500, { duration: 0 });
            }
        })
        .onEnd((e) => {
            if (scale.value > 1) {
                savedTranslateX.value = translateX.value;
                savedTranslateY.value = translateY.value;
            } else {
                if (Math.abs(e.translationY) > 100) {
                    runOnJS(onClose)();
                } else {
                    translateY.value = withSpring(0);
                    opacity.value = withTiming(1);
                }
            }
        });

    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ]
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        backgroundColor: 'rgba(0,0,0,0.95)'
    }));

    const handleSave = async () => {
        if (!imageUri) return;
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                setToast({ message: "Permission required to save photos.", type: 'error' });
                return;
            }
            setLoading(true);
            let uriToSave = imageUri;
            if (imageUri.startsWith('http')) {
                const filename = imageUri.split('/').pop() || `img_${Date.now()}.jpg`;
                const fileUri = FileSystem.documentDirectory + filename;
                const { uri } = await FileSystem.downloadAsync(imageUri, fileUri);
                uriToSave = uri;
            }
            await MediaLibrary.saveToLibraryAsync(uriToSave);
            setToast({ message: "Image saved to gallery", type: 'success' });
        } catch (e) {
            setToast({ message: "Failed to save image", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!imageUri) return;
        try {
            await Share.share({ url: imageUri });
        } catch (e) {
            // ignore
        }
    };

    if (!visible || !imageUri) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <Animated.View style={[StyleSheet.absoluteFill, animatedBackdropStyle]}>
                    
                    {/* Safe Area Header */}
                    <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
                        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                            <HugeiconsIcon icon={Cancel01Icon} size={24} color="#fff" />
                        </TouchableOpacity>
                        
                        <View style={styles.actions}>
                            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
                                <HugeiconsIcon icon={Share01Icon} size={22} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSave} style={styles.iconBtn} disabled={loading}>
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : <HugeiconsIcon icon={Download01Icon} size={22} color="#fff" />}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Toast Notification */}
                    {toast && (
                        <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.toast}>
                            <HugeiconsIcon 
                                icon={toast.type === 'success' ? CheckmarkCircle02Icon : Cancel01Icon} 
                                size={18} 
                                color={toast.type === 'success' ? '#4ade80' : '#f87171'} 
                            />
                            <Text style={styles.toastText}>{toast.message}</Text>
                        </Animated.View>
                    )}

                    {/* Main Image */}
                    <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
                        <View style={styles.container}>
                            <Animated.Image 
                                source={{ uri: imageUri }} 
                                style={[styles.image, animatedImageStyle]} 
                                resizeMode="contain" 
                            />
                        </View>
                    </GestureDetector>

                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: SCREEN_WIDTH,
        height: '100%',
    },
    toast: {
        position: 'absolute',
        top: 100,
        alignSelf: 'center',
        backgroundColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 30,
        gap: 8,
        zIndex: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5
    },
    toastText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    }
});