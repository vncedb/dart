import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({ visible, message = "Loading..." }: LoadingOverlayProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const animationRef = useRef<LottieView>(null);

  // [FIX] Updated to use .json files. 
  // Ensure these files exist in your 'assets/loading/' folder.
  const animationSource = isDark 
    ? require('../assets/loading/loading-darkmode.json') 
    : require('../assets/loading/loading-lightmode.json');

  useEffect(() => {
    if (visible) {
      animationRef.current?.play();
    } else {
      animationRef.current?.reset();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal 
        transparent 
        visible={visible} 
        animationType="fade" 
        statusBarTranslucent
    >
        <View style={styles.container}>
            {/* Background Blur */}
            <BlurView 
                style={StyleSheet.absoluteFill}
                intensity={isDark ? 30 : 20}
                tint={isDark ? 'dark' : 'light'}
            >
                <View style={[
                    StyleSheet.absoluteFill, 
                    { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)' } 
                ]} />
            </BlurView>

            {/* Content Card */}
            <View 
                style={[
                    styles.card,
                    { 
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#f1f5f9',
                        shadowColor: isDark ? '#000' : '#94a3b8'
                    }
                ]}
            >
                <View style={styles.iconContainer}>
                    <LottieView
                        ref={animationRef}
                        source={animationSource}
                        autoPlay
                        loop
                        style={styles.lottie}
                        resizeMode="contain"
                    />
                </View>
                
                <Text style={[styles.text, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {message}
                </Text>
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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});