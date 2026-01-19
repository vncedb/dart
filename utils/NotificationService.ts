import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configure Handler (FIXED DEPRECATION WARNING)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Note: In newer Expo versions, this is deprecated for 'shouldShowBanner'
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 2. Setup Categories
export async function setupNotificationCategories() {
  if (Platform.OS === 'android') {
    // Note: If the icon file is missing in 'res/drawable', the button might not show.
    // Ensure 'pause_circle.png', 'timeout.png', etc. exist in android/app/src/main/res/drawable/
    
    // WORK MODE ACTIONS
    await Notifications.setNotificationCategoryAsync('attendance_active', [
      {
        identifier: 'action_break_start',
        buttonTitle: 'Pause',
        // @ts-ignore
        icon: 'pause_circle', 
        options: { opensAppToForeground: false }, 
      },
      {
        identifier: 'action_checkout',
        buttonTitle: 'Check Out',
        // @ts-ignore
        icon: 'timeout', 
        options: { opensAppToForeground: true }, 
      },
    ]);

    // BREAK MODE ACTIONS
    await Notifications.setNotificationCategoryAsync('attendance_break', [
        {
          identifier: 'action_break_end',
          buttonTitle: 'Resume',
          // @ts-ignore
          icon: 'play_circle', 
          options: { opensAppToForeground: false }, 
        },
        {
            identifier: 'action_checkout',
            buttonTitle: 'Check Out',
            // @ts-ignore
            icon: 'timeout', 
            options: { opensAppToForeground: true }, 
        },
      ]);
  } else {
    // iOS Fallback (No icons supported in the same way)
    await Notifications.setNotificationCategoryAsync('attendance_active', [
        { identifier: 'action_break_start', buttonTitle: 'Pause', options: { opensAppToForeground: false } },
        { identifier: 'action_checkout', buttonTitle: 'Check Out', options: { opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync('attendance_break', [
        { identifier: 'action_break_end', buttonTitle: 'Resume', options: { opensAppToForeground: false } },
        { identifier: 'action_checkout', buttonTitle: 'Check Out', options: { opensAppToForeground: true } },
    ]);
  }
}

// 3. Register & Channels
export async function registerForPushNotificationsAsync() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    // Low importance channel for silent timer updates
    await Notifications.setNotificationChannelAsync('attendance-updates', {
      name: 'Attendance Timer',
      importance: Notifications.AndroidImportance.LOW, 
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    // High importance channel for the initial banner
    await Notifications.setNotificationChannelAsync('attendance-alerts', {
      name: 'Attendance Alerts',
      importance: Notifications.AndroidImportance.HIGH, 
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
  }
}

// 4. Update Logic
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
  
  let title = '';
  let body = '';
  let color = '#10b981'; // Green
  let category = 'attendance_active';
  
  // NATIVE ICON for the small status bar icon
  // Ensure 'timer.png' exists in android/app/src/main/res/drawable
  const smallIcon = 'timer'; 

  if (isOnBreak) {
      title = `${timeString}`; 
      body = 'On Break';
      color = '#F59E0B'; // Orange
      category = 'attendance_break';
  } else if (isOvertime) {
      title = `${timeString}`; 
      body = 'Overtime Active';
      color = '#EF4444'; // Red
      category = 'attendance_active';
  } else {
      title = `${timeString}`; 
      body = 'Active Shift';
      color = '#10b981'; // Green
      category = 'attendance_active';
  }

  // Choose channel based on if we want a Banner (High) or Silent Update (Low)
  const channelId = isFirstShow ? 'attendance-alerts' : 'attendance-updates';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title, 
      body: body,   
      subtitle: isOnBreak ? 'Paused' : 'On Duty',
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: category,
      data: { type: 'attendance_update' },
      sound: isFirstShow, 
      color: color, 
      priority: isFirstShow ? Notifications.AndroidNotificationPriority.HIGH : Notifications.AndroidNotificationPriority.LOW,
      // @ts-ignore 
      icon: smallIcon 
    },
    trigger: null,
    identifier: 'attendance_persistent',
  });
}

export async function clearAttendanceNotification() {
  await Notifications.dismissNotificationAsync('attendance_persistent');
}