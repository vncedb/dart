import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import {
    BackHandler,
    Image,
    ImageBackground,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { guestLogin, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user && user.is_onboarded) {
      router.replace('/(tabs)/home');
    } else if (!isLoading && user && !user.is_onboarded) {
      router.replace('/introduction');
    }
  }, [user, isLoading]);

  useEffect(() => {
    const backAction = () => { BackHandler.exitApp(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  const handleGuest = async () => {
    await guestLogin();
  };

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
        {/* CENTER CONTENT */}
        <View className="items-center justify-center flex-1 w-full">
            
            {/* 1. Welcome Title */}
            <Animated.View entering={FadeIn.duration(800)} className="mb-8">
                <Text className={`text-5xl font-black text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Welcome
                </Text>
            </Animated.View>

            {/* 2. Logo */}
            <Animated.View entering={FadeIn.delay(200).duration(800)} className="mb-8 shadow-2xl shadow-indigo-500/20">
                <Image 
                    source={isDark ? require('../assets/images/icon-transparent-white.png') : require('../assets/images/icon-transparent.png')} 
                    style={{ width: 140, height: 140 }} 
                    resizeMode="contain" 
                />
            </Animated.View>

            {/* 3. App Name */}
            <Animated.View entering={FadeIn.delay(400).duration(800)} className="mb-4">
                <Text className={`text-lg font-black tracking-widest text-center uppercase ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    Daily Accomplishment Report Tools
                </Text>
            </Animated.View>

            {/* 4. Description */}
            <Animated.View entering={FadeIn.delay(600).duration(800)} className="px-4">
                <Text className={`text-base font-medium leading-7 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Streamline your workflow, track your daily progress, and generate comprehensive reports with ease.
                </Text>
            </Animated.View>

        </View>

        {/* BOTTOM SECTION */}
        <View className="w-full gap-4 pb-4">
            
            {/* Get Started Button */}
            <Animated.View entering={FadeIn.delay(800).duration(800)}>
                <TouchableOpacity 
                    onPress={() => router.push('/auth')}
                    className="flex-row items-center justify-center w-full h-16 gap-3 bg-indigo-600 shadow-xl shadow-indigo-500/30 rounded-2xl active:opacity-90"
                >
                    <Text className="text-xl font-bold tracking-wide text-white">Get Started</Text>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="white" strokeWidth={2.5} />
                </TouchableOpacity>
            </Animated.View>

            {/* Guest Button */}
            <Animated.View entering={FadeIn.delay(1000).duration(800)}>
                <TouchableOpacity 
                    onPress={handleGuest}
                    className={`flex-row items-center justify-center w-full h-16 gap-3 border rounded-2xl active:opacity-90 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
                >
                    <Text className={`text-lg font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Continue without Account</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Footer Credit */}
            <Animated.View entering={FadeIn.delay(1200).duration(800)} className="items-center mt-4">
                <Text className={`text-xs font-semibold tracking-wider uppercase opacity-60 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Developed by Project Vdb
                </Text>
            </Animated.View>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}