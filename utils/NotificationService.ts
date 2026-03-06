import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
    AndroidImportance,
    AndroidStyle,
    AuthorizationStatus,
    RepeatFrequency,
    TriggerType,
    type TimestampTrigger,
} from '@notifee/react-native';
import { Appearance, Platform } from 'react-native';
import { getDB } from '../lib/db-client';

let currentTask: Promise<any> = Promise.resolve();

const runTask = (task: () => Promise<void>): Promise<void> => {
    const p = currentTask.then(async () => {
        try {
            await task();
        } catch (error) {
            console.warn('[NotificationService] Task Error:', error);
        }
    });
    currentTask = p;
    return p;
};

const REMINDER_SHIFT_ID = 'reminder_shift_start';
const REMINDER_DAILY_REPORT_ID = 'reminder_daily_report';

const getNotificationSettings = async () => {
    const [notifRaw, appRaw] = await Promise.all([
        AsyncStorage.getItem('notificationSettings'),
        AsyncStorage.getItem('appSettings'),
    ]);

    const notif = notifRaw ? JSON.parse(notifRaw) : {};
    const app = appRaw ? JSON.parse(appRaw) : {};

    return {
        pushEnabled: notif.pushEnabled !== false,
        clockInReminder: notif.clockInReminder !== false,
        persistentTimer: notif.persistentTimer !== false,
        breakReminders: notif.breakReminders !== false,
        dailyReportReminder: notif.dailyReportReminder !== false,
        reportGenerationAlert: notif.reportGenerationAlert !== false,
        notificationsEnabled: app.notificationsEnabled !== false,
    };
};

const parseTime = (value: string | null) => {
    if (!value) return null;
    const [h, m] = value.split(':').map((n) => Number(n));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return { hour: h, minute: m };
};

const nextTimestampForTime = (hour: number, minute: number) => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
    }
    return next.getTime();
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

        await notifee.createChannel({
            id: 'scheduled_reminders',
            name: 'Daily Reminders',
            importance: AndroidImportance.DEFAULT,
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
    const settings = await getNotificationSettings();

    await Promise.all([
        notifee.cancelTriggerNotification(REMINDER_SHIFT_ID).catch(() => undefined),
        notifee.cancelTriggerNotification(REMINDER_DAILY_REPORT_ID).catch(() => undefined),
    ]);

    if (!settings.pushEnabled || !settings.notificationsEnabled) return;

    if (settings.clockInReminder) {
        const parsed = parseTime(startTime);
        if (parsed) {
            const shiftReminderTime = nextTimestampForTime(parsed.hour, parsed.minute);
            const trigger: TimestampTrigger = {
                type: TriggerType.TIMESTAMP,
                timestamp: shiftReminderTime,
                repeatFrequency: RepeatFrequency.DAILY,
            };

            await notifee.createTriggerNotification(
                {
                    id: REMINDER_SHIFT_ID,
                    title: 'Shift Reminder',
                    body: 'Your scheduled shift is about to start. Open DART to clock in.',
                    android: {
                        channelId: 'scheduled_reminders',
                        smallIcon: 'notification_icon',
                        pressAction: { id: 'default' },
                    },
                },
                trigger
            );
        }
    }

    if (settings.dailyReportReminder) {
        const dailyReportTimestamp = nextTimestampForTime(18, 0);
        const trigger: TimestampTrigger = {
            type: TriggerType.TIMESTAMP,
            timestamp: dailyReportTimestamp,
            repeatFrequency: RepeatFrequency.DAILY,
        };

        await notifee.createTriggerNotification(
            {
                id: REMINDER_DAILY_REPORT_ID,
                title: 'Daily Report Reminder',
                body: 'Review your attendance and accomplishments before ending the day.',
                android: {
                    channelId: 'scheduled_reminders',
                    smallIcon: 'notification_icon',
                    pressAction: { id: 'default' },
                },
            },
            trigger
        );
    }
};

let lastSyncNotifCall = 0;
const SYNC_NOTIF_COOLDOWN = 3000;

export const syncPersistentNotification = async (userId: string | null) => {
    if (!userId) {
        await clearAttendanceNotification();
        return;
    }

    const settings = await getNotificationSettings();
    if (!settings.pushEnabled || !settings.notificationsEnabled || !settings.persistentTimer) {
        await clearAttendanceNotification();
        return;
    }

    const now = Date.now();
    if (now - lastSyncNotifCall < SYNC_NOTIF_COOLDOWN) return;
    lastSyncNotifCall = now;

    try {
        const db = await getDB();
        const activeShift: any = await db.getFirstAsync(
            'SELECT * FROM attendance WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
            [userId]
        );

        if (activeShift) {
            const displayed = await notifee.getDisplayedNotifications();
            const alreadyShowing = displayed.some((n) => n.id === 'attendance_persistent');
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
        console.error('[NotificationService] Sync Error:', error);
    }
};

export const verifyActiveShiftBeforeAction = async (userId: string): Promise<boolean> => {
    try {
        const db = await getDB();
        const activeShift: any = await db.getFirstAsync(
            'SELECT id FROM attendance WHERE user_id = ? AND clock_out IS NULL',
            [userId]
        );

        if (!activeShift) {
            await clearAttendanceNotification();
            return false;
        }
        return true;
    } catch {
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
        const settings = await getNotificationSettings();
        if (!settings.pushEnabled || !settings.notificationsEnabled || !settings.persistentTimer) {
            await clearAttendanceNotification();
            return;
        }

        const startTimeMs = new Date(clockInTimestamp).getTime();
        const chronometerStartTime = startTimeMs + accumulatedBreakMs;

        const timeInStr = new Date(clockInTimestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        const totalElapsedMs = Math.max(0, Date.now() - chronometerStartTime);
        const elapsedHrs = Math.floor(totalElapsedMs / (1000 * 60 * 60));
        const elapsedMins = Math.floor((totalElapsedMs % (1000 * 60 * 60)) / (1000 * 60));
        const elapsedText = elapsedHrs > 0 ? `${elapsedHrs} hr ${elapsedMins} min` : `${elapsedMins} min`;

        const colorScheme = Appearance.getColorScheme();
        const isDarkMode = colorScheme === 'dark';
        const baseThemeColor = isDarkMode ? '#f97316' : '#4f46e5';
        const notificationColor = isBreakMode ? '#f59e0b' : baseThemeColor;

        const title = isBreakMode
            ? 'Break In Progress'
            : isOvertime
                ? 'Overtime In Progress'
                : 'Shift In Progress';

        const body = isBreakMode
            ? `Paused. Time In: ${timeInStr}`
            : `Time In: ${timeInStr} • Elapsed: ${elapsedText}`;

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
                    ? `Your shift timer is currently paused.\n\nTime In: ${timeInStr}`
                    : `Your shift is actively being tracked.\n\nTime In: ${timeInStr}\nWorked: ${elapsedText}`,
            },
            actions: isBreakMode
                ? [{ title: 'Resume Work', pressAction: { id: 'action_resume' } }]
                : [
                    { title: 'Take Break', pressAction: { id: 'action_break' } },
                    { title: 'Time Out', pressAction: { id: 'action_checkout' } },
                ],
        };

        try {
            await notifee.displayNotification({
                id: 'attendance_persistent',
                title,
                body,
                android: { ...androidBase, asForegroundService: true },
            });
        } catch {
            await notifee.displayNotification({
                id: 'attendance_persistent',
                title,
                body,
                android: { ...androidBase, asForegroundService: false },
            });
        }
    });
};

export const clearAttendanceNotification = async () => {
    return runTask(async () => {
        try {
            await notifee.cancelNotification('attendance_persistent');
        } catch {
            // ignore
        }
        if (Platform.OS === 'android') {
            try {
                await notifee.stopForegroundService();
            } catch {
                // service may not be running
            }
        }
    });
};

export const showStandardNotification = async (title: string, body: string) => {
    const settings = await getNotificationSettings();
    if (!settings.pushEnabled || !settings.notificationsEnabled) return;

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
