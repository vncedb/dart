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
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BiometricLockScreen from "../components/BiometricLockScreen";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { SyncProvider } from "../context/SyncContext";
import "../global.css";

// Ignore logs
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "shouldShowAlert is deprecated",
  "Warning: SafeAreaView",
]);

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isLoading: isAuthLoading, session } = useAuth();
  const { colorScheme, setColorScheme } = useColorScheme();
  
  const [isBiometricAuthorized, setIsBiometricAuthorized] = useState(false);
  const [isBiometricCheckDone, setIsBiometricCheckDone] = useState(false);
  const [isReady, setIsReady] = useState(false);

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
  }, []);

  // 2. Check Biometrics
  useEffect(() => {
    const checkBio = async () => {
      try {
        const settingsJson = await AsyncStorage.getItem("appSettings");
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          // Only enforce biometrics if enabled AND user is logged in
          if (settings.biometricEnabled === true && session) {
            setIsBiometricAuthorized(false);
          } else {
            setIsBiometricAuthorized(true);
          }
        } else {
          setIsBiometricAuthorized(true);
        }
      } catch (e) {
        setIsBiometricAuthorized(true);
      } finally {
        setIsBiometricCheckDone(true);
      }
    };

    if (!isAuthLoading) {
        checkBio();
    }
  }, [isAuthLoading, session]);

  // 3. Determine Readiness & Hide Splash
  useEffect(() => {
    if (fontsLoaded && !isAuthLoading && isBiometricCheckDone) {
        setIsReady(true);
        SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isAuthLoading, isBiometricCheckDone]);

  // RENDER BLOCKS
  
  // A. Still Loading -> Return null to keep Native Splash visible
  if (!isReady) {
    return null; 
  }

  // B. Biometric Lock -> Show Lock Screen if needed
  if (!isBiometricAuthorized) {
    return (
      <BiometricLockScreen 
        onUnlock={() => setIsBiometricAuthorized(true)} 
      />
    );
  }

  // C. Main App Content
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          {/* Public / Auth */}
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          
          {/* Onboarding */}
          <Stack.Screen name="introduction" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="onboarding/welcome" options={{ animation: "slide_from_right", gestureEnabled: false }} />
          <Stack.Screen name="onboarding/info" options={{ animation: "slide_from_right" }} />

          {/* Main App */}
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />

          {/* Modals & Sub-screens */}
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