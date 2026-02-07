// Fixed Navigation Guard to allow 'update-password' for logged-in users
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
import { LogBox, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BiometricLockScreen from "../components/BiometricLockScreen";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import "../global.css";
import { initDatabase } from "../lib/database";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "shouldShowAlert is deprecated",
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

  // 1. Initialization
  useEffect(() => {
    if (isInitialized.current) return;
    
    async function prepare() {
      isInitialized.current = true;
      try {
        await initDatabase();
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

  // 2. Notifications
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.action === 'open_saved_reports') router.push('/reports/saved-reports');
      if (data?.type === 'ongoing_job') router.push('/(tabs)/home');
    });

    return () => subscription.remove();
  }, []);

  // 3. Navigation Guard
  useEffect(() => {
    if (!rootNavigationState?.key || !isReady || !fontsLoaded || isAuthLoading) return;

    const currentSegments = segments as string[];
    const isRoot = currentSegments.length === 0;
    
    // Define Route Groups
    const inAuthGroup = currentSegments[0] === 'auth';
    const inTabsGroup = currentSegments[0] === '(tabs)';
    const inOnboarding = currentSegments[0] === 'onboarding';
    
    // Exception: Allow logged-in users to access these specific auth screens
    const isProtectedAuthRoute = 
        currentSegments.join('/') === 'auth/update-password';

    const checkNavigation = async () => {
      if (user) {
        // --- LOGGED IN ---
        if (!isOnboarded) {
          // Force Onboarding
          if (!inOnboarding) router.replace('/onboarding');
        } else {
          // Authenticated & Onboarded
          // Redirect to Home IF trying to access Guest pages (Index, Login, Signup)
          // BUT allow if they are on a 'Protected' auth route like Change Password
          if (isRoot || inOnboarding || (inAuthGroup && !isProtectedAuthRoute)) {
             router.replace('/(tabs)/home');
          }
        }
      } else {
        // --- GUEST ---
        // Redirect to Index if trying to access Protected pages
        if (inTabsGroup || inOnboarding || isProtectedAuthRoute) {
           router.replace('/');
        }
      }
      
      await SplashScreen.hideAsync();
    };

    checkNavigation();
  }, [isReady, fontsLoaded, isAuthLoading, user, isOnboarded, segments, rootNavigationState?.key]);

  if (!isReady || !fontsLoaded || isAuthLoading) {
    return null; 
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="auth/update-password" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="auth/forgot-password" options={{ animation: "slide_from_right" }} />
          
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          
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