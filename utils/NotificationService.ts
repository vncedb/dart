import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { saveNotificationLocal } from '../lib/database'; // Import DB save function

// 1. Configure Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true, // Set to true for sound
    shouldSetBadge: true,
  }),
});

// 2. Setup Categories & Channels
export async function initNotificationSystem() {
  if (Platform.OS === 'android') {
    // Delete old channel to ensure updates apply
    await Notifications.deleteNotificationChannelAsync('attendance_persistent');
    
    await setupChannels();

    // Define Action Buttons
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
}

async function setupChannels() {
    // Persistent Channel (Silent, for ongoing timer)
    await Notifications.setNotificationChannelAsync('attendance_persistent', {
      name: 'Attendance Status',
      importance: Notifications.AndroidImportance.LOW, 
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
      sound: null, 
    });

    // Alert Channel (High Priority, for important updates)
    await Notifications.setNotificationChannelAsync('attendance_alerts', {
      name: 'Attendance Alerts',
      importance: Notifications.AndroidImportance.HIGH, 
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      sound: 'default',
    });
}

// 3. Helper: Notify AND Save to History
export async function notifyAndSave(
  userId: string,
  title: string,
  body: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  data: any = {}
) {
  // A. Show System Notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      // @ts-ignore
      channelId: 'attendance_alerts', // Use the high priority channel
    },
    trigger: null,
  });

  // B. Save to Local DB (for In-App History)
  if (userId) {
    try {
      await saveNotificationLocal({
        user_id: userId,
        title,
        body,
        type,
        data
      });
    } catch (e) {
      console.log("Failed to save notification locally:", e);
    }
  }
}

// 4. Update Persistent Notification (The Sticky Timer)
export async function updateAttendanceNotification(
    startTime: string | Date, 
    isOvertime: boolean = false, 
    isOnBreak: boolean = false, 
    isFirstShow: boolean = false
) {
  const now = new Date();
  const start = new Date(startTime);
  
  const diffSecs = differenceInSeconds(now, start);
  const h = Math.floor(diffSecs / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  
  const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  
  let statusText = '';
  let color = '#10b981'; // Green
  let category = 'attendance_active';
  
  // Icon must exist in android/app/src/main/res/drawable/
  const largeIcon = 'timer'; 

  if (isOnBreak) {
      statusText = 'On Break (Paused)';
      color = '#F59E0B'; // Orange
      category = 'attendance_break';
  } else if (isOvertime) {
      statusText = 'Overtime Active';
      color = '#EF4444'; // Red
      category = 'attendance_active';
  } else {
      statusText = 'On Duty';
      color = '#10b981'; // Green
      category = 'attendance_active';
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: timeString,
      body: statusText,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: category,
      data: { type: 'attendance_update' },
      color: color, 
      priority: Notifications.AndroidNotificationPriority.LOW, // Low priority prevents constant beeping
      // @ts-ignore
      icon: largeIcon, 
      // @ts-ignore
      channelId: 'attendance_persistent',
    },
    trigger: null, 
    identifier: 'attendance_persistent',
  });
}

export async function clearAttendanceNotification() {
  await Notifications.dismissNotificationAsync('attendance_persistent');
}