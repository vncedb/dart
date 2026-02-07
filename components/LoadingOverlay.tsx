import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, {
  Layout,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// --- REMOTE LOTTIE URLS ---
const LOADING_SOURCE = { uri: 'https://lottie.host/98c09d52-6622-4217-9154-206256947726/D1j4y8q1d7.json' }; 
const SUCCESS_SOURCE = { uri: 'https://lottie.host/58753882-bb6a-49f5-bb20-9550460061d6/ExWDpU1s6k.json' };

export default function LoadingOverlay({ visible, message = "Loading..." }: LoadingOverlayProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const loadingRef = useRef<LottieView>(null);
  const successRef = useRef<LottieView>(null);

  const [internalVisible, setInternalVisible] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);

  // Animation Values for Crossfade
  const loadingOpacity = useSharedValue(1);
  const successOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setInternalVisible(true);
      setIsSuccessState(false);
      
      loadingOpacity.value = 1;
      successOpacity.value = 0;

      requestAnimationFrame(() => {
        loadingRef.current?.reset();
        loadingRef.current?.play();
        successRef.current?.reset(); 
      });
    } else {
      if (internalVisible && !isSuccessState) {
        triggerSuccess();
      }
    }
  }, [visible]);

  const triggerSuccess = () => {
    setIsSuccessState(true);

    // Crossfade Animations
    loadingOpacity.value = withTiming(0, { duration: 300 });
    successOpacity.value = withTiming(1, { duration: 300 });

    successRef.current?.play();
  };

  const onSuccessFinish = () => {
    setInternalVisible(false);
    setIsSuccessState(false);
  };

  const loadingStyle = useAnimatedStyle(() => ({ opacity: loadingOpacity.value }));
  const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value }));

  if (!internalVisible) return null;

  return (
    <Modal 
        transparent 
        visible={internalVisible} 
        animationType="none" 
        statusBarTranslucent
    >
        <View style={styles.container}>
            {/* Background Blur - NO ANIMATION */}
            <AnimatedBlurView 
                style={StyleSheet.absoluteFill}
                intensity={isDark ? 30 : 20}
                tint={isDark ? 'dark' : 'light'}
            >
                <View style={[
                    StyleSheet.absoluteFill, 
                    { backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)' } 
                ]} />
            </AnimatedBlurView>

            {/* Content Card - NO ANIMATION */}
            <View 
                style={[
                    styles.card,
                    { 
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#f1f5f9'
                    }
                ]}
            >
                <View style={styles.iconContainer}>
                    {/* 1. LOADING SPINNER */}
                    <Animated.View style={[StyleSheet.absoluteFill, loadingStyle]}>
                        <LottieView
                            ref={loadingRef}
                            source={LOADING_SOURCE}
                            autoPlay
                            loop={true}
                            style={styles.lottie}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    {/* 2. SUCCESS CHECK */}
                    <Animated.View style={[StyleSheet.absoluteFill, successStyle]}>
                        <LottieView
                            ref={successRef}
                            source={SUCCESS_SOURCE}
                            autoPlay={false}
                            loop={false}
                            onAnimationFinish={() => runOnJS(onSuccessFinish)()}
                            style={styles.lottie}
                            resizeMode="contain"
                        />
                    </Animated.View>
                </View>
                
                {/* Dynamic Message */}
                <Animated.Text 
                    layout={Layout.springify()} 
                    key={isSuccessState ? 'success' : 'loading'} 
                    style={[
                        styles.text,
                        { color: isDark ? '#f8fafc' : '#0f172a' }
                    ]}
                >
                    {isSuccessState ? "Done!" : message}
                </Animated.Text>
            </View>
        </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 160,
    height: 160,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', 
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});