import notifee, { AndroidImportance, AndroidStyle, AuthorizationStatus } from '@notifee/react-native';
import { Appearance, Platform } from 'react-native';

export const initNotificationSystem = async () => {
    await notifee.requestPermission();

    if (Platform.OS === 'android') {
        await notifee.createChannel({
            id: 'attendance_timer',
            name: 'Active Shift Timer',
            importance: AndroidImportance.HIGH,
            vibration: false,
        });

        await notifee.createChannel({
            id: 'standard_alerts',
            name: 'System Alerts',
            importance: AndroidImportance.HIGH,
        });
    }
};

export const checkNotificationPermissions = async () => {
    const settings = await notifee.getNotificationSettings();
    return (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED || 
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    );
};

export const scheduleReminders = async (startTime: string | null) => {
    if (!startTime) return;
    // Reminder scheduling logic goes here
    console.log(`[NotificationService] Reminders synced for shift starting at: ${startTime}`);
};

/**
 * Starts or updates the Native Timer Notification
 */
export const updateAttendanceNotification = async (
    clockInTimestamp: string,
    isOvertime: boolean,
    isBreakMode: boolean,
    accumulatedBreakMs: number = 0
) => {
    const startTimeMs = new Date(clockInTimestamp).getTime();
    const chronometerStartTime = startTimeMs + accumulatedBreakMs;

    // Format the Exact Clock-In Time
    const timeInStr = new Date(clockInTimestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });

    // Calculate Elapsed Time
    const totalElapsedMs = Date.now() - chronometerStartTime;
    const elapsedHrs = Math.floor(totalElapsedMs / (1000 * 60 * 60));
    const elapsedMins = Math.floor((totalElapsedMs % (1000 * 60 * 60)) / (1000 * 60));
    const elapsedText = elapsedHrs > 0 
        ? `${elapsedHrs} hr ${elapsedMins} min` 
        : `${elapsedMins} min`;

    // Dynamic Theme Detection for Icon Background Color
    const colorScheme = Appearance.getColorScheme();
    const isDarkMode = colorScheme === 'dark';
    
    // Choose base color: Dark = Orange (#f97316), Light = Indigo (#4f46e5)
    const baseThemeColor = isDarkMode ? '#f97316' : '#4f46e5';
    
    // If on break, we can still use a distinct warning color, or fallback to the theme color
    const notificationColor = isBreakMode ? '#F59E0B' : baseThemeColor;

    await notifee.displayNotification({
        id: 'attendance_persistent',
        title: isBreakMode 
            ? '☕ You are on Break' 
            : isOvertime 
                ? '🔥 Overtime Active' 
                : '💼 Shift in Progress',
        
        body: isBreakMode 
            ? `Paused. Time In: ${timeInStr}` 
            : `Time In: ${timeInStr} • Elapsed: ${elapsedText}`,
            
        android: {
            channelId: 'attendance_timer',
            
            // 1. SMALL ICON: Expo auto-generates your app.json icon into 'notification_icon'
            smallIcon: 'notification_icon', 
            
            // 2. LARGE ICON: Only ONE set of dots "../"
            largeIcon: require('../assets/icons/notification/ic-dart-notification-large.png'), 
            
            // 3. DYNAMIC COLOR: Based on system theme
            color: notificationColor, 
            
            ongoing: true,
            autoCancel: false,
            asForegroundService: true, 
            showChronometer: !isBreakMode, 
            chronometerDirection: 'up',
            timestamp: chronometerStartTime, 

            style: {
                type: AndroidStyle.BIGTEXT,
                text: isBreakMode 
                    ? `Your shift timer is currently paused.\n\n🕒 **Time In:** ${timeInStr}` 
                    : `Your shift is actively being tracked.\n\n🕒 **Time In:** ${timeInStr}\n⏱️ **Worked:** ${elapsedText}`,
            },

            actions: isBreakMode ? [
                {
                    title: 'Resume Work',
                    pressAction: { id: 'action_resume' },
                }
            ] : [
                {
                    title: 'Take Break',
                    pressAction: { id: 'action_break' },
                },
                {
                    title: 'Time Out',
                    pressAction: { id: 'action_checkout' },
                }
            ]
        },
        ios: {
            interruptionLevel: 'critical',
        }
    });
};

export const clearAttendanceNotification = async () => {
    if (Platform.OS === 'android') {
        await notifee.stopForegroundService();
    }
    await notifee.cancelNotification('attendance_persistent');
};

export const showStandardNotification = async (title: string, body: string) => {
    const isDarkMode = Appearance.getColorScheme() === 'dark';
    
    await notifee.displayNotification({
        title,
        body,
        android: {
            channelId: 'standard_alerts',
            smallIcon: 'notification_icon',
            color: isDarkMode ? '#f97316' : '#4f46e5',
            pressAction: { id: 'default' },
        },
    });
}; 