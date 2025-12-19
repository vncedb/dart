import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import DartLogo from './DartLogo'; // Assuming you have this, otherwise replace with a generic View

export default function LoadingScreen({ onFinish }: { onFinish: () => void }) {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Fade In & Scale Up Logo
    opacity.value = withTiming(1, { duration: 800 });
    scale.value = withTiming(1, { duration: 800 });
    
    // 2. Fade In Text with Delay
    textOpacity.value = withSequence(
        withTiming(0, { duration: 400 }),
        withTiming(1, { duration: 600 })
    );

    // 3. Exit Sequence after 2.5 seconds total
    const timer = setTimeout(() => {
       runOnJS(onFinish)();
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Animated.View exiting={FadeOut.duration(500)} style={styles.container}>
      <Animated.View style={logoStyle}>
        {/* Replace with your DartLogo component or an Image */}
        <DartLogo size={100} color="#4F46E5" /> 
      </Animated.View>
      
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.appName}>DART</Text>
        <Text style={styles.tagline}>System Loading...</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff', // Or '#0F172A' for dark mode default
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  textContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  appName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 24,
    color: '#0F172A',
    letterSpacing: 2,
  },
  tagline: {
    fontFamily: 'Nunito_500Medium',
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});