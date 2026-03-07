import { CheckmarkCircle02Icon, InformationCircleIcon, SparklesIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import {
  buildWidgetSnapshot,
  DEFAULT_WIDGET_SETTINGS,
  getWidgetSettings,
  getWidgetSupportState,
  refreshWidgetSnapshot,
  requestPinWidget,
  saveWidgetSettings,
  type WidgetSettings,
  type WidgetSnapshot,
} from '../../lib/widgets';

type WidgetToggleRowProps = {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  theme: ReturnType<typeof useAppTheme>;
  disabled?: boolean;
  accent?: string;
  isLast?: boolean;
};

function WidgetToggleRow({
  label,
  description,
  value,
  onChange,
  theme,
  disabled = false,
  accent,
  isLast = false,
}: WidgetToggleRowProps) {
  const tint = accent || theme.colors.primary;

  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowDivider, disabled && { opacity: 0.45 }]}> 
      <View style={[styles.settingIcon, { backgroundColor: disabled ? theme.colors.background : `${tint}16` }]}>
        <View style={[styles.settingIconDot, { backgroundColor: tint }]} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>{description}</Text>
      </View>
      <Switch
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#94a3b8', true: tint }}
        thumbColor="#ffffff"
        style={styles.switch}
      />
    </View>
  );
}

type WidgetActionCardProps = {
  theme: ReturnType<typeof useAppTheme>;
  title: string;
  description: string;
  badge: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  onAdd: () => void;
  addTitle: string;
  accent: string;
  disabled?: boolean;
};

function WidgetActionCard({
  theme,
  title,
  description,
  badge,
  enabled,
  onToggle,
  onAdd,
  addTitle,
  accent,
  disabled = false,
}: WidgetActionCardProps) {
  return (
    <View style={[styles.widgetCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, disabled && { opacity: 0.5 }]}>
      <View style={[styles.widgetCardAccent, { backgroundColor: accent }]} />
      <View style={styles.widgetCardHeader}>
        <View style={styles.widgetCardCopy}>
          <Text style={[styles.widgetCardTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.widgetCardDescription, { color: theme.colors.textSecondary }]}>{description}</Text>
        </View>
        <View style={[styles.widgetChip, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <Text style={[styles.widgetChipText, { color: accent }]}>{badge}</Text>
        </View>
      </View>

      <View style={[styles.widgetToggleShell, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
        <View>
          <Text style={[styles.widgetToggleTitle, { color: theme.colors.text }]}>{enabled ? 'Enabled' : 'Disabled'}</Text>
          <Text style={[styles.widgetToggleDescription, { color: theme.colors.textSecondary }]}>Allow this widget to appear and refresh from DART.</Text>
        </View>
        <Switch
          disabled={disabled}
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: '#94a3b8', true: accent }}
          thumbColor="#ffffff"
          style={styles.switch}
        />
      </View>

      <Button
        title={addTitle}
        onPress={onAdd}
        disabled={disabled}
        variant={enabled && !disabled ? 'primary' : 'secondary'}
        style={styles.widgetAddButton}
      />
    </View>
  );
}

export default function WidgetsScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettings>(DEFAULT_WIDGET_SETTINGS);
  const [preview, setPreview] = useState<WidgetSnapshot | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  const supportState = getWidgetSupportState();
  const widgetsReady = supportState === 'ready';

  const loadState = useCallback(async () => {
    const stored = await getWidgetSettings();
    setWidgetSettings(stored);

    if (user?.id) {
      const snapshot = await buildWidgetSnapshot(user.id);
      setPreview(snapshot);
    } else {
      setPreview(null);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadState();
    }, [loadState])
  );

  const updateSetting = async (partial: Partial<WidgetSettings>) => {
    const next = await saveWidgetSettings(partial);
    setWidgetSettings(next);

    if (user?.id) {
      const snapshot = await refreshWidgetSnapshot(user.id, { force: true });
      setPreview(snapshot);
    }
  };

  const handleAddWidget = async (kind: 'daily' | 'quick') => {
    if (!widgetsReady) {
      const title = supportState === 'android-native-missing' ? 'Rebuild Required' : 'Android Widgets Only';
      const message = supportState === 'android-native-missing'
        ? 'This Android install does not include the widget native module yet. Rebuild and reinstall your development build, then try again.'
        : 'Widgets are currently available only on Android builds of DART.';

      setAlertConfig({
        visible: true,
        type: 'warning',
        title,
        message,
        confirmText: 'OK',
        onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
      });
      return;
    }

    setIsBusy(true);
    try {
      const result = await requestPinWidget(kind);
      setAlertConfig({
        visible: true,
        type: result ? 'success' : 'info',
        title: result ? 'Widget Picker Opened' : 'Pinning Not Available',
        message: result
          ? 'Choose a home screen position from the Android widget prompt.'
          : 'Your launcher did not accept the pin request. You can still add the widget manually from the Android widget picker.',
        confirmText: 'OK',
        onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
      });
    } catch {
      setAlertConfig({
        visible: true,
        type: 'error',
        title: 'Widget Request Failed',
        message: 'Could not open the Android widget request right now.',
        confirmText: 'OK',
        onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (!user?.id) return;
    setIsBusy(true);
    try {
      const snapshot = await refreshWidgetSnapshot(user.id, { force: true });
      setPreview(snapshot);
    } finally {
      setIsBusy(false);
    }
  };

  const previewStatusColor = useMemo(() => preview?.statusColor || theme.colors.primary, [preview?.statusColor, theme.colors.primary]);
  const readinessTitle = supportState === 'ready'
    ? 'Android Widgets Ready'
    : supportState === 'android-native-missing'
      ? 'Development Build Needs Reinstall'
      : 'Unsupported Platform';
  const readinessDescription = supportState === 'ready'
    ? 'Daily Summary and Quick Time Action can be pinned from here and refreshed directly from DART.'
    : supportState === 'android-native-missing'
      ? 'Your current Android development build was installed before widget support was added. Run a fresh Android build and reinstall it once so the native widget module is included.'
      : 'Widgets are currently available only on Android builds of DART.';
  const readinessTone = supportState === 'ready' ? theme.colors.primary : '#f59e0b';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={isBusy} message="Updating widgets..." />

      <Header title="Widgets" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryLight }]}>
              <HugeiconsIcon icon={SparklesIcon} size={20} color={theme.colors.primary} />
            </View>
            <View style={[styles.heroStatus, { backgroundColor: `${readinessTone}16`, borderColor: `${readinessTone}30` }]}>
              <Text style={[styles.heroStatusText, { color: readinessTone }]}>{supportState === 'ready' ? 'READY' : 'CHECK BUILD'}</Text>
            </View>
          </View>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Home Screen Widgets</Text>
          <Text style={[styles.heroText, { color: theme.colors.textSecondary }]}>
            Add a live summary card and a quick time action launcher that stays aligned with your DART attendance data.
          </Text>

          <View style={styles.heroPillsRow}>
            <View style={[styles.heroPill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.heroPillValue, { color: theme.colors.text }]}>{widgetSettings.dailySummaryEnabled ? 'On' : 'Off'}</Text>
              <Text style={[styles.heroPillLabel, { color: theme.colors.textSecondary }]}>Summary widget</Text>
            </View>
            <View style={[styles.heroPill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.heroPillValue, { color: theme.colors.text }]}>{widgetSettings.quickActionEnabled ? 'On' : 'Off'}</Text>
              <Text style={[styles.heroPillLabel, { color: theme.colors.textSecondary }]}>Quick action</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statusCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: readinessTone }]} />
            <Text style={[styles.statusTitle, { color: theme.colors.text }]}>{readinessTitle}</Text>
          </View>
          <Text style={[styles.statusText, { color: theme.colors.textSecondary }]}>{readinessDescription}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ADD WIDGETS</Text>
        <WidgetActionCard
          theme={theme}
          title="Daily Summary"
          description="Pins a compact work summary card with hours, status, progress, and job details."
          badge="4 x 2"
          enabled={widgetSettings.dailySummaryEnabled}
          onToggle={(value) => updateSetting({ dailySummaryEnabled: value })}
          onAdd={() => handleAddWidget('daily')}
          addTitle="Add Daily Summary"
          accent={previewStatusColor}
          disabled={!widgetsReady}
        />
        <WidgetActionCard
          theme={theme}
          title="Quick Time Action"
          description="Pins a fast launcher that opens DART and runs the same time in or time out flow."
          badge="3 x 2"
          enabled={widgetSettings.quickActionEnabled}
          onToggle={(value) => updateSetting({ quickActionEnabled: value })}
          onAdd={() => handleAddWidget('quick')}
          addTitle="Add Quick Action"
          accent={theme.colors.primary}
          disabled={!widgetsReady}
        />

        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>DISPLAY OPTIONS</Text>
        <View style={[styles.settingsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <WidgetToggleRow
            label="Show target time"
            description="Display the expected time out on the summary widget."
            value={widgetSettings.showTargetEndTime}
            onChange={(value) => updateSetting({ showTargetEndTime: value })}
            theme={theme}
            disabled={!widgetSettings.dailySummaryEnabled}
            accent={previewStatusColor}
          />
          <WidgetToggleRow
            label="Show active job"
            description="Display the current job title below the summary details."
            value={widgetSettings.showJobName}
            onChange={(value) => updateSetting({ showJobName: value })}
            theme={theme}
            disabled={!widgetSettings.dailySummaryEnabled}
            accent={previewStatusColor}
          />
          <WidgetToggleRow
            label="Auto refresh"
            description="Refresh widget data automatically whenever attendance changes in DART."
            value={widgetSettings.autoRefresh}
            onChange={(value) => updateSetting({ autoRefresh: value })}
            theme={theme}
            accent={theme.colors.primary}
            isLast
          />
        </View>

        <View style={styles.previewHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginBottom: 0, marginLeft: 0 }]}>PREVIEWS</Text>
          <Button title="Refresh Data" variant="secondary" onPress={handleRefresh} style={styles.refreshButton} disabled={!widgetsReady || !user?.id} />
        </View>

        <View style={[styles.previewCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.previewAccent, { backgroundColor: previewStatusColor }]} />
          <View style={styles.previewTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewEyebrow, { color: theme.colors.textSecondary }]}>DAILY SUMMARY</Text>
              <Text style={[styles.previewDate, { color: theme.colors.text }]}>{preview?.dateLabel || 'Today'}</Text>
            </View>
            <View style={[styles.previewBadge, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.previewBadgeText, { color: previewStatusColor }]}>{preview?.statusText || 'Off Duty'}</Text>
            </View>
          </View>

          <View style={styles.previewMetricRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewHours, { color: theme.colors.text }]}>{preview?.totalHoursText || '0h 00m'}</Text>
              <Text style={[styles.previewMeta, { color: theme.colors.textSecondary }]}>{preview?.goalText || 'Daily Goal 8h 00m'}</Text>
            </View>
            <View style={[styles.percentBadge, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.percentValue, { color: theme.colors.text }]}>{preview?.progressPercent || 0}%</Text>
              <Text style={[styles.percentLabel, { color: theme.colors.textSecondary }]}>GOAL</Text>
            </View>
          </View>

          <View style={[styles.previewTrack, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.previewFill, { backgroundColor: theme.colors.primary, width: `${preview?.progressPercent || 0}%` }]} />
          </View>

          {widgetSettings.showTargetEndTime && (
            <View style={[styles.previewInfoBlock, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.previewInfoLabel, { color: theme.colors.textSecondary }]}>TARGET TIME OUT</Text>
              <Text style={[styles.previewInfoValue, { color: theme.colors.text }]}>{preview?.targetEndText || 'No active session'}</Text>
            </View>
          )}

          {widgetSettings.showJobName && (
            <View style={[styles.previewInfoBlock, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.previewInfoLabel, { color: theme.colors.textSecondary }]}>ACTIVE JOB</Text>
              <Text style={[styles.previewInfoValue, { color: theme.colors.text }]}>{preview?.jobTitle || 'No active job'}</Text>
            </View>
          )}

          <Text style={[styles.previewUpdated, { color: theme.colors.textSecondary }]}>{preview?.lastUpdatedText || 'Updated just now'}</Text>
        </View>

        <View style={[styles.quickPreview, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={[styles.previewAccent, { backgroundColor: theme.colors.primary, alignSelf: 'center' }]} />
          <Text style={[styles.previewEyebrow, { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 12 }]}>QUICK ACTION</Text>
          <View style={[styles.quickActionRing, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <Text style={[styles.quickActionText, { color: theme.colors.primary }]}>{preview?.actionLabel || 'TIME IN'}</Text>
          </View>
          <Text style={[styles.quickActionHint, { color: theme.colors.textSecondary }]}>{preview?.actionHint || 'Open DART to continue'}</Text>
          <View style={[styles.previewBadge, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, marginTop: 14 }]}>
            <Text style={[styles.previewBadgeText, { color: previewStatusColor }]}>{preview?.statusText || 'Off Duty'}</Text>
          </View>
        </View>

        <View style={[styles.noteCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.noteHeader}>
            <HugeiconsIcon icon={InformationCircleIcon} size={18} color={theme.colors.primary} />
            <Text style={[styles.noteTitle, { color: theme.colors.text }]}>How it works</Text>
          </View>
          <Text style={[styles.noteText, { color: theme.colors.textSecondary }]}>
            The quick widget opens DART and follows the same secure attendance flow as the home screen. The summary widget reads the latest snapshot saved by the app and updates whenever attendance changes or when you refresh it here.
          </Text>
        </View>

        <View style={[styles.noteCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 14 }]}>
          <View style={styles.noteHeader}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color={theme.colors.primary} />
            <Text style={[styles.noteTitle, { color: theme.colors.text }]}>What changed</Text>
          </View>
          <Text style={[styles.noteText, { color: theme.colors.textSecondary }]}>The native widget layouts were simplified to use only launcher-safe RemoteViews classes, which resolves the Android home screen widget loading error on your current device launcher.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    paddingBottom: 120,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatus: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroStatusText: {
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 6,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Nunito_500Medium',
  },
  heroPillsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  heroPill: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  heroPillValue: {
    fontSize: 15,
    fontFamily: 'Nunito_800ExtraBold',
  },
  heroPillLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 3,
  },
  statusCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  statusTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
  },
  statusText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Nunito_500Medium',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
    marginTop: 6,
    textTransform: 'uppercase',
    opacity: 0.72,
  },
  widgetCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  widgetCardAccent: {
    width: 46,
    height: 4,
    borderRadius: 999,
    marginBottom: 14,
  },
  widgetCardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  widgetCardCopy: {
    flex: 1,
  },
  widgetCardTitle: {
    fontSize: 16,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 4,
  },
  widgetCardDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Nunito_500Medium',
  },
  widgetChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  widgetChipText: {
    fontSize: 10,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 0.8,
  },
  widgetToggleShell: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  widgetToggleTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    marginBottom: 2,
  },
  widgetToggleDescription: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Nunito_500Medium',
    maxWidth: 220,
  },
  widgetAddButton: {
    marginTop: 14,
  },
  settingsCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  settingRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.16)',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingIconDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  settingCopy: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Nunito_500Medium',
  },
  switch: {
    transform: [{ scaleX: 0.92 }, { scaleY: 0.92 }],
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  refreshButton: {
    height: 40,
    paddingHorizontal: 14,
  },
  previewCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    marginBottom: 14,
  },
  previewAccent: {
    width: 42,
    height: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewEyebrow: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 1,
  },
  previewDate: {
    fontSize: 14,
    fontFamily: 'Nunito_700Bold',
    marginTop: 4,
  },
  previewBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  previewBadgeText: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
  },
  previewMetricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 14,
  },
  previewHours: {
    fontSize: 30,
    fontFamily: 'Nunito_900Black',
  },
  previewMeta: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Nunito_500Medium',
    marginTop: 4,
  },
  percentBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentValue: {
    fontSize: 18,
    fontFamily: 'Nunito_900Black',
  },
  percentLabel: {
    fontSize: 9,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  previewTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 14,
  },
  previewFill: {
    height: '100%',
    borderRadius: 999,
  },
  previewInfoBlock: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  previewInfoLabel: {
    fontSize: 10,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  previewInfoValue: {
    fontSize: 13,
    fontFamily: 'Nunito_700Bold',
  },
  previewUpdated: {
    fontSize: 11,
    fontFamily: 'Nunito_500Medium',
    marginTop: 12,
  },
  quickPreview: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    alignItems: 'center',
  },
  quickActionRing: {
    width: 106,
    height: 106,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  quickActionText: {
    fontSize: 24,
    fontFamily: 'Nunito_900Black',
    textAlign: 'center',
  },
  quickActionHint: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Nunito_500Medium',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
  },
  noteCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  noteTitle: {
    fontSize: 15,
    fontFamily: 'Nunito_700Bold',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Nunito_500Medium',
  },
});
