// filepath: utils/NotificationService.ts
import notifee, { AndroidImportance, AndroidStyle, AuthorizationStatus } from '@notifee/react-native';
import { Appearance, Platform } from 'react-native';
import { getDB } from '../lib/db-client';

let currentTask: Promise<any> = Promise.resolve();

const runTask = (task: () => Promise<void>): Promise<void> => {
    const p = currentTask.then(async () => {
        try {
            await task();
        } catch (error) {
            console.warn("[NotificationService] Task Error:", error);
        }
    });
    currentTask = p;
    return p;
};

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

let lastSyncNotifCall = 0;
const SYNC_NOTIF_COOLDOWN = 3000;

export const syncPersistentNotification = async (userId: string | null) => {
    if (!userId) {
        await clearAttendanceNotification();
        return;
    }

    const now = Date.now();
    if (now - lastSyncNotifCall < SYNC_NOTIF_COOLDOWN) return;
    lastSyncNotifCall = now;
    
    try {
        const db = await getDB();
        const activeShift: any = await db.getFirstAsync(
            "SELECT * FROM attendance WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1",
            [userId]
        );

        if (activeShift) {
            const displayed = await notifee.getDisplayedNotifications();
            const alreadyShowing = displayed.some(n => n.id === 'attendance_persistent');
            if (alreadyShowing) return;

            const isBreakMode = activeShift.status === 'On Break' || activeShift.status === 'Break';
            const isOvertime = activeShift.status === 'Overtime';

            let accumulatedBreakMs = 0;
            if (activeShift.remarks && activeShift.remarks.includes('BreakMs:')) {
                const match = activeShift.remarks.match(/BreakMs:(\d+)/);
                if (match) accumulatedBreakMs = parseInt(match[1], 10) || 0;
            }

            await updateAttendanceNotification(
                activeShift.clock_in,
                isOvertime,
                isBreakMode,
                accumulatedBreakMs
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
    } catch { // FIX: Removed unused 'e' variable entirely
        return false; 
    }
};

export const updateAttendanceNotification = async (
    clockInTimestamp: string,
    isOvertime: boolean,
    isBreakMode: boolean,
    accumulatedBreakMs: number = 0
) => {
    return runTask(async () => {
        const startTimeMs = new Date(clockInTimestamp).getTime();
        const chronometerStartTime = startTimeMs + accumulatedBreakMs;

        const timeInStr = new Date(clockInTimestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });

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

        const notifConfig = {
            id: 'attendance_persistent',
            title: isBreakMode 
                ? '☕ You are on Break' 
                : isOvertime 
                    ? '🔥 Overtime Active' 
                    : '💼 Shift in Progress',
            
            body: isBreakMode 
                ? `Paused. Time In: ${timeInStr}` 
                : `Time In: ${timeInStr} • Elapsed: ${elapsedText}`,
            
            ios: {
                interruptionLevel: 'critical' as const,
            }
        };

        const androidBase = {
            channelId: 'attendance_timer',
            smallIcon: 'notification_icon', 
            largeIcon: require('../assets/icons/notification/ic-dart-notification-large.png'), 
            color: notificationColor, 
            ongoing: true,
            autoCancel: false,
            showChronometer: !isBreakMode, 
            chronometerDirection: 'up' as const,
            timestamp: chronometerStartTime, 
            style: {
                type: AndroidStyle.BIGTEXT as const,
                text: isBreakMode 
                    ? `Your shift timer is currently paused.\n\n🕒 **Time In:** ${timeInStr}` 
                    : `Your shift is actively being tracked.\n\n🕒 **Time In:** ${timeInStr}\n⏱️ **Worked:** ${elapsedText}`,
            },
            actions: isBreakMode ? [
                { title: 'Resume Work', pressAction: { id: 'action_resume' } }
            ] : [
                { title: 'Take Break', pressAction: { id: 'action_break' } },
                { title: 'Time Out', pressAction: { id: 'action_checkout' } }
            ]
        };

        try {
            await notifee.displayNotification({
                ...notifConfig,
                android: { ...androidBase, asForegroundService: true },
            });
        } catch (fgErr) {
            try {
                await notifee.displayNotification({
                    ...notifConfig,
                    android: { ...androidBase, asForegroundService: false },
                });
            } catch (e) { /* last resort: silently fail */ }
        }
    });
};

export const clearAttendanceNotification = async () => {
    return runTask(async () => {
        try { await notifee.cancelNotification('attendance_persistent'); } catch (e) { /* ignore */ }
        if (Platform.OS === 'android') {
            try { await notifee.stopForegroundService(); } catch (e) { /* service may not be running */ }
        }
    });
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