// filepath: app/_layout.tsx
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import mobileAds from 'react-native-google-mobile-ads';
import { SafeAreaProvider } from "react-native-safe-area-context";

import BiometricLockScreen from "../components/BiometricLockScreen";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import "../global.css";
import { initDatabase, queueSyncItem } from "../lib/database";
import { getDB } from "../lib/db-client";
import { getSameDayClockOut } from "../lib/attendance-session";
import { supabase } from "../lib/supabase";
import { refreshWidgetSnapshot } from "../lib/widgets";
import {
  clearAttendanceNotification,
  syncPersistentNotification,
  verifyActiveShiftBeforeAction
} from "../utils/NotificationService";

// --- FIX FOR EXPO HEADLESS KEEP AWAKE ERROR IN DEV MODE ---
if (__DEV__) {
    const originalConsoleError = console.error;
    console.error = (...args) => {
        // Deeply check arguments (including Promise Rejection Error objects)
        const errorMsg = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
        if (errorMsg.includes('Unable to activate keep awake')) {
            return; // Silently ignore Expo DevTool's background keep-awake failure
        }
        originalConsoleError(...args);
    };
    LogBox.ignoreAllLogs(true);
}

// BACKGROUND EVENT HANDLER
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { pressAction } = detail;

    if (type === EventType.ACTION_PRESS && pressAction?.id) {
        if (pressAction.id === 'action_checkout') {
            try {
                // Fetch the current authenticated user inside the background task
                const { data } = await supabase.auth.getSession();
                const userId = data.session?.user?.id;

                if (userId) {
                    // 1. Verify if shift is actually active in the database
                    const isActive = await verifyActiveShiftBeforeAction(userId);
                    
                    // 2. If active, write the checkout to the database directly
                    if (isActive) {
                        const db = await getDB();
                        const activeShift: any = await db.getFirstAsync(
                            "SELECT * FROM attendance WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1",
                            [userId]
                        );

                        if (activeShift) {
                            const clockOutTime = getSameDayClockOut(activeShift.clock_in, new Date()).toISOString();
                            // FIX: Status must strictly be lowercase 'completed' to match cloud database schema
                            await db.runAsync(
                                "UPDATE attendance SET clock_out = ?, status = 'completed', updated_at = ?, is_synced = 0 WHERE id = ?",
                                [clockOutTime, clockOutTime, activeShift.id]
                            );
                            
                            // Queue for cloud sync when internet is available
                            await queueSyncItem('attendance', activeShift.id, 'UPDATE', { 
                                ...activeShift, 
                                clock_out: clockOutTime, 
                                status: 'completed',
                                updated_at: clockOutTime 
                            });
                            await refreshWidgetSnapshot(userId, { force: true });
                        }
                    }
                }
            } catch (error) {
                console.error("[BackgroundEvent] Error checking out:", error);
            } finally {
                // 3. Always clear the persistent notification on Time Out
                await clearAttendanceNotification();
            }
        }
    }
});

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading: loading } = useAuth();
  const [isBiometricLocked, setIsBiometricLocked] = useState(false);
  const user = session?.user;

  // Sync Notification with Actual Database State on Load
  useEffect(() => {
      if (user?.id) {
          syncPersistentNotification(user.id);
          refreshWidgetSnapshot(user.id, { force: true }).catch(() => {});
      } else if (!loading) {
          clearAttendanceNotification();
      }
  }, [user?.id, loading]);

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
          <Stack.Screen name="settings/manage-subscriptions" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/appearance" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/privacy-policy" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/about" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/apikey" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/feedback" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/widgets" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/docs/privacy-details" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="settings/docs/terms-of-service" options={{ animation: "slide_from_right" }} />
          
          <Stack.Screen name="search" options={{ animation: "fade_from_bottom" }} />
          <Stack.Screen name="edit-profile" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="job/job" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="job/form" options={{ animation: "slide_from_right" }} />
          
          <Stack.Screen name="reports/saved-reports" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/add-entry" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/generate" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/preview" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/details" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/analytics" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="reports/ai-summary" options={{ animation: "slide_from_right" }} />
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

  // Initialize the AdMob SDK
  useEffect(() => {
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('AdMob SDK Initialized!', adapterStatuses);
      });
  }, []);

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





