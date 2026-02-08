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
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Modal Configuration
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85; // 85% of Screen

// FIX: Logic for bottom-anchored sheet
// Open = 0 (Normal position)
// Closed = SHEET_HEIGHT (Pushed completely down)
const SNAP_OPEN = 0;
const SNAP_CLOSE = SHEET_HEIGHT;

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

    // Animation Values (Reanimated)
    const translateY = useSharedValue(SNAP_CLOSE);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        if (visible) {
            setIsAtBottom(false);
            translateY.value = SNAP_CLOSE;
            // Animate to 0 (Visible)
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
        if (isAtBottom) {
            translateY.value = withTiming(SNAP_CLOSE, { duration: 250 }, () => {
                if (onAgree) runOnJS(onAgree)();
                runOnJS(onClose)(); // Ensure close is called
            });
        }
    };

    // Drag Gesture Logic
    const pan = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            let newY = context.value.y + event.translationY;
            // Prevent dragging up past 0 (with resistance)
            if (newY < SNAP_OPEN) newY = SNAP_OPEN + (newY - SNAP_OPEN) * 0.2;
            translateY.value = newY;
        })
        .onEnd((event) => {
            // If dragged down significantly or flicked down
            if (event.translationY > 100 || event.velocityY > 500) {
                runOnJS(close)();
            } else {
                // Snap back to open
                translateY.value = withTiming(SNAP_OPEN, { duration: 300, easing: Easing.out(Easing.quad) });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const isClose = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
        if (isClose && !isAtBottom) {
            setIsAtBottom(true);
        }
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={close} statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                
                {/* Backdrop */}
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                >
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>

                {/* Bottom Sheet */}
                <GestureDetector gesture={pan}>
                    <Animated.View style={[
                        styles.sheetContainer, 
                        { backgroundColor: theme.colors.background, height: SHEET_HEIGHT, paddingBottom: insets.bottom },
                        animatedStyle
                    ]}>
                        {/* Drag Handle */}
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
                                onPress={close} 
                                style={[styles.closeButton, { backgroundColor: theme.colors.card }]}
                            >
                                <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <View style={{ flex: 1, position: 'relative' }}>
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

                            {/* Scroll Indicator */}
                            {!isAtBottom && (
                                <Animated.View 
                                    entering={FadeIn.duration(300)}
                                    exiting={FadeOut.duration(300)}
                                    style={[
                                        styles.scrollIndicator, 
                                        { 
                                            backgroundColor: theme.colors.card, 
                                            shadowColor: "#000",
                                            borderColor: theme.colors.border,
                                        }
                                    ]}
                                    pointerEvents="none"
                                >
                                    <HugeiconsIcon icon={ArrowDown01Icon} size={14} color={theme.colors.primary} />
                                    <Text style={[styles.scrollText, { color: theme.colors.primary }]}>Scroll to read</Text>
                                </Animated.View>
                            )}
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
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheetContainer: {
        width: '100%',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        position: 'absolute',
        bottom: 0,
    },
    dragHandleArea: { width: '100%', height: 24, alignItems: 'center', justifyContent: 'center' },
    dragHandle: { width: 40, height: 4, borderRadius: 2, opacity: 0.4 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1 },
    iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 24 },
    intro: { fontSize: 16, fontWeight: '600', marginBottom: 24, lineHeight: 24, opacity: 0.9 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 },
    sectionContent: { fontSize: 15, lineHeight: 24 },
    scrollIndicator: { position: 'absolute', bottom: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    scrollText: { fontSize: 12, fontWeight: '700' },
    footer: { padding: 24, borderTopWidth: 1 },
    agreeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 18, gap: 8 },
    agreeButtonText: { fontSize: 16, fontWeight: '700' },
});