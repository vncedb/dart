import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configure Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false, // We control sound via channels
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 2. Setup Categories with Native Icons
export async function setupNotificationCategories() {
  if (Platform.OS === 'android') {
    // Action: Break Start
    await Notifications.setNotificationCategoryAsync('attendance_active', [
      {
        identifier: 'action_break_start',
        buttonTitle: 'Pause',
        // @ts-ignore
        icon: 'pause_circle', // drawable/pause_circle.png
        options: { opensAppToForeground: false }, 
      },
      {
        identifier: 'action_checkout',
        buttonTitle: 'Check Out',
        // @ts-ignore
        icon: 'timeout', // drawable/timeout.png
        options: { opensAppToForeground: true }, 
      },
    ]);

    // Action: Break End
    await Notifications.setNotificationCategoryAsync('attendance_break', [
        {
          identifier: 'action_break_end',
          buttonTitle: 'Resume',
          // @ts-ignore
          icon: 'play_circle', // drawable/play_circle.png
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

// 3. Register & Reset Channels (Fixes "No Banner" issues)
export async function registerForPushNotificationsAsync() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    // DELETE OLD CHANNELS to force update settings (like Priority/Sound)
    await Notifications.deleteNotificationChannelAsync('attendance-updates');
    await Notifications.deleteNotificationChannelAsync('attendance-alerts');

    // 1. Silent Channel (For Timer Updates)
    await Notifications.setNotificationChannelAsync('attendance-updates', {
      name: 'Attendance Timer',
      importance: Notifications.AndroidImportance.LOW, // No sound, no pop-up
      vibrationPattern: [0],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });

    // 2. Alert Channel (For Initial Banner)
    await Notifications.setNotificationChannelAsync('attendance-alerts', {
      name: 'Attendance Alerts',
      importance: Notifications.AndroidImportance.HIGH, // Sound + Pop-up Banner
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
  }
}

// 4. Update Notification Logic
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
  
  // NATIVE SMALL ICON (Status Bar)
  const smallIcon = 'timer'; 

  if (isOnBreak) {
      title = `${timeString} · Paused`; 
      body = 'Tap Resume to continue tracking';
      color = '#F59E0B'; // Orange
      category = 'attendance_break';
  } else if (isOvertime) {
      title = `${timeString} · Overtime`; 
      body = 'You are working overtime';
      color = '#EF4444'; // Red
      category = 'attendance_active';
  } else {
      title = `${timeString} · On Duty`; 
      body = 'Tracking active shift...';
      color = '#10b981'; // Green
      category = 'attendance_active';
  }

  // Use Alert channel ONLY for the first show to trigger banner
  const channelId = isFirstShow ? 'attendance-alerts' : 'attendance-updates';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title, 
      body: body,
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