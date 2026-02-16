import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationType = 'checkInOut' | 'reportGen' | 'cutoff' | 'general';

export async function sendLocalNotification(title: string, body: string, type: NotificationType = 'general', data: any = {}) {
  try {
    // 1. Get User Preferences from CORRECT storage key
    const jsonSettings = await AsyncStorage.getItem('notificationSettings');
    const settings = jsonSettings ? JSON.parse(jsonSettings) : {
        // Defaults if not set
        pushEnabled: true,
        clockInReminder: true,
        breakReminders: true,
        dailyReportReminder: true,
        reportGenerationAlert: true
    };

    // Global Kill Switch
    if (settings.pushEnabled === false) return;

    let shouldSend = true;
    switch (type) {
        case 'checkInOut': shouldSend = settings.clockInReminder; break;
        case 'reportGen': shouldSend = settings.reportGenerationAlert; break;
        case 'cutoff': shouldSend = settings.dailyReportReminder; break;
        default: shouldSend = true; break;
    }

    if (!shouldSend) {
        console.log(`🔕 Notification suppressed by user setting: ${type}`);
        return;
    }

    // 2. Schedule
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data, 
        sound: true,
        // Attach to the 'default' channel (High Importance)
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
      trigger: null, // Immediate
    });

  } catch (error) {
    console.error('Failed to send local notification:', error);
  }
}

export async function scheduleReportNotification(reportTitle: string) {
    await sendLocalNotification(
        "Report Ready 📄",
        `${reportTitle} has been automatically generated and is ready for review.`,
        'reportGen',
        { action: 'open_saved_reports' }
    );
}

// Deprecated: active job notification is now handled by utils/NotificationService.ts
// Keeping empty stub to prevent import errors if used elsewhere
export async function sendActiveJobNotification(jobTitle: string, clockInTime: string) {
    // Replaced by dynamic timer
}

export async function cancelActiveJobNotification() {
    // Replaced by dynamic timer
}