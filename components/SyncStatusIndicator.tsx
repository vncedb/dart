// filepath: components/SyncStatusIndicator.tsx
import { Alert01Icon, CheckmarkCircle02Icon, CloudUploadIcon, NoInternetIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import { useSync } from '../context/SyncContext';

export default function SyncStatusIndicator() {
  const theme = useAppTheme();
  const { syncStatus, syncProgress, pendingCount, failedCount, conflictCount, isOffline, lastSyncedAt } = useSync();
  const spinValue = useRef(new Animated.Value(0)).current;

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
  }, [syncStatus, spinValue]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const getStatusContent = useCallback(() => {
    if (isOffline) {
        return { icon: NoInternetIcon, text: `Offline - Data stored locally`, color: theme.colors.textSecondary, spin: false };
    }
    if (syncStatus === 'syncing') {
        return { icon: RefreshIcon, text: `Syncing with cloud (${syncProgress}%)`, color: theme.colors.primary, spin: true };
    }
    if (conflictCount > 0) {
        return { icon: Alert01Icon, text: `${conflictCount} sync conflicts`, color: theme.colors.warning, spin: false };
    }
    if (failedCount >= 5) {
        return { icon: Alert01Icon, text: `${failedCount} uploads failed`, color: theme.colors.danger, spin: false };
    }
    if (pendingCount > 0) {
        return { icon: CloudUploadIcon, text: `${pendingCount} pending upload`, color: theme.colors.textSecondary, spin: false };
    }
    
    // FORMAT: "Last Sync: 03-01 11:34 PM"
    if (lastSyncedAt) {
        try {
            const formattedDate = format(new Date(lastSyncedAt), 'MM-dd hh:mm a');
            const color = syncStatus === 'success' ? theme.colors.success : theme.colors.textSecondary;
            return { icon: CheckmarkCircle02Icon, text: `Last Sync: ${formattedDate}`, color: color, spin: false };
        } catch {
            return { icon: CheckmarkCircle02Icon, text: `Fully synced`, color: theme.colors.success, spin: false };
        }
    }
    
    // Default state if never synced before
    return { icon: CheckmarkCircle02Icon, text: `All changes saved locally`, color: theme.colors.textSecondary, spin: false };
  }, [isOffline, syncStatus, syncProgress, conflictCount, failedCount, pendingCount, lastSyncedAt, theme.colors]);

  useEffect(() => {
    const content = getStatusContent();
    if (content) {
        setRenderedContent(content);
    }
  }, [getStatusContent]);

  if (!renderedContent) return null;

  return (
    <Reanimated.View 
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(300)}
        style={styles.container}
    >
      <View style={styles.innerContent}>
          {renderedContent.spin ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <HugeiconsIcon icon={renderedContent.icon} size={14} color={renderedContent.color} />
              </Animated.View>
          ) : (
              <HugeiconsIcon icon={renderedContent.icon} size={14} color={renderedContent.color} />
          )}
          <Text style={[styles.text, { color: renderedContent.color }]} numberOfLines={1}>
              {renderedContent.text}
          </Text>
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 10
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  text: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', opacity: 0.8 }
});