// filepath: utils/NotificationService.ts
import notifee, { AndroidImportance, AndroidStyle, AuthorizationStatus } from '@notifee/react-native';
import { Appearance, Platform } from 'react-native';
import { getDB } from '../lib/db-client';

// FIX: A Promise Lock (Mutex) to prevent Android Service Manager crashes.
// This guarantees we never try to start and stop a foreground service at the exact same millisecond.
let notificationQueue = Promise.resolve();

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
};

export const syncPersistentNotification = async (userId: string | null) => {
    if (!userId) {
        await clearAttendanceNotification();
        return;
    }
    
    try {
        const db = await getDB();
        const activeShift: any = await db.getFirstAsync(
            "SELECT * FROM attendance WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1",
            [userId]
        );

        if (activeShift) {
            const isBreakMode = activeShift.status === 'On Break' || activeShift.status === 'Break';
            const isOvertime = activeShift.status === 'Overtime';
            
            await updateAttendanceNotification(
                activeShift.clock_in,
                isOvertime,
                isBreakMode,
                0 
            );
        } else {
            await clearAttendanceNotification();
        }
    } catch (error) {
        console.error("[NotificationService] Sync Error:", error);
    }
};

export const verifyActiveShiftBeforeAction = async (userId: string): Promise<boolean> => {
    try {
        const db = await getDB();
        const activeShift: any = await db.getFirstAsync(
            "SELECT id FROM attendance WHERE user_id = ? AND clock_out IS NULL",
            [userId]
        );
        
        if (!activeShift) {
            await clearAttendanceNotification();
            return false; 
        }
        return true;
    } catch (e) {
        return false; 
    }
};

export const updateAttendanceNotification = async (
    clockInTimestamp: string,
    isOvertime: boolean,
    isBreakMode: boolean,
    accumulatedBreakMs: number = 0
) => {
    notificationQueue = notificationQueue.then(async () => {
        try {
            const startTimeMs = new Date(clockInTimestamp).getTime();
            const chronometerStartTime = startTimeMs + accumulatedBreakMs;

            const timeInStr = new Date(clockInTimestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });

            // FIX: Math.max ensures the timer math never glitches into negative bounds resulting in high numbers
            const totalElapsedMs = Math.max(0, Date.now() - chronometerStartTime);
            const elapsedHrs = Math.floor(totalElapsedMs / (1000 * 60 * 60));
            const elapsedMins = Math.floor((totalElapsedMs % (1000 * 60 * 60)) / (1000 * 60));
            const elapsedText = elapsedHrs > 0 
                ? `${elapsedHrs} hr ${elapsedMins} min` 
                : `${elapsedMins} min`;

            const colorScheme = Appearance.getColorScheme();
            const isDarkMode = colorScheme === 'dark';
            const baseThemeColor = isDarkMode ? '#f97316' : '#4f46e5';
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
                    smallIcon: 'notification_icon', 
                    largeIcon: require('../assets/icons/notification/ic-dart-notification-large.png'), 
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
        } catch (e) {
            console.error("[NotificationService] Error updating notification:", e);
        }
    });

    return notificationQueue;
};

export const clearAttendanceNotification = async () => {
    notificationQueue = notificationQueue.then(async () => {
        try {
            // Cancel notification first, then stop service to prevent lifecycle crashes
            await notifee.cancelNotification('attendance_persistent');
            if (Platform.OS === 'android') {
                await notifee.stopForegroundService();
            }
        } catch (e) {
            console.log("[NotificationService] Error clearing notification", e);
        }
    });

    return notificationQueue;
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