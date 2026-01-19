import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configure Handler (Updated for Expo SDK 50+)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true, // Replaces 'shouldShowAlert' for the pop-up
    shouldShowList: true,   // Replaces 'shouldShowAlert' for the notification center
  }),
});

// 2. Setup Categories
export async function setupNotificationCategories() {
  if (Platform.OS === 'android') {
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
    // Silent updates channel
    await Notifications.setNotificationChannelAsync('attendance-updates', {
      name: 'Attendance Timer',
      importance: Notifications.AndroidImportance.LOW, 
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    // Initial alert channel
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
  let color = '#10b981';
  let category = 'attendance_active';
  
  // Use 'timer' native icon
  const smallIcon = 'timer'; 

  if (isOnBreak) {
      title = `${timeString}`; 
      body = 'On Break';
      color = '#F59E0B'; 
      category = 'attendance_break';
  } else if (isOvertime) {
      title = `${timeString}`; 
      body = 'Overtime Active';
      color = '#EF4444'; 
      category = 'attendance_active';
  } else {
      title = `${timeString}`; 
      body = 'Active Shift';
      color = '#10b981'; 
      category = 'attendance_active';
  }

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
      icon: smallIcon,
      // @ts-ignore
      channelId: channelId,
    },
    trigger: null,
    identifier: 'attendance_persistent',
  });
}

export async function clearAttendanceNotification() {
  await Notifications.dismissNotificationAsync('attendance_persistent');
}