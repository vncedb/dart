import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configure Handler (Fixed Deprecation Warning)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Replaces shouldShowAlert
    shouldShowList: true,   // Replaces shouldShowAlert
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

// 2. Setup Categories & Channels
export async function initNotificationSystem() {
  if (Platform.OS === 'android') {
    // [CRITICAL] Delete old channel to force settings update (like Importance level)
    await Notifications.deleteNotificationChannelAsync('attendance_persistent');
    
    await setupChannels();

    // Define Buttons
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
    // High Importance is REQUIRED for Banners (Heads-up Notifications)
    await Notifications.setNotificationChannelAsync('attendance_persistent', {
      name: 'Attendance Status',
      importance: Notifications.AndroidImportance.HIGH, 
      vibrationPattern: [0], // Silent vibration to prevent buzzing every second
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      sound: null, 
    });
}

// 3. Update Logic
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
  // Large Counter in Title
  const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  
  let statusText = '';
  let color = '#10b981'; // Green
  let category = 'attendance_active';
  
  // Icon Configuration
  // This must match the file name in android/app/src/main/res/drawable/
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
      title: timeString, // Large Counter
      body: statusText,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: category,
      data: { type: 'attendance_update' },
      color: color, 
      // HIGH priority is needed for the banner to slide down
      priority: Notifications.AndroidNotificationPriority.HIGH, 
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