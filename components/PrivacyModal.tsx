// Detect scroll to bottom logic
import { CheckmarkSquare03Icon, Shield02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
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
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import Footer from './Footer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.85;

interface PrivacyModalProps {
  visible: boolean;
  onAgree: () => void;
  onDismiss?: () => void; 
  isDark: boolean;
}

export default function PrivacyModal({ visible, onAgree, onDismiss, isDark }: PrivacyModalProps) {
  const insets = useSafeAreaInsets();
  
  // Animation Value for Dragging
  const translateY = useSharedValue(0);
  const [canAgree, setCanAgree] = useState(false);

  // Colors based on theme
  const backgroundColor = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const handleColor = isDark ? '#475569' : '#cbd5e1';

  // Reset state when opening
  useEffect(() => {
    if (visible) {
        translateY.value = 0;
        setCanAgree(false); // Reset agreement capability
    }
  }, [visible]);

  // Gesture Handler - Applied ONLY to the Header area
  const pan = Gesture.Pan()
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (onDismiss && (event.translationY > 150 || event.velocityY > 500)) {
        runOnJS(onDismiss)();
      } else {
        translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Scroll Detection Logic
  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: NativeScrollEvent) => {
    const paddingToBottom = 20;
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  const handleScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isCloseToBottom(nativeEvent)) {
          if (!canAgree) setCanAgree(true);
      }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <GestureHandlerRootView style={styles.overlay}>
        
        {/* Backdrop Fade */}
        <Animated.View 
            entering={FadeIn.duration(300)} 
            exiting={FadeOut.duration(300)} 
            style={styles.backdrop}
        >
           <TouchableOpacity style={{flex:1}} onPress={onDismiss} activeOpacity={1} />
        </Animated.View>

        {/* Modal Sheet */}
        <Animated.View 
            entering={SlideInDown.duration(400).easing(Easing.out(Easing.quad))} 
            exiting={SlideOutDown.duration(300)}
            style={styles.modalContainerWrapper}
        >
            <Animated.View 
              style={[
                styles.sheet, 
                { backgroundColor, paddingBottom: insets.bottom }, 
                animatedSheetStyle
              ]}
            >
              {/* Draggable Header Section */}
              <GestureDetector gesture={pan}>
                <View style={{ backgroundColor: 'transparent' }}>
                  <View style={styles.handleContainer}>
                    <View style={[styles.handle, { backgroundColor: handleColor }]} />
                  </View>

                  <View style={styles.header}>
                    <View style={[styles.iconWrapper, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff' }]}>
                       <HugeiconsIcon icon={Shield02Icon} size={32} color="#6366f1" />
                    </View>
                    <Text style={[styles.title, { color: textColor }]}>Privacy Policy</Text>
                    <Text style={[styles.subtitle, { color: textSecondary }]}>
                        {canAgree ? "Thank you for reviewing." : "Please scroll to the end to accept."}
                    </Text>
                  </View>
                </View>
              </GestureDetector>

              {/* Scrollable Content */}
              <ScrollView 
                style={styles.content} 
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 20 }}
                onScroll={handleScroll}
                scrollEventThrottle={400} // Check scroll position every 400ms (or faster)
                bounces={true}
              >
                <Section title="1. Data Collection" textColor={textColor}>
                  <Text style={[styles.paragraph, { color: textSecondary }]}>
                    We collect essential information such as your name, email, and job details to provide you with accurate daily accomplishment reports and syncing capabilities across devices.
                  </Text>
                </Section>

                <Section title="2. Usage of Information" textColor={textColor}>
                  <Text style={[styles.paragraph, { color: textSecondary }]}>
                    Your data is used strictly for generating reports, calculating earnings, and maintaining your account security. We do not sell your personal data to third parties.
                  </Text>
                </Section>

                <Section title="3. Security & Privacy" textColor={textColor}>
                  <Text style={[styles.paragraph, { color: textSecondary }]}>
                    We employ industry-standard encryption to protect your data. You have full control over your profile and can request data deletion at any time.
                  </Text>
                </Section>

                <Section title="4. App Permissions" textColor={textColor}>
                  <Text style={[styles.paragraph, { color: textSecondary }]}>
                    The app requires access to your photo library for profile customization and notifications to keep you updated on report statuses.
                  </Text>
                </Section>
                
                <Section title="5. Agreement" textColor={textColor}>
                   <Text style={[styles.paragraph, { color: textSecondary }]}>
                     By clicking &quot;I Agree & Continue&quot;, you acknowledge that you have read and understood our Privacy Policy.
                   </Text>
                </Section>
                
                {/* Spacer to ensure scrolling hits bottom comfortably */}
                <View style={{ height: 40 }} /> 
              </ScrollView>

              {/* Footer */}
              <Footer>
                  <Button 
                      title={canAgree ? "I Agree & Continue" : "Scroll to Accept"}
                      onPress={onAgree}
                      disabled={!canAgree}
                      variant={canAgree ? "primary" : "secondary"} // Visual feedback
                      style={{ width: '100%', opacity: canAgree ? 1 : 0.6 }}
                      icon={canAgree ? <HugeiconsIcon icon={CheckmarkSquare03Icon} size={20} color="white" /> : undefined}
                  />
              </Footer>

            </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const Section = ({ title, textColor, children }: { title: string, textColor: string, children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
        {children}
    </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainerWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 10,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }), 
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
  },
});