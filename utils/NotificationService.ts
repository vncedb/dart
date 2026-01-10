import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// 1. Configure Notification Behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

// 2. Setup Action Buttons (e.g., Clock Out directly from notification)
export async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('shift_actions', [
    {
      identifier: 'clock_out',
      buttonTitle: 'Clock Out Now',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'view_details',
      buttonTitle: 'View Details',
      options: { opensAppToForeground: true },
    },
  ]);
}

// 3. Register for Push Notifications
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    // console.log('Must use physical device for Push Notifications');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

// 4. Send Local Notification
export async function sendLocalNotification(title: string, body: string, categoryId?: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      categoryIdentifier: categoryId, // Links to buttons defined above
      data: { timestamp: Date.now() },
    },
    trigger: null, // Send immediately
  });
}