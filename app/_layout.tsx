import { Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, useFonts } from '@expo-google-fonts/nunito';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { Animated, LogBox, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppSplash from '../components/AppSplash';
import '../global.css';
import { supabase } from '../lib/supabase';

LogBox.ignoreLogs(['SafeAreaView has been deprecated', '[expo-av]', 'expo-notifications']);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);
  const { setColorScheme } = useColorScheme();
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const segments = useSegments();

  const [fontsLoaded] = useFonts({
    Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold,
  });

  // --- THEME INITIALIZATION ---
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('user-theme');
        if (savedTheme === 'dark') {
          setColorScheme('dark');
        } else {
          // Default to light if null or 'light'
          setColorScheme('light');
        }
      } catch (e) {
        setColorScheme('light');
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
           await supabase.auth.signOut();
           setSession(null);
        } else {
          setSession(data.session);
        }
      } catch (e) {
        setSession(null);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        router.replace('/'); 
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    SplashScreen.hideAsync();
    const timer = setTimeout(() => setIsReady(true), 2000);
    return () => clearTimeout(timer);
  }, [fontsLoaded]);

  useEffect(() => {
    if (!isReady) return;

    const currentRoute = segments[0]; 

    // Removed 'plan' from protected routes
    const protectedRoutes = ['(tabs)', 'settings', 'edit-profile', 'introduction', 'onboarding'];
    
    if (!session && protectedRoutes.includes(currentRoute)) {
       router.replace('/');
    } 
    else if (session && (currentRoute === 'login' || currentRoute === 'signup' || currentRoute === 'index')) {
       router.replace('/(tabs)/home');
    }
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => setAnimationFinished(true));

  }, [isReady, session, segments]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="recover-account" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="update-password" options={{ animation: 'slide_from_bottom' }} />
          
          <Stack.Screen name="introduction" options={{ animation: 'slide_from_right' }} />
          
          <Stack.Screen name="onboarding/welcome" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
          <Stack.Screen name="onboarding/info" options={{ animation: 'slide_from_right' }} />
          
          {/* REMOVED: Stack.Screen name="plan" */}

          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" options={{ presentation: 'card', animation: 'slide_from_right' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>

      {!animationFinished && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 9999 }]} pointerEvents="none">
          <AppSplash />
        </Animated.View>
      )}
    </View>
  );
}