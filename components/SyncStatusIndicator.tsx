// filepath: components/SyncStatusIndicator.tsx
import { Alert01Icon, CheckmarkCircle02Icon, CloudUploadIcon, NoInternetIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Reanimated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import { useSync } from '../context/SyncContext';

export default function SyncStatusIndicator() {
  const theme = useAppTheme();
  const { syncStatus, pendingCount, failedCount, conflictCount, isOffline } = useSync();
  const spinValue = useRef(new Animated.Value(0)).current;

  // Track the visibility state
  const isVisible = !(syncStatus === 'idle' && pendingCount === 0 && !isOffline && failedCount === 0 && conflictCount === 0);

  // Keep content mounted even while fading out so it doesn't abruptly disappear
  const [renderedContent, setRenderedContent] = useState<any>(null);

  // FIX: Added spinValue to dependency array
  useEffect(() => {
    if (syncStatus === 'syncing') {
      Animated.loop(
        Animated.timing(spinValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [syncStatus, spinValue]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // FIX: Wrapped in useCallback to safely pass it to the useEffect dependency array below
  const getStatusContent = useCallback(() => {
    if (isOffline) {
        return { icon: NoInternetIcon, text: `Offline`, color: theme.colors.textSecondary, spin: false };
    }
    if (syncStatus === 'syncing') {
        return { icon: RefreshIcon, text: 'Syncing', color: theme.colors.primary, spin: true };
    }
    if (conflictCount > 0) {
        return { icon: Alert01Icon, text: `${conflictCount} conflicts`, color: theme.colors.warning, spin: false };
    }
    if (failedCount >= 5) {
        return { icon: Alert01Icon, text: `${failedCount} failed`, color: theme.colors.danger, spin: false };
    }
    if (pendingCount > 0) {
        return { icon: CloudUploadIcon, text: `${pendingCount} pending`, color: theme.colors.textSecondary, spin: false };
    }
    if (syncStatus === 'success') {
        return { icon: CheckmarkCircle02Icon, text: `Synced`, color: theme.colors.success, spin: false };
    }
    return null;
  }, [isOffline, syncStatus, conflictCount, failedCount, pendingCount, theme.colors]);

  // FIX: Added getStatusContent to dependency array
  useEffect(() => {
    const content = getStatusContent();
    if (content) {
        setRenderedContent(content);
    }
  }, [getStatusContent]);

  // Smoothly animate the container's physical layout to avoid overlapping
  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(isVisible ? 26 : 0, { duration: 300 }),
      opacity: withTiming(isVisible ? 1 : 0, { duration: 300 }),
      marginTop: withTiming(isVisible ? 4 : 0, { duration: 300 }),
      borderWidth: withTiming(isVisible ? 1 : 0, { duration: 300 }),
      paddingHorizontal: withTiming(isVisible ? 10 : 0, { duration: 300 }),
    };
  });

  return (
    <Reanimated.View 
        style={[
            styles.container, 
            animatedStyle,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
        ]}
    >
      {renderedContent && (
        <View style={styles.innerContent}>
            {renderedContent.spin ? (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <HugeiconsIcon icon={renderedContent.icon} size={12} color={renderedContent.color} />
                </Animated.View>
            ) : (
                <HugeiconsIcon icon={renderedContent.icon} size={12} color={renderedContent.color} />
            )}
            <Text style={[styles.text, { color: renderedContent.color }]} numberOfLines={1}>
                {renderedContent.text}
            </Text>
        </View>
      )}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: 100, 
    alignSelf: 'flex-end', 
    overflow: 'hidden', 
    zIndex: 10
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  text: { fontSize: 11, fontFamily: 'Nunito_700Bold' }
});