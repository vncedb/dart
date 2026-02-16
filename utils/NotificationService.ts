import AsyncStorage from '@react-native-async-storage/async-storage';
import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// --- 1. Centralized Handler Configuration ---
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    const isStatusChange = data.type === 'status_change';
    
    // Silent updates for timer ticks
    if (!isStatusChange) {
        return {
            shouldShowBanner: false,
            shouldShowList: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
        };
    }

    // Prominent updates for status changes (Pause/Resume)
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

// --- 2. System Initialization ---
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
    await setupCategories();
  }
  return true;
}

async function setupChannels() {
    await Notifications.setNotificationChannelAsync('attendance_persistent', {
      name: 'Attendance Status',
      importance: Notifications.AndroidImportance.LOW, // Low importance prevents sound/vibrate on update
      vibrationPattern: [0], 
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
      sound: null,
    });
}

async function setupCategories() {
    await Notifications.setNotificationCategoryAsync('attendance_active', [
      {
        identifier: 'action_break_start',
        buttonTitle: 'Pause (Break)',
        options: { opensAppToForeground: false }, 
      },
      {
        identifier: 'action_checkout',
        buttonTitle: 'Time Out',
        options: { opensAppToForeground: true }, 
      },
    ]);

    await Notifications.setNotificationCategoryAsync('attendance_break', [
        {
          identifier: 'action_break_end',
          buttonTitle: 'Resume (Work)',
          options: { opensAppToForeground: false }, 
        },
        {
            identifier: 'action_checkout',
            buttonTitle: 'Time Out',
            options: { opensAppToForeground: true }, 
        },
      ]);
}

// --- 3. Dynamic Attendance Notification ---
export async function updateAttendanceNotification(
    startTime: string | Date, 
    isOvertime: boolean = false, 
    isOnBreak: boolean = false, 
    isStatusChange: boolean = false 
) {
  const settings = await getNotificationSettings();
  if (!settings.persistentTimer && !isStatusChange) return;

  const now = new Date();
  const start = new Date(startTime);
  
  const diffSecs = differenceInSeconds(now, start);
  const h = Math.floor(diffSecs / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  
  // IMPROVEMENT: Removed seconds from notification title. 
  // Updating seconds every minute looks like a bug (frozen seconds).
  // "4h 12m" is cleaner and always accurate to the minute.
  const timeString = `${h}h ${m.toString().padStart(2, '0')}m`;
  
  let statusText = '';
  let color = '#10b981'; // Green
  let category = 'attendance_active';
  
  // Ensure the icon file exists in android/app/src/main/res/drawable/
  let icon = 'timer'; 

  if (isOnBreak) {
      statusText = '⏸ ON BREAK'; 
      color = '#F59E0B'; // Orange
      category = 'attendance_break';
  } else if (isOvertime) {
      statusText = '⚠️ OVERTIME';
      color = '#EF4444'; // Red
      category = 'attendance_active';
  } else {
      statusText = 'Creating Value...'; 
      color = '#10b981'; // Green
      category = 'attendance_active';
  }

  // Force high priority only on status changes to pop the banner
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
          categoryIdentifier: category,
          data: { type: isStatusChange ? 'status_change' : 'timer_tick' }, 
          color: color, 
          priority: priority,
          // @ts-ignore
          icon: icon, 
          channelId: 'attendance_persistent',
        },
        trigger: null,
        identifier: 'attendance_persistent',
      });
  } catch (e) {
      console.warn("Failed to update notification:", e);
  }
}

export async function clearAttendanceNotification() {
  await Notifications.dismissNotificationAsync('attendance_persistent');
}

async function getNotificationSettings() {
    try {
        const stored = await AsyncStorage.getItem('notificationSettings');
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { persistentTimer: true };
}