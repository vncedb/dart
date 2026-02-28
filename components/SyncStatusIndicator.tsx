// components/SyncStatusIndicator.tsx
import { Alert01Icon, CheckmarkCircle02Icon, CloudUploadIcon, NoInternetIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (syncStatus === 'syncing') {
      Animated.loop(
        Animated.timing(spinValue, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [syncStatus]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const getStatusContent = () => {
    if (isOffline) {
        return { icon: NoInternetIcon, text: `Offline`, color: theme.colors.textSecondary };
    }
    if (syncStatus === 'syncing') {
        return { icon: RefreshIcon, text: 'Syncing', color: theme.colors.primary, spin: true };
    }
    if (conflictCount > 0) {
        return { icon: Alert01Icon, text: `${conflictCount} conflicts`, color: theme.colors.warning };
    }
    if (failedCount >= 5) {
        return { icon: Alert01Icon, text: `${failedCount} failed`, color: theme.colors.danger };
    }
    if (pendingCount > 0) {
        return { icon: CloudUploadIcon, text: `${pendingCount} pending`, color: theme.colors.textSecondary };
    }
    if (syncStatus === 'success') {
        return { icon: CheckmarkCircle02Icon, text: `Synced`, color: theme.colors.success };
    }
    return null;
  };

  useEffect(() => {
    const content = getStatusContent();
    if (content) {
        setRenderedContent(content);
    }
  }, [syncStatus, pendingCount, failedCount, conflictCount, isOffline]);

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
    overflow: 'hidden', // Ensures content is hidden when height shrinks
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