import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRootNavigationState, useRouter } from 'expo-router'; // <-- Added Root Nav State
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef } from 'react'; // <-- Added useRef
import {
    BackHandler,
    Image,
    ImageBackground,
    StatusBar,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScaleButton from '../components/ScaleButton';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isLoading, isOnboarded } = useAuth();
  
  const rootNavigationState = useRootNavigationState();
  const hasRouted = useRef(false); // <-- NEW: Prevents background routing race conditions

  useEffect(() => {
    // Wait for Expo Router to be fully mounted
    if (!rootNavigationState?.key) return;

    if (!isLoading && !hasRouted.current) {
        if (user) {
            if (isOnboarded) {
                 router.replace('/(tabs)/home');
            } else {
                 router.replace('/onboarding');
            }
        }
        // Mark as routed so it NEVER auto-routes from the background again
        hasRouted.current = true;
    }
  }, [user, isLoading, isOnboarded, rootNavigationState?.key]);

  useEffect(() => {
    const backAction = () => { BackHandler.exitApp(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  if (isLoading) return null;

  return (
    <ImageBackground 
        source={require('../assets/images/intro/bgimage.jpeg')} 
        className="flex-1" 
        blurRadius={4}
    >
      <View className={`absolute inset-0 ${isDark ? 'bg-slate-950/90' : 'bg-slate-50/90'}`} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <SafeAreaView className="flex-1 px-8">
        <View className="items-center justify-center flex-1 w-full">
            <View className="mb-8">
                <Text className={`text-3xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Welcome to
                </Text>
            </View>

            <View className="mb-8 shadow-2xl shadow-indigo-500/20">
                <Image 
                    source={isDark ? require('../assets/images/dart-logo-transparent-light.png') : require('../assets/images/dart-logo-transparent-dark.png')} 
                    style={{ width: 200, height: 140 }} 
                    resizeMode="contain" 
                />
            </View>

            <View className="mb-4">
                <Text className={`text-lg font-bold text-center uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    Daily Accomplishment Report Tools
                </Text>
            </View>

            <View className="px-4">
                <Text className={`text-base font-medium leading-7 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Streamline your workflow, track your daily progress, and generate comprehensive reports with ease.
                </Text>
            </View>
        </View>

        {/* ACTIONS */}
        <View className="w-full gap-4 pb-6">
            <View>
                <ScaleButton onPress={() => router.push('/auth?mode=signup')}>
                    <View className="flex-row items-center justify-center w-full gap-3 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                        <Text className="text-lg font-bold text-white">Get Started</Text>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="white" strokeWidth={2.5} />
                    </View>
                </ScaleButton>
            </View>

            <View>
                <ScaleButton onPress={() => router.push('/auth?mode=login')}>
                    <View className={`flex-row items-center justify-center w-full gap-3 border h-14 rounded-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>I have an account</Text>
                    </View>
                </ScaleButton>
            </View>

            <View className="items-center mt-2">
                <Text className={`text-xs font-semibold tracking-wider opacity-60 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Developed by Project Vdb
                </Text>
            </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}