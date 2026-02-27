import notifee, { AndroidImportance } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NotificationType = 'checkInOut' | 'reportGen' | 'cutoff' | 'general';

export async function sendLocalNotification(title: string, body: string, type: NotificationType = 'general', data: any = {}) {
  try {
    // 1. Get User Preferences from storage
    const jsonSettings = await AsyncStorage.getItem('notificationSettings');
    const settings = jsonSettings ? JSON.parse(jsonSettings) : {
        pushEnabled: true,
        clockInReminder: true,
        breakReminders: true,
        dailyReportReminder: true,
        reportGenerationAlert: true
    };

    // Global Kill Switch
    if (settings.pushEnabled === false) return;

    // Check specific toggles
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

    // 2. Display Notification using Notifee
    await notifee.displayNotification({
        title,
        body,
        data,
        android: {
            channelId: 'standard_alerts', // Matches the channel created in NotificationService.ts
            smallIcon: 'ic_timer_small',
            importance: AndroidImportance.HIGH,
            pressAction: {
                id: 'default', // Ensures tapping the notification opens the app
            },
        },
    });

  } catch (error) {
    console.error('Failed to send local notification via Notifee:', error);
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
export async function sendActiveJobNotification(jobTitle: string, clockInTime: string) {
    // Replaced by dynamic native timer
}

export async function cancelActiveJobNotification() {
    // Replaced by dynamic native timer
}