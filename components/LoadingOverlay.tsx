import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({ visible, message = 'Loading...' }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.container}>
        <Animated.View 
          entering={FadeIn.duration(200)} 
          exiting={FadeOut.duration(200)} 
          style={styles.card}
        >
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)', // Dimmed background
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    minWidth: 160,
  },
  text: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  }
});