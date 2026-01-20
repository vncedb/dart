import { ArrowRight01Icon, Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function LandingScreen() {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { isLoading: isAuthLoading } = useAuth();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  // Track which button is loading: 'signup' | 'login' | null
  const [loadingBtn, setLoadingBtn] = useState<'signup' | 'login' | null>(null);

  // Reset loading state when we return to this screen
  useFocusEffect(
    useCallback(() => {
      setLoadingBtn(null);
    }, [])
  );
  
  const handleToggleTheme = async () => {
    toggleColorScheme();
    const newTheme = isDark ? 'light' : 'dark';
    await AsyncStorage.setItem('user-theme', newTheme);
  };

  const handleNav = (route: string, type: 'signup' | 'login') => {
      setLoadingBtn(type);
      // Small delay to allow the UI to update the spinner before freezing for navigation
      setTimeout(() => {
          router.push(route as any);
      }, 50);
  };

  if (isAuthLoading) return null;

  return (
    <ImageBackground 
      source={require('../assets/images/intro/bgimage.jpeg')} 
      className="flex-1"
      blurRadius={3}
    >
      <View className={`absolute inset-0 ${isDark ? 'bg-slate-900/80' : 'bg-slate-50/90'}`} />
      
      <StatusBar style={isDark ? "light" : "dark"} />
      
      <View 
        className="justify-between flex-1 px-6"
        style={{ 
            paddingTop: insets.top + 32, 
            paddingBottom: insets.bottom + 32 
        }}
      >
        
        {/* Top Bar: Theme Toggle */}
        <View className="flex-row justify-end">
            <TouchableOpacity 
                onPress={handleToggleTheme}
                className={`items-center justify-center w-12 h-12 border rounded-full ${isDark ? 'bg-white/10 border-white/20' : 'bg-slate-200/50 border-slate-300'}`}
            >
                <HugeiconsIcon 
                    icon={isDark ? Sun03Icon : Moon02Icon} 
                    size={24} 
                    color={isDark ? "white" : "#334155"} 
                />
            </TouchableOpacity>
        </View>

        {/* Center Content: Bigger Logo, No Box */}
        <View className="items-center">
            <View className="mb-6">
                <Image 
                    source={
                        isDark 
                        ? require('../assets/images/dart-logo-transparent-light.png') 
                        : require('../assets/images/dart-logo-transparent-dark.png')
                    }
                    style={{ width: 180, height: 180 }} 
                    resizeMode="contain" 
                />
            </View>
            <Text className={`text-lg font-medium text-center max-w-[90%] ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                Daily Accomplishment Report Tools
            </Text>
        </View>

        {/* Bottom Actions */}
        <View className="w-full gap-4 mb-4">
            {/* Get Started (Sign Up) */}
            <TouchableOpacity 
                onPress={() => handleNav('/auth?mode=signup', 'signup')}
                disabled={loadingBtn !== null}
                className="flex-row items-center justify-center w-full h-16 gap-2 bg-indigo-600 shadow-lg shadow-indigo-500/40 rounded-2xl"
            >
                {loadingBtn === 'signup' ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        <Text className="font-sans text-xl font-bold text-white">Get Started</Text>
                        <HugeiconsIcon icon={ArrowRight01Icon} color="white" size={24} strokeWidth={2.5} />
                    </>
                )}
            </TouchableOpacity>

            {/* I have an account (Login) */}
            <TouchableOpacity 
                onPress={() => handleNav('/auth?mode=login', 'login')}
                disabled={loadingBtn !== null}
                className={`flex-row items-center justify-center w-full h-16 border rounded-2xl ${isDark ? 'bg-white/10 border-white/20' : 'bg-white border-slate-300'}`}
            >
                {loadingBtn === 'login' ? (
                    <ActivityIndicator color={isDark ? "white" : "#334155"} />
                ) : (
                    <Text className={`font-sans text-lg font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>I have an account</Text>
                )}
            </TouchableOpacity>

            <Text className={`mt-4 text-xs font-medium text-center ${isDark ? 'text-slate-400 opacity-60' : 'text-slate-400'}`}>
                Developed by Project Vdb
            </Text>
        </View>

      </View>
    </ImageBackground>
  );
}