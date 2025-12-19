import LottieView from 'lottie-react-native';
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

export default function AnimatedSplashScreen({ onFinish }: { onFinish: () => void }) {
  const opacity = useSharedValue(1);
  const animation = useRef<LottieView>(null);

  useEffect(() => {
    // 1. Play animation immediately
    animation.current?.play();

    // 2. Schedule Fade Out after a delay (simulate loading or wait for app)
    // Adjust '3000' to match your actual loading time or use a prop to trigger this
    const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 500 }, (finished) => {
            if (finished) {
                runOnJS(onFinish)();
            }
        });
    }, 3000); // Shows splash for 3 seconds

    return () => clearTimeout(timer);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LottieView
        ref={animation}
        // REPLACE with your local file: require('../assets/loading.json')
        source={{ uri: 'https://lottie.host/5a6a43d9-d48e-49b0-9147-38435d0703e2/rF1k148k4u.json' }} 
        autoPlay
        loop
        style={styles.lottie}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff', // Match your app theme
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  lottie: {
    width: 200,
    height: 200,
  },
});