import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// --- 1. Handler Configuration ---
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check global push setting immediately
    const settings = await getNotificationSettings();
    if (!settings.pushEnabled) {
        return {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
        };
    }

    const data = notification.request.content.data || {};
    const isStatusChange = data.type === 'status_change';
    const isGeneralAlert = data.type === 'general_alert';

    // Timer Ticks are silent
    if (!isStatusChange && !isGeneralAlert) {
        return {
            shouldShowBanner: false,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
        };
    }

    // Alerts (Reminders/Status Changes) are prominent
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

// --- 2. Initialization ---
export async function initNotificationSystem() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') return false;

  if (Platform.OS === 'android') {
    await setupChannels();
  }
  return true;
}

async function setupChannels() {
    // Silent Channel for Timer
    await Notifications.setNotificationChannelAsync('attendance_persistent', {
      name: 'Attendance Status',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0], 
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
      sound: null,
    });

    // High Importance Channel for Alerts
    await Notifications.setNotificationChannelAsync('attendance_alerts', {
        name: 'Reminders & Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
        sound: 'default',
    });
}

// --- 3. Persistent Timer Notification ---
export async function updateAttendanceNotification(
    startTime: string | Date, 
    isOvertime: boolean = false, 
    isOnBreak: boolean = false, 
    isStatusChange: boolean = false 
) {
  const settings = await getNotificationSettings();
  
  // --- STRICT KILL SWITCHES ---
  // 1. Global Push Off? -> Kill
  if (!settings.pushEnabled) {
      await clearAttendanceNotification();
      return;
  }
  
  // 2. Persistent Timer Off? -> Kill (Even if status changed)
  // FIX: Removed "!isStatusChange" check so it strictly respects the setting
  if (!settings.persistentTimer) {
      await clearAttendanceNotification();
      return;
  }

  const now = new Date();
  const start = new Date(startTime);
  
  const diffSecs = differenceInSeconds(now, start);
  const h = Math.floor(diffSecs / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  
  const timeString = `${h}h ${m.toString().padStart(2, '0')}m`;
  let statusText = 'Active Session';
  let color = '#10b981'; 

  if (isOnBreak) {
      statusText = '⏸ ON BREAK'; 
      color = '#F59E0B'; 
  } else if (isOvertime) {
      statusText = '⚠️ OVERTIME';
      color = '#EF4444'; 
  }

  // Use high priority only for status changes
  const priority = isStatusChange 
    ? Notifications.AndroidNotificationPriority.HIGH 
    : Notifications.AndroidNotificationPriority.LOW;

  try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: timeString,
          body: statusText,
          sticky: true,
          autoDismiss: false,
          data: { type: isStatusChange ? 'status_change' : 'timer_tick' }, 
          color: color, 
          priority: priority,
          // @ts-ignore
          icon: 'notification_icon', 
          channelId: 'attendance_persistent',
        } as any, 
        trigger: null,
        identifier: 'attendance_persistent',
      });
  } catch (e) {
      console.warn("Failed to update notification:", e);
  }
}

export async function clearAttendanceNotification() {
  try {
      await Notifications.dismissNotificationAsync('attendance_persistent');
  } catch (e) {
      // Ignore
  }
}

// --- 4. Reminders (Shift & Reports) ---
export async function scheduleReminders(shiftStart: string | null) {
    const settings = await getNotificationSettings();
    
    // Always clear existing to avoid duplicates/stale times
    await Notifications.cancelScheduledNotificationAsync('shift_reminder');
    await Notifications.cancelScheduledNotificationAsync('daily_report_reminder');

    if (!settings.pushEnabled) return;

    // A. Shift Reminder (15 mins before)
    if (settings.clockInReminder && shiftStart) {
        const [h, m] = shiftStart.split(':').map(Number);
        const shiftDate = new Date();
        shiftDate.setHours(h, m, 0, 0);

        if (shiftDate < new Date()) {
            shiftDate.setDate(shiftDate.getDate() + 1);
        }

        const reminderTime = new Date(shiftDate.getTime() - 15 * 60000);

        await Notifications.scheduleNotificationAsync({
            identifier: 'shift_reminder',
            content: {
                title: 'Shift Starting Soon ⏳',
                body: `You have a shift starting at ${shiftStart}.`,
                data: { type: 'general_alert' },
                sound: true,
                channelId: 'attendance_alerts'
            } as any,
            trigger: reminderTime as any,
        });
    }

    // B. Daily Report Reminder (Default 5 PM)
    if (settings.dailyReportReminder) {
        const reportTime = new Date();
        reportTime.setHours(17, 0, 0, 0); 
        
        if (reportTime < new Date()) {
            reportTime.setDate(reportTime.getDate() + 1);
        }

        await Notifications.scheduleNotificationAsync({
            identifier: 'daily_report_reminder',
            content: {
                title: 'End of Day Report 📊',
                body: "Don't forget to generate your daily report.",
                data: { type: 'general_alert' },
                sound: true,
                channelId: 'attendance_alerts'
            } as any,
            trigger: reportTime as any,
        });
    }
}

// --- 5. Settings Helper ---
export async function getNotificationSettings() {
    try {
        const stored = await AsyncStorage.getItem('notificationSettings');
        if (stored) return JSON.parse(stored);
    } catch (e) {
        // Ignore
    }
    
    return { 
        pushEnabled: true,
        clockInReminder: true,
        persistentTimer: true, 
        breakReminders: true,
        dailyReportReminder: true,
        reportGenerationAlert: true
    };
}