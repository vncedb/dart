import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationType = 'checkInOut' | 'reportGen' | 'cutoff' | 'general';

export async function sendLocalNotification(title: string, body: string, type: NotificationType = 'general', data: any = {}) {
  try {
    // 1. Get User Preferences
    const jsonSettings = await AsyncStorage.getItem('appSettings');
    const settings = jsonSettings ? JSON.parse(jsonSettings) : {};

    const isEnabled = (key: string) => settings[key] !== false;

    let shouldSend = true;
    switch (type) {
        case 'checkInOut': shouldSend = isEnabled('notifCheckInOut'); break;
        case 'reportGen': shouldSend = isEnabled('notifReportGen'); break;
        case 'cutoff': shouldSend = isEnabled('notifCutoff'); break;
        default: shouldSend = isEnabled('notifGeneral'); break;
    }

    if (!shouldSend) {
        return;
    }

    // 2. Schedule
    // Note: On Android 8.0+, sound/vibration are controlled by the Channel, not these properties.
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data, 
        sound: settings.soundEnabled !== false, 
        vibrate: settings.vibrationEnabled !== false ? [0, 250, 250, 250] : [],
        // Attach to the 'default' channel created in _layout.tsx
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

// --- NEW: Persistent "Active Job" Notification ---

export async function sendActiveJobNotification(jobTitle: string, clockInTime: string) {
  try {
    // Check settings
    const jsonSettings = await AsyncStorage.getItem('appSettings');
    const settings = jsonSettings ? JSON.parse(jsonSettings) : {};
    if (settings.notifCheckInOut === false) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Currently Working: " + jobTitle,
        body: "Clocked in at " + clockInTime + ". Tap to manage.",
        categoryIdentifier: "active_job", // Links to the action buttons defined in _layout.tsx
        sticky: true, // Android: Prevents user from swiping it away
        autoDismiss: false, // Android: Notification stays until cancelled code-side
        sound: false, // Silent update so it doesn't annoy the user
        data: { type: 'ongoing_job' },
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error("Failed to send active job notification:", error);
  }
}

export async function cancelActiveJobNotification() {
  try {
    // Dismiss all notifications with the 'active_job' category
    const active = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of active) {
      if (n.content.categoryIdentifier === 'active_job') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    
    // Also remove from the tray if already delivered
    const delivered = await Notifications.getPresentedNotificationsAsync();
    for (const n of delivered) {
      if (n.request.content.categoryIdentifier === 'active_job') {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch (error) {
    console.error("Failed to cancel active job notification:", error);
  }
}