import { Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, useFonts } from '@expo-google-fonts/nunito';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { Animated, LogBox, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppSplash from '../components/AppSplash';
import BiometricLockScreen from '../components/BiometricLockScreen';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SyncProvider } from '../context/SyncContext'; // <--- IMPORTED SYNC PROVIDER
import '../global.css';

LogBox.ignoreLogs(['SafeAreaView has been deprecated', '[expo-av]']);
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(true); // Default to UNLOCKED (true)
  const [isAppReady, setIsAppReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { colorScheme, setColorScheme } = useColorScheme();
  
  // Ref to track if we've already checked biometrics during this session/launch
  const hasCheckedBio = useRef(false);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold,
  });

  // Theme Init
  useEffect(() => {
    AsyncStorage.getItem('user-theme').then(theme => {
      setColorScheme(theme === 'dark' ? 'dark' : 'light');
    });
  }, []);

  // Biometrics Logic
  const checkBioSettings = async () => {
    if (isAuthLoading) return; // Wait for auth to load
    
    // Only proceed if user is logged in
    if (session?.user) {
        try {
            const settingsJson = await AsyncStorage.getItem('appSettings');
            if (settingsJson) {
                const settings = JSON.parse(settingsJson);
                // STRICT CHECK: Only lock if explicitly true
                if (settings.biometricEnabled === true) {
                    setIsAuthorized(false); // Lock the app
                } else {
                    setIsAuthorized(true); // Ensure it's unlocked
                }
            } else {
                setIsAuthorized(true); // No settings found, default to unlocked
            }
        } catch (e) {
            console.log("Error reading biometric settings:", e);
            setIsAuthorized(true); // Fallback to unlocked on error
        }
    }
    hasCheckedBio.current = true;
  };

  // 1. Check on initial load (once fonts and auth are ready)
  useEffect(() => {
    if (!isAuthLoading && fontsLoaded && !hasCheckedBio.current) {
        checkBioSettings();
    }
  }, [isAuthLoading, fontsLoaded, session]);

  // Splash Screen Hide Logic
  useEffect(() => {
    if (fontsLoaded && !isAuthLoading) {
      setTimeout(() => {
        SplashScreen.hideAsync();
        Animated.timing(fadeAnim, { 
          toValue: 0, 
          duration: 500, 
          useNativeDriver: true 
        }).start(() => setIsAppReady(true));
      }, 500);
    }
  }, [fontsLoaded, isAuthLoading]);

  if (!fontsLoaded || isAuthLoading) return null;

  // Render Lock Screen if NOT authorized
  if (!isAuthorized) {
    return <BiometricLockScreen onUnlock={() => setIsAuthorized(true)} />;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="introduction" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="onboarding/welcome" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
          <Stack.Screen name="onboarding/info" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          {/* Settings Group */}
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/account-security" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings/privacy-policy" options={{ animation: 'slide_from_right' }} />
          {/* Job Group */}
          <Stack.Screen name="job/job" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="job/form" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          {/* Reports Group */}
          <Stack.Screen name="reports/details" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          <Stack.Screen name="reports/history" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="reports/print" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        </Stack>

        {!isAppReady && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 9999 }]} pointerEvents="none">
            <AppSplash />
          </Animated.View>
        )}
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider> 
          {/* SyncProvider must be INSIDE AuthProvider so it can access the 'user' object */}
          <RootLayoutNav />
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}