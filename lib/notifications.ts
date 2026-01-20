import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// Simple wrapper for general app notifications (not the attendance timer)
type NotificationType = 'checkInOut' | 'reportGen' | 'cutoff' | 'general';

export async function sendLocalNotification(title: string, body: string, type: NotificationType = 'general') {
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
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: settings.soundEnabled !== false, 
        // Default vibration pattern if enabled
        vibrate: settings.vibrationEnabled !== false ? [0, 250, 250, 250] : [],
      },
      trigger: null, 
    });

  } catch (error) {
    console.error('Failed to send local notification:', error);
  }
}