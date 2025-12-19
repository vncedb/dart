import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// [WORKAROUND] expo-notifications crashes Expo Go on Android (SDK 53+).
// To use notifications, you MUST use a Development Build (npx expo run:android).
// For now, we mock this library so your app doesn't crash in Expo Go.

// import * as Notifications from 'expo-notifications'; // <--- COMMENTED OUT TO PREVENT CRASH

// Mock Notification Handler
const mockSchedule = async () => {
  console.log('[Mock] Notification scheduled (Not supported in Expo Go)');
  if (Platform.OS === 'android') {
    // Optional: Show a simple Alert instead of a notification for testing
    // Alert.alert("Notification (Mock)", "This is a simulated notification."); 
  }
};

type NotificationType = 'checkInOut' | 'reportGen' | 'cutoff' | 'general';

export async function sendLocalNotification(title: string, body: string, type: NotificationType = 'general') {
  try {
    // 1. Get Settings
    const jsonSettings = await AsyncStorage.getItem('appSettings');
    const settings = jsonSettings ? JSON.parse(jsonSettings) : {};

    // 2. Default to TRUE if setting is missing (first time user)
    const isEnabled = (key: string) => settings[key] !== false;

    // 3. Check Toggle Logic
    let shouldSend = true;
    switch (type) {
        case 'checkInOut': shouldSend = isEnabled('notifCheckInOut'); break;
        case 'reportGen': shouldSend = isEnabled('notifReportGen'); break;
        case 'cutoff': shouldSend = isEnabled('notifCutoff'); break;
        default: shouldSend = isEnabled('notifGeneral'); break; // General
    }

    if (!shouldSend) {
        console.log(`[Notification Skipped] Type: ${type} is disabled.`);
        return;
    }

    // 4. Schedule/Send Notification (MOCKED)
    /* UNCOMMENT THIS BLOCK WHEN USING A DEVELOPMENT BUILD
       
       await Notifications.scheduleNotificationAsync({
         content: {
           title,
           body,
           sound: settings.soundEnabled !== false, 
           vibrate: settings.vibrationEnabled !== false ? [0, 250, 250, 250] : [],
         },
         trigger: null, 
       });
    */
   
    await mockSchedule();

  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}