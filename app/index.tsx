import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
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
  const { colorScheme } = useColorScheme();
  const { isLoading: isAuthLoading } = useAuth();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  // Track specific button loading state
  const [loadingBtn, setLoadingBtn] = useState<'guest' | 'login' | 'signup' | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoadingBtn(null);
    }, [])
  );
  
  const handleGuest = () => {
      setLoadingBtn('guest');
      setTimeout(() => {
          router.push('/onboarding/welcome');
      }, 50);
  };

  const handleAuth = (type: 'login' | 'signup') => {
      setLoadingBtn(type);
      setTimeout(() => {
          router.push(`/auth?mode=${type}`);
      }, 50);
  };

  if (isAuthLoading) return null;

  return (
    <ImageBackground 
      source={require('../assets/images/intro/bgimage.jpeg')} 
      className="flex-1"
      blurRadius={3}
    >
      <View className={`absolute inset-0 ${isDark ? 'bg-slate-900/85' : 'bg-slate-50/90'}`} />
      
      <StatusBar style={isDark ? "light" : "dark"} />
      
      <View 
        className="justify-between flex-1 px-6"
        style={{ 
            paddingTop: insets.top + 24, 
            paddingBottom: insets.bottom + 20 
        }}
      >
        
        {/* Top Spacer to push content down since we removed the toggle */}
        <View className="h-10" />

        {/* Center Content */}
        <View className="items-center -mt-10">
            <View className="mb-6 shadow-2xl shadow-indigo-500/20">
                <Image 
                    source={
                        isDark 
                        ? require('../assets/images/dart-logo-transparent-light.png') 
                        : require('../assets/images/dart-logo-transparent-dark.png')
                    }
                    style={{ width: 160, height: 160 }} 
                    resizeMode="contain" 
                />
            </View>
            <Text className={`text-xl font-bold text-center tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Welcome to DART
            </Text>
            <Text className={`text-base font-medium text-center max-w-[85%] leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Daily Accomplishment Report Tools.
                Manage your work, offline and secure.
            </Text>
        </View>

        {/* Bottom Actions */}
        <View className="w-full gap-3">
            
            {/* Primary: Continue as Guest */}
            <TouchableOpacity 
                onPress={handleGuest}
                disabled={loadingBtn !== null}
                className="flex-row items-center justify-center w-full gap-3 bg-indigo-600 shadow-lg h-14 shadow-indigo-500/30 rounded-xl"
            >
                {loadingBtn === 'guest' ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        <Text className="font-sans text-lg font-bold text-white">Continue as Guest</Text>
                        <HugeiconsIcon icon={ArrowRight01Icon} color="white" size={20} strokeWidth={2.5} />
                    </>
                )}
            </TouchableOpacity>

            <View className="flex-row items-center justify-center gap-4 my-2">
                <View className={`h-[1px] flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
                <Text className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>OR</Text>
                <View className={`h-[1px] flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
            </View>

            {/* Secondary: Sign In & Sign Up */}
            <View className="flex-row gap-3">
                <TouchableOpacity 
                    onPress={() => handleAuth('login')}
                    disabled={loadingBtn !== null}
                    className={`flex-1 flex-row items-center justify-center h-14 border rounded-xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
                >
                    {loadingBtn === 'login' ? (
                        <ActivityIndicator color={isDark ? "white" : "#334155"} />
                    ) : (
                        <Text className={`font-sans text-base font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>Sign In</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => handleAuth('signup')}
                    disabled={loadingBtn !== null}
                    className={`flex-1 flex-row items-center justify-center h-14 border rounded-xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}
                >
                    {loadingBtn === 'signup' ? (
                        <ActivityIndicator color={isDark ? "white" : "#334155"} />
                    ) : (
                        <Text className={`font-sans text-base font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>Create Account</Text>
                    )}
                </TouchableOpacity>
            </View>

            <Text className={`mt-4 text-[10px] font-medium text-center uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                © Project Vdb
            </Text>
        </View>

      </View>
    </ImageBackground>
  );
}