import { differenceInSeconds } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configure Handler (Dynamic Behavior)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    
    // Determine the type of update
    const isTimerTick = data.type === 'timer_tick';
    const isStatusChange = data.type === 'status_change';

    return {
      // ONLY show banner (pop-down) for status changes (Start, Pause, Resume), NEVER for timer ticks
      shouldShowBanner: isStatusChange,
      // Always show in the notification center/tray
      shouldShowList: true,
      // Play sound only for status changes, never for timer ticks
      shouldPlaySound: isStatusChange,
      shouldSetBadge: true,
    };
  },
});

// 2. Setup Categories & Channels
export async function initNotificationSystem() {
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
    // Delete old channel to ensure new settings apply
    await Notifications.deleteNotificationChannelAsync('attendance_persistent');
    
    await setupChannels();

    // Define Buttons - "opensAppToForeground: false" is faster as it doesn't wait for UI
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
    // We use a HIGH importance channel for the persistent notification so it stays on top,
    // but we control the "pop up" behavior via the Handler above.
    await Notifications.setNotificationChannelAsync('attendance_persistent', {
      name: 'Attendance Status',
      importance: Notifications.AndroidImportance.LOW, // LOW prevents constant peeking/sound
      vibrationPattern: [0], 
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
    isStatusChange: boolean = false // New flag to force banner
) {
  const now = new Date();
  const start = new Date(startTime);
  
  const diffSecs = differenceInSeconds(now, start);
  const h = Math.floor(diffSecs / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  const s = diffSecs % 60;

  // BIGGER COUNTER: Include seconds for dynamic "Timer" feel
  const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  
  let statusText = '';
  let color = '#10b981'; // Green
  let category = 'attendance_active';
  
  const largeIcon = 'timer'; 

  if (isOnBreak) {
      statusText = '⏸ ON BREAK'; // Added icon for visual clarity
      color = '#F59E0B'; // Orange
      category = 'attendance_break';
  } else if (isOvertime) {
      statusText = '⚠️ OVERTIME';
      color = '#EF4444'; // Red
      category = 'attendance_active';
  } else {
      statusText = 'Creating Value...'; // Dynamic text
      color = '#10b981'; // Green
      category = 'attendance_active';
  }

  // Determine priority based on action (Status changes = High Priority/Banner)
  const priority = isStatusChange 
    ? Notifications.AndroidNotificationPriority.HIGH 
    : Notifications.AndroidNotificationPriority.LOW;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: timeString, // The "Big" Timer
      body: statusText,
      sticky: true,
      autoDismiss: false,
      categoryIdentifier: category,
      // Pass type to Handler to decide on Sound/Banner
      data: { type: isStatusChange ? 'status_change' : 'timer_tick' }, 
      color: color, 
      priority: priority,
      // @ts-ignore
      icon: largeIcon, 
      // @ts-ignore
      channelId: 'attendance_persistent',
    },
    trigger: null, // null trigger = immediate
    identifier: 'attendance_persistent',
  });
}

export async function clearAttendanceNotification() {
  await Notifications.dismissNotificationAsync('attendance_persistent');
}