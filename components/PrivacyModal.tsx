import {
  ArrowDown01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  SecurityCheckIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PrivacyModalProps {
    visible: boolean;
    onClose: () => void;
    onAgree?: () => void;
}

const Section = ({ title, content, theme }: { title: string, content: string, theme: any }) => (
    <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.sectionContent, { color: theme.colors.textSecondary }]}>{content}</Text>
    </View>
);

export default function PrivacyModal({ visible, onClose, onAgree }: PrivacyModalProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    
    // Logic State
    const [isAtBottom, setIsAtBottom] = useState(false);
    const [showModal, setShowModal] = useState(visible);

    // Animation Values (Reanimated)
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const opacity = useSharedValue(0);
    const bounceY = useSharedValue(0);
    const indicatorOpacity = useSharedValue(1);

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            translateY.value = withSpring(0, { damping: 15 });
            opacity.value = withTiming(1);
            setIsAtBottom(false);
            indicatorOpacity.value = withTiming(1);
        } else {
            translateY.value = withTiming(SCREEN_HEIGHT, {}, () => {
                runOnJS(setShowModal)(false);
            });
            opacity.value = withTiming(0);
        }
    }, [visible]);

    // Scroll Indicator Animation Loop
    useEffect(() => {
        if (showModal && !isAtBottom) {
            bounceY.value = withRepeat(
                withSequence(
                    withTiming(8, { duration: 700 }),
                    withTiming(0, { duration: 700 })
                ),
                -1, // Infinite repeat
                false
            );
        } else {
            indicatorOpacity.value = withTiming(0, { duration: 300 });
        }
    }, [isAtBottom, showModal]);

    // Drag Gesture Logic
    const context = useSharedValue({ y: 0 });
    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            // Only allow dragging downwards
            translateY.value = Math.max(event.translationY + context.value.y, 0);
        })
        .onEnd(() => {
            if (translateY.value > SCREEN_HEIGHT / 4) {
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    const indicatorStyle = useAnimatedStyle(() => ({
        opacity: indicatorOpacity.value,
        transform: [{ translateY: bounceY.value }]
    }));

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        // Check if close to bottom (50px threshold)
        const isClose = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
        if (isClose && !isAtBottom) {
            setIsAtBottom(true);
        }
    };

    const handleAgree = () => {
        if (isAtBottom) {
            onAgree?.();
            onClose();
        }
    };

    if (!showModal) return null;

    return (
        <Modal transparent visible={showModal} animationType="none" onRequestClose={onClose}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.overlay}>
                    {/* Backdrop */}
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, backdropStyle]}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
                    </Animated.View>

                    {/* Bottom Sheet */}
                    <GestureDetector gesture={gesture}>
                        <Animated.View style={[
                            styles.sheetContainer, 
                            { backgroundColor: theme.colors.background, paddingBottom: insets.bottom },
                            animatedStyle
                        ]}>
                            {/* Drag Handle Area */}
                            <View style={styles.dragHandleArea}>
                                <View style={[styles.dragHandle, { backgroundColor: theme.colors.border }]} />
                            </View>

                            {/* Header */}
                            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                        <HugeiconsIcon icon={SecurityCheckIcon} size={20} color={theme.colors.primary} />
                                    </View>
                                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Terms & Privacy</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={onClose} 
                                    style={[styles.closeButton, { backgroundColor: theme.colors.card }]}
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>

                            {/* Content */}
                            <View style={{ flex: 1, position: 'relative' }}>
                                {/* Use GestureHandler ScrollView for better nesting support */}
                                <ScrollView 
                                    onScroll={handleScroll}
                                    scrollEventThrottle={16}
                                    contentContainerStyle={styles.content}
                                    showsVerticalScrollIndicator={true}
                                >
                                    <Text style={[styles.intro, { color: theme.colors.text }]}>
                                        By using DART, you agree to the following terms regarding the collection and use of your personal data.
                                    </Text>

                                    <Section 
                                        title="1. Data Collection" 
                                        theme={theme}
                                        content="We collect information strictly necessary for the app's functionality, including your name, email, and attendance logs. This data is used to generate accurate work reports."
                                    />

                                    <Section 
                                        title="2. Secure Storage" 
                                        theme={theme}
                                        content="Your data is encrypted and stored securely using industry-standard protocols. Sensitive actions require additional verification."
                                    />

                                    <Section 
                                        title="3. Biometrics" 
                                        theme={theme}
                                        content="If you enable biometric login, your fingerprint or face data remains on your device and is never shared with our servers."
                                    />

                                    <Section 
                                        title="4. Account Control" 
                                        theme={theme}
                                        content="You maintain full control over your data. You can request a complete data wipe and account deletion at any time via the Settings menu."
                                    />
                                    
                                    <Section 
                                        title="5. Updates" 
                                        theme={theme}
                                        content="We may update this policy periodically. Continued use of the application implies acceptance of any changes."
                                    />

                                    <View style={{ height: 20 }} />
                                </ScrollView>

                                {/* Floating Scroll Indicator */}
                                <Animated.View 
                                    style={[
                                        styles.scrollIndicator, 
                                        { 
                                            backgroundColor: theme.colors.card, 
                                            shadowColor: "#000",
                                            borderColor: theme.colors.border,
                                        },
                                        indicatorStyle
                                    ]}
                                    pointerEvents="none"
                                >
                                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} color={theme.colors.primary} />
                                    <Text style={[styles.scrollText, { color: theme.colors.primary }]}>Scroll to read</Text>
                                </Animated.View>
                            </View>

                            {/* Footer */}
                            <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                                <TouchableOpacity 
                                    onPress={handleAgree}
                                    activeOpacity={0.8}
                                    disabled={!isAtBottom}
                                    style={[
                                        styles.agreeButton, 
                                        { 
                                            backgroundColor: isAtBottom ? theme.colors.primary : theme.colors.border,
                                            opacity: isAtBottom ? 1 : 0.5
                                        }
                                    ]}
                                >
                                    <Text style={[styles.agreeButtonText, { color: isAtBottom ? '#fff' : theme.colors.textSecondary }]}>
                                        {isAtBottom ? "Agree & Continue" : "Read to Continue"}
                                    </Text>
                                    {isAtBottom && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="#fff" />}
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </GestureDetector>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        height: '85%',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    dragHandleArea: {
        width: '100%',
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        opacity: 0.4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        padding: 24,
    },
    intro: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 24,
        lineHeight: 24,
        opacity: 0.9,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.8,
    },
    sectionContent: {
        fontSize: 15,
        lineHeight: 24,
    },
    scrollIndicator: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    scrollText: {
        fontSize: 12,
        fontWeight: '700',
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
    },
    agreeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 18,
        gap: 8,
    },
    agreeButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
});