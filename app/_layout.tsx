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
import { Stack, useRouter, useSegments } from "expo-router";
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
import { initDatabase } from "../lib/database";
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
  const { isLoading: isAuthLoading, session, user, isOnboarded } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  
  // State to track if all async initializations are done
  const [isAppReady, setIsAppReady] = useState(false);
  const [isBiometricAuthorized, setIsBiometricAuthorized] = useState(false);
  const [biometricCheckComplete, setBiometricCheckComplete] = useState(false);
  
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  // --- 1. INITIALIZATION SEQUENCE (Theme, DB, Bio) ---
  useEffect(() => {
    const prepareApp = async () => {
      try {
        // A. Initialize Database
        await initDatabase();

        // B. Load Theme Preference (Matching settings.tsx logic)
        const storedSettings = await AsyncStorage.getItem("appSettings");
        let biometricEnabled = false;

        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          
          // Apply Theme immediately
          if (parsed.themePreference) {
             setColorScheme(parsed.themePreference === 'system' ? 'system' : parsed.themePreference);
          }
          
          biometricEnabled = !!parsed.biometricEnabled;
        }

        // C. Check Biometrics requirement
        if (biometricEnabled && session) {
            setIsBiometricAuthorized(false);
        } else {
            setIsBiometricAuthorized(true);
        }
        setBiometricCheckComplete(true);

      } catch (e) {
        console.warn("Initialization Error:", e);
        setIsBiometricAuthorized(true);
        setBiometricCheckComplete(true);
      } finally {
        setIsAppReady(true);
      }
    };

    prepareApp();
  }, [session]);

  // --- 2. NOTIFICATIONS SETUP ---
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
    };

    setupNotifications();

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      if (data && data.action === 'open_saved_reports') {
        router.push('/reports/saved-reports');
      }

      if (actionId === 'clock_out' || actionId === 'view_job' || data?.type === 'ongoing_job') {
        router.push('/(tabs)/home');
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  // --- 3. AUTO REPORTS ---
  useEffect(() => {
    if (!isAuthLoading && user?.id) {
       ReportService.checkAndGenerateAutoReports(user.id);
    }
  }, [isAuthLoading, user]);

  // --- 4. NAVIGATION & SPLASH SCREEN HANDLING ---
  useEffect(() => {
    // Wait until EVERYTHING is loaded
    if (!fontsLoaded || isAuthLoading || !isAppReady || !biometricCheckComplete) {
      return;
    }

    const performNavigationAndHideSplash = async () => {
      // Logic: If user is onboarded, FORCE redirect to Home
      // This logic runs once when the app is ready
      const inAuthGroup = segments[0] === '(auth)';
      const isRoot = segments.length === 0;

      if (isOnboarded) {
         if (isRoot || inAuthGroup) {
             router.replace('/(tabs)/home');
         }
      } else if (!isOnboarded && isRoot) {
         // Optional: Direct to onboarding if needed, otherwise Index handles it
         // router.replace('/onboarding/welcome');
      }

      // Hide Splash Screen only after decisions are made
      await SplashScreen.hideAsync();
    };

    performNavigationAndHideSplash();
  }, [fontsLoaded, isAuthLoading, isAppReady, biometricCheckComplete, isOnboarded]);


  // --- 5. RENDER GUARD ---
  // Return null keeps the native splash screen up and prevents "Blinking"
  if (!fontsLoaded || isAuthLoading || !isAppReady || !biometricCheckComplete) {
    return null; 
  }

  // --- 6. BIOMETRIC LOCK UI ---
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