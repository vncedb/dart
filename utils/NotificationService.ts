import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configure Handler (Dynamic Sound)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if this is the silent persistent timer
    const data = notification.request.content.data || {};
    const isSilent = data.type === 'attendance_update' || data.type === 'ongoing_job';

    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !isSilent, // Play sound only if it's NOT the timer
      shouldSetBadge: true,
    };
  },
});

// 2. Setup Categories & Channels
export async function initNotificationSystem() {
  // [FIX] Request Permissions on Init
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted!');
    return;
  }

  if (Platform.OS === 'android') {
    // [CRITICAL] Delete old channel to force settings update (like Importance level)
    // You can comment this out after the first successful run to avoid recreating it every time
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
      sound: null, // Keep channel silent, let the Handler manage sound
    });

    // Ensure default channel exists for other notifications
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
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
      data: { type: 'attendance_update' }, // Used by Handler to silence sound
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