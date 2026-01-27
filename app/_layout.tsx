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

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "shouldShowAlert is deprecated",
  "Warning: SafeAreaView",
]);

SplashScreen.preventAutoHideAsync();

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
  const { isLoading: isAuthLoading, user, isOnboarded } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  
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

  useEffect(() => {
    const prepareApp = async () => {
      try {
        await initDatabase();
        const storedSettings = await AsyncStorage.getItem("appSettings");
        let biometricEnabled = false;

        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          if (parsed.themePreference) {
             setColorScheme(parsed.themePreference === 'system' ? 'system' : parsed.themePreference);
          }
          biometricEnabled = !!parsed.biometricEnabled;
        }

        // BIOMETRIC CHECK: Only run if user is logged in
        if (biometricEnabled && user) {
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

    if (!isAuthLoading) {
        prepareApp();
    }
  }, [isAuthLoading, user]);

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

  useEffect(() => {
    if (!isAuthLoading && user?.id) {
       ReportService.checkAndGenerateAutoReports(user.id);
    }
  }, [isAuthLoading, user]);

  // --- NAVIGATION GUARD ---
  useEffect(() => {
    if (!fontsLoaded || isAuthLoading || !isAppReady || !biometricCheckComplete) {
      return;
    }

    const performNavigationAndHideSplash = async () => {
      const inAuthGroup = segments[0] === '(auth)';
      const isRoot = segments.length === 0;

      if (user) {
          // User is authenticated
          if (!isOnboarded) {
              // Redirect to Simplified Onboarding (app/onboarding.tsx)
              router.replace('/onboarding');
          } else {
              // User is onboarded -> Go Home
              // Only redirect if currently on Auth or Index screens
              if (isRoot || inAuthGroup) {
                  router.replace('/(tabs)/home');
              }
          }
      } 
      else {
          // User is NOT authenticated
          // If trying to access protected tabs, kick back to Index
          if (segments[0] === '(tabs)') {
              router.replace('/');
          }
      }

      await SplashScreen.hideAsync();
    };

    performNavigationAndHideSplash();
  }, [fontsLoaded, isAuthLoading, isAppReady, biometricCheckComplete, isOnboarded, user, segments]);


  // --- RENDER GUARD ---
  if (!fontsLoaded || isAuthLoading || !isAppReady || !biometricCheckComplete) {
    return null; 
  }

  // --- BIOMETRIC LOCK UI ---
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
          <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: "fade" }} />
          
          {/* Other settings & features */}
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
          
          {/* Screens removed from flow but kept for safety/references if files exist */}
          <Stack.Screen name="introduction" options={{ animation: "fade" }} />
          <Stack.Screen name="onboarding/welcome" options={{ animation: "fade" }} />
          <Stack.Screen name="onboarding/info" options={{ animation: "slide_from_right" }} />
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