// components/SyncStatusIndicator.tsx
import { Alert01Icon, CheckmarkCircle02Icon, CloudUploadIcon, NoInternetIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import { useSync } from '../context/SyncContext';

export default function SyncStatusIndicator() {
  const theme = useAppTheme();
  const { syncStatus, pendingCount, failedCount, conflictCount, isOffline } = useSync();
  const spinValue = useRef(new Animated.Value(0)).current;

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

  const isVisible = !(syncStatus === 'idle' && pendingCount === 0 && !isOffline && failedCount === 0 && conflictCount === 0);

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

  const content = getStatusContent();

  return (
    <>
      {isVisible && content && (
        <Reanimated.View 
            layout={LinearTransition.duration(300)}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(400)}
            style={[styles.container, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
          {content.spin ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <HugeiconsIcon icon={content.icon} size={12} color={content.color} />
              </Animated.View>
          ) : (
              <HugeiconsIcon icon={content.icon} size={12} color={content.color} />
          )}
          <Text style={[styles.text, { color: content.color }]} numberOfLines={1}>{content.text}</Text>
        </Reanimated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 26, // Force exact height to match status badge
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    paddingHorizontal: 10,
    borderRadius: 100, borderWidth: 1, 
    alignSelf: 'flex-end', 
    marginTop: 4, gap: 4, zIndex: 10
  },
  text: { fontSize: 11, fontFamily: 'Nunito_700Bold' }
});