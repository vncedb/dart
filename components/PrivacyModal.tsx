import { SecurityCheckIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../constants/theme';
import Button from './Button';
import ModalHeader from './ModalHeader';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SHEET_HEIGHT = 440; 
const SNAP_OPEN = 0;
const SNAP_CLOSE = SHEET_HEIGHT;

interface PrivacyModalProps {
    visible: boolean;
    onClose: () => void;
    onAgree?: () => void;
    isLoading?: boolean;
}

export default function PrivacyModal({ visible, onClose, onAgree, isLoading = false }: PrivacyModalProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    
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

    const handleAgree = () => {
        if (!isLoading && onAgree) {
            onAgree();
        }
    };

    const openLink = (path: any) => {
        close();
        setTimeout(() => {
            router.push(path);
        }, 300);
    };

    const pan = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            let newY = context.value.y + event.translationY;
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

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={close} statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} disabled={isLoading} />
                </Animated.View>

                <GestureDetector gesture={pan}>
                    <Animated.View style={[
                        styles.sheetContainer, 
                        { backgroundColor: theme.colors.background, paddingBottom: insets.bottom + 24 },
                        animatedStyle
                    ]}>
                        
                        <View style={styles.dragHandleArea}>
                            <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
                        </View>

                        <ModalHeader 
                            title="Legal & Privacy" 
                            subtitle="Review our terms before continuing"
                            onClose={close}
                            position="bottom" 
                        />

                        <View style={styles.content}>
                            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                                <HugeiconsIcon icon={SecurityCheckIcon} size={42} color={theme.colors.primary} />
                            </View>

                            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                                By tapping &quot;Agree &amp; Continue&quot;, you acknowledge that you have read and agree to DART&quot;s{' '}
                                <Text 
                                    style={[styles.hyperlink, { color: theme.colors.primary }]} 
                                    // UPDATED PATH HERE
                                    onPress={() => openLink('/settings/docs/terms-of-service')}
                                >
                                    Terms of Service
                                </Text>
                                {' '}and{' '}
                                <Text 
                                    style={[styles.hyperlink, { color: theme.colors.primary }]} 
                                    // UPDATED PATH HERE
                                    onPress={() => openLink('/settings/docs/privacy-details')}
                                >
                                    Privacy Policy
                                </Text>.
                            </Text>
                        </View>

                        <View style={styles.footer}>
                            <Button 
                                title="Agree & Continue"
                                variant="primary"
                                onPress={handleAgree}
                                isLoading={isLoading}
                                disabled={isLoading}
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
    sheetContainer: {
        width: '100%',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        position: 'absolute',
        bottom: 0,
    },
    dragHandleArea: { width: '100%', height: 24, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
    dragHandle: { width: 48, height: 5, borderRadius: 2.5, opacity: 0.5 },
    content: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 32, alignItems: 'center' },
    iconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    description: { fontSize: 15, lineHeight: 24, textAlign: 'center', fontFamily: 'Nunito_500Medium' },
    hyperlink: { fontFamily: 'Nunito_700Bold' },
    footer: { paddingHorizontal: 24 },
});