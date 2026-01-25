import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BiometricLockScreen from "../components/BiometricLockScreen";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import "../global.css";
import { ReportService } from "../services/ReportService";

// Ignore logs
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "shouldShowAlert is deprecated",
  "Warning: SafeAreaView",
]);

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Configure Notifications Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function RootLayoutNav() {
  const { isLoading: isAuthLoading, session, user } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const router = useRouter();
  
  const [isBiometricAuthorized, setIsBiometricAuthorized] = useState(false);
  const [isBiometricCheckDone, setIsBiometricCheckDone] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  // 1. Load Theme
  useEffect(() => {
    AsyncStorage.getItem("user-theme").then((theme) => {
      setColorScheme(theme === "dark" ? "dark" : "light");
    });
  }, [setColorScheme]);

  // 2. Setup Notifications (Permissions, Channels & Categories)
  useEffect(() => {
    const setupNotifications = async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // --- DEFINE ACTION BUTTONS ---
      await Notifications.setNotificationCategoryAsync("active_job", [
        {
          identifier: "clock_out",
          buttonTitle: "Clock Out",
          options: { isDestructive: true, opensAppToForeground: true }, 
        },
        {
          identifier: "view_job",
          buttonTitle: "View Timer",
          options: { opensAppToForeground: true },
        },
      ]);

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };

    setupNotifications();

    // Handle user interaction with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      // Handle Deep Links
      if (data && data.action === 'open_saved_reports') {
        router.push('/reports/saved-reports');
      }

      // Handle Action Buttons
      if (actionId === 'clock_out' || actionId === 'view_job' || data?.type === 'ongoing_job') {
        // Navigate the user to the Home screen (timer view)
        // Since we can't reliably execute background logic here without ejected Expo or background tasks,
        // we bring the user to the Home screen to finish the action.
        router.push('/(tabs)/home');
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  // 3. Check Biometrics & Run Auto-Tasks
  useEffect(() => {
    const checkBioAndTasks = async () => {
      try {
        const settingsJson = await AsyncStorage.getItem("appSettings");
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          if (settings.biometricEnabled === true && session) {
            setIsBiometricAuthorized(false);
          } else {
            setIsBiometricAuthorized(true);
          }
        } else {
          setIsBiometricAuthorized(true);
        }

        if (user?.id) {
            ReportService.checkAndGenerateAutoReports(user.id);
        }

      } catch (_) {
        setIsBiometricAuthorized(true);
      } finally {
        setIsBiometricCheckDone(true);
      }
    };

    if (!isAuthLoading) {
        checkBioAndTasks();
    }
  }, [isAuthLoading, session, user]);

  // 4. Determine Readiness & Hide Splash
  useEffect(() => {
    if (fontsLoaded && !isAuthLoading && isBiometricCheckDone) {
        setIsReady(true);
        SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isAuthLoading, isBiometricCheckDone]);

  if (!isReady) {
    return null; 
  }

  if (!isBiometricAuthorized) {
    return (
      <BiometricLockScreen 
        onUnlock={() => setIsBiometricAuthorized(true)} 
      />
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="introduction" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="onboarding/welcome" options={{ animation: "slide_from_right", gestureEnabled: false }} />
          <Stack.Screen name="onboarding/info" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/account-security" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/notifications" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/privacy-policy" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="edit-profile" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="job/job" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="job/form" options={{ animation: "slide_from_right", presentation: "modal" }} />
          <Stack.Screen name="reports/details" options={{ animation: "slide_from_right", presentation: "modal" }} />
          <Stack.Screen name="reports/saved-reports" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/generate" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/preview" options={{ animation: "slide_from_right" }} />
        </Stack>
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SyncProvider>
            <RootLayoutNav />
          </SyncProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}