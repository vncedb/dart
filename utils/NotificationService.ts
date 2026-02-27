import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

export const initNotificationSystem = async () => {
    await notifee.requestPermission();

    if (Platform.OS === 'android') {
        await notifee.createChannel({
            id: 'attendance_timer',
            name: 'Active Shift Timer',
            importance: AndroidImportance.HIGH,
            vibration: false, // Prevents buzzing every second
        });

        await notifee.createChannel({
            id: 'standard_alerts',
            name: 'System Alerts',
            importance: AndroidImportance.HIGH,
        });
    }
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
    
    // Exact chronometer start time offsetting breaks
    const chronometerStartTime = startTimeMs + accumulatedBreakMs;

    await notifee.displayNotification({
        id: 'attendance_persistent',
        title: isBreakMode ? '☕ You are on Break' : isOvertime ? '🔥 Overtime Active' : '💼 Shift in Progress',
        body: isBreakMode ? 'Your shift timer is currently paused.' : 'Tap to view your session details.',
        android: {
            channelId: 'attendance_timer',
            
            // Assigning the copied drawable images
            smallIcon: 'ic_timer_small', 
            largeIcon: 'ic_timer_large', 
            
            // This tints the small icon and the action icons automatically
            color: isBreakMode ? '#F59E0B' : '#3B82F6', 
            
            ongoing: true,
            autoCancel: false,
            asForegroundService: true, 

            // NATIVE CHRONOMETER (100% accurate, no battery drain)
            showChronometer: !isBreakMode, 
            chronometerDirection: 'up',
            timestamp: chronometerStartTime, 

            // Interactive Buttons with Custom Icons
            actions: isBreakMode ? [
                {
                    title: 'Resume Work',
                    icon: 'ic_resume',
                    pressAction: { id: 'action_resume' },
                }
            ] : [
                {
                    title: 'Take Break',
                    icon: 'ic_pause',
                    pressAction: { id: 'action_break' },
                },
                {
                    title: 'Time Out',
                    icon: 'ic_timeout',
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
    await notifee.displayNotification({
        title,
        body,
        android: {
            channelId: 'standard_alerts',
            smallIcon: 'ic_timer_small',
            pressAction: { id: 'default' },
        },
    });
};