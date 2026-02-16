import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import * as Notifications from 'expo-notifications';
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BiometricLockScreen from "../components/BiometricLockScreen";
import LoadingScreen from "../components/LoadingScreen";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import "../global.css";
import { initDatabase } from "../lib/database";
// Import the unified notification initializer
import { initNotificationSystem } from "../utils/NotificationService";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "shouldShowAlert is deprecated",
]);

SplashScreen.preventAutoHideAsync();

// NOTE: Handler is now configured inside utils/NotificationService.ts

function RootLayoutNav() {
  const { isLoading: isAuthLoading, user, isOnboarded } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  const [isReady, setIsReady] = useState(false);
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const isInitialized = useRef(false);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  // 1. App Initialization (DB, Theme, Biometrics)
  useEffect(() => {
    if (isInitialized.current) return;
    
    async function prepare() {
      isInitialized.current = true;
      try {
        await initDatabase();
        
        // Initialize Notification Channels & Permissions
        await initNotificationSystem();

        const storedSettings = await AsyncStorage.getItem("appSettings");
        
        if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          if (parsed.themePreference) {
            if (parsed.themePreference !== 'system' || colorScheme !== 'system') {
               setColorScheme(parsed.themePreference === 'system' ? 'system' : parsed.themePreference);
            }
          }
          if (parsed.biometricEnabled) {
             setIsBiometricLocked(true); 
          }
        }
      } catch (e) {
        console.warn("Init Error:", e);
      } finally {
        setIsReady(true);
      }
    }
    prepare();
  }, []); 

  // 2. Notification Listeners
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      // Handle Taps on Content
      if (data?.action === 'open_saved_reports') {
          router.push('/reports/saved-reports');
      }
      if (data?.type === 'ongoing_job' || data?.type === 'timer_tick' || data?.type === 'status_change') {
          router.push('/(tabs)/home');
      }

      // Handle Action Buttons (Optional: Basic Navigation)
      if (actionId === 'action_checkout') {
          router.push('/(tabs)/home');
          // You could trigger a checkout modal here via query params or context
      }
    });

    return () => subscription.remove();
  }, []);

  // 3. Navigation Guard
  useEffect(() => {
    if (isAuthLoading || !isReady || !fontsLoaded || !rootNavigationState?.key) return;

    const currentSegments = segments as string[];
    const isRoot = currentSegments.length === 0;
    const inAuthGroup = currentSegments[0] === 'auth';
    const inTabsGroup = currentSegments[0] === '(tabs)';
    const inOnboarding = currentSegments[0] === 'onboarding';
    
    const isProtectedAuthRoute = currentSegments.join('/') === 'auth/update-password';

    const checkNavigation = async () => {
      if (user) {
        if (!isOnboarded) {
          if (!inOnboarding) router.replace('/onboarding');
        } else {
          if (isRoot || inOnboarding || (inAuthGroup && !isProtectedAuthRoute)) {
             router.replace('/(tabs)/home');
          }
        }
      } else {
        if (inTabsGroup || inOnboarding || isProtectedAuthRoute) {
           router.replace('/');
        }
      }
      await SplashScreen.hideAsync();
    };

    checkNavigation();
  }, [isReady, fontsLoaded, isAuthLoading, user, isOnboarded, segments, rootNavigationState?.key]);

  if (!isReady || !fontsLoaded || isAuthLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" options={{ gestureEnabled: false }} />
          <Stack.Screen name="auth" options={{ gestureEnabled: false }} />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          
          <Stack.Screen name="auth/update-password" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="auth/forgot-password" options={{ animation: "slide_from_right" }} />
          
          <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/account-security" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/notifications" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/appearance" options={{ animation: "slide_from_right",headerShown: false }} />
          <Stack.Screen name="settings/privacy-policy" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/about" options={{ animation: "slide_from_right" }} />
          
          <Stack.Screen name="edit-profile" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
          <Stack.Screen name="job/job" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="job/form" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
          
          <Stack.Screen name="reports/saved-reports" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/generate" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
          <Stack.Screen name="reports/preview" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/details" options={{ animation: "slide_from_bottom", presentation: "modal" }} />
        </Stack>

        {isBiometricLocked && user && (
          <View style={StyleSheet.absoluteFill} pointerEvents="auto">
             <BiometricLockScreen onUnlock={() => setIsBiometricLocked(false)} />
          </View>
        )}
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