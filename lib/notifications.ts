import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';

type NotificationType = 'checkInOut' | 'reportGen' | 'cutoff' | 'general';

export async function sendLocalNotification(
  title: string,
  body: string,
  type: NotificationType = 'general',
  data: any = {}
) {
  try {
    const jsonSettings = await AsyncStorage.getItem('notificationSettings');
    const settings = jsonSettings
      ? JSON.parse(jsonSettings)
      : {
          pushEnabled: true,
          clockInReminder: true,
          breakReminders: true,
          dailyReportReminder: true,
          reportGenerationAlert: true,
        };

    if (settings.pushEnabled === false) return;

    let shouldSend = true;
    switch (type) {
      case 'checkInOut':
        shouldSend = settings.clockInReminder !== false;
        break;
      case 'reportGen':
        shouldSend = settings.reportGenerationAlert !== false;
        break;
      case 'cutoff':
        shouldSend = settings.dailyReportReminder !== false;
        break;
      default:
        shouldSend = true;
        break;
    }

    if (!shouldSend) return;

    await notifee.displayNotification({
      title,
      body,
      data,
      android: {
        channelId: 'standard_alerts',
        smallIcon: 'notification_icon',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
    });
  } catch (error) {
    console.error('Failed to send local notification via Notifee:', error);
  }
}

export async function scheduleReportNotification(reportTitle: string) {
  await sendLocalNotification(
    'Report Ready',
    `${reportTitle} has been generated and is ready for review.`,
    'reportGen',
    { action: 'open_saved_reports' }
  );
}

// Deprecated: active job notification is now handled by utils/NotificationService.ts
export async function sendActiveJobNotification(jobTitle: string, clockInTime: string) {
  // Replaced by dynamic native timer
}

export async function cancelActiveJobNotification() {
  // Replaced by dynamic native timer
}
