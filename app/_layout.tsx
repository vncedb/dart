import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts
} from "@expo-google-fonts/nunito";
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // <-- ADDED IMPORT
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BiometricLockScreen from "../components/BiometricLockScreen";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import "../global.css";
import { initDatabase } from "../lib/database";

notifee.registerForegroundService((notification) => {
    return new Promise(() => {
        // Keeps the service alive
        // Android will automatically stop it when we call notifee.stopForegroundService()
    });
});

if (__DEV__) LogBox.ignoreAllLogs(true);

// =====================================================================
// 🔴 NOTIFEE BACKGROUND EVENT LISTENER 
// Handles button taps when the app is swiped away/killed
// =====================================================================
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { notification, pressAction } = detail;

    if (type === EventType.ACTION_PRESS && pressAction?.id) {
        if (pressAction.id === 'action_checkout') {
            await notifee.cancelNotification('attendance_persistent');
        }
    }
});

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading: loading } = useAuth();
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const user = session?.user;

  // <-- FIXED: NOW CHECKS ASYNC STORAGE BEFORE LOCKING
  useEffect(() => {
    const checkBiometricSettings = async () => {
      if (!loading && user) {
        try {
          const settings = await AsyncStorage.getItem('appSettings');
          if (settings) {
            const parsed = JSON.parse(settings);
            if (parsed.biometricEnabled) {
              setIsBiometricLocked(true);
              return;
            }
          }
        } catch (e) {
          console.log('Error reading biometric settings', e);
        }
      }
      setIsBiometricLocked(false);
    };

    checkBiometricSettings();
  }, [loading, user]);

  return (
    <ThemeProvider value={DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
          <Stack.Screen name="auth/forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="auth/update-password" options={{ headerShown: false }} />
          
          <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/account-security" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/notifications" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/appearance" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/privacy-policy" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/about" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/feedback" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/docs/privacy-details" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/docs/terms-of-service" options={{ animation: "slide_from_right" }} />
          
          <Stack.Screen name="edit-profile" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="job/job" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="job/form" options={{ animation: "slide_from_right" }} />
          
          <Stack.Screen name="reports/saved-reports" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/add-entry" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/generate" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/preview" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/details" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/edit" options={{ animation: "slide_from_right" }} />
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
  const [dbInitialized, setDbInitialized] = useState(false);
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    const setupApp = async () => {
      try {
        await initDatabase();
      } catch (e) {
        console.error("Database initialization failed", e);
      } finally {
        setDbInitialized(true);
      }
    };
    setupApp();
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbInitialized) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbInitialized]);

  if (!fontsLoaded || !dbInitialized) return null; 

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