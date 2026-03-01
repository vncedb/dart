import { Mail01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
    BackHandler,
    Image,
    ImageBackground,
    StatusBar,
    Text,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import ScaleButton from '../components/ScaleButton';
import { useAuth } from '../context/AuthContext';
import { queueSyncItem, saveProfileLocal } from '../lib/database';
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';

GoogleSignin.configure({
    webClientId: '668715947282-h8h20h74tdtmj47efrkj9m7vjp8o39du.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
});

export default function Index() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isLoading, isOnboarded } = useAuth();

  const rootNavigationState = useRootNavigationState();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  useEffect(() => {
    if (!rootNavigationState?.key || isLoading) return;
    if (user) {
        router.replace(isOnboarded ? '/(tabs)/home' : '/onboarding');
    }
  }, [user, isLoading, isOnboarded, rootNavigationState?.key]);

  useEffect(() => {
    const backAction = () => { BackHandler.exitApp(); return true; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  const checkAppRegistration = async (authUser: any): Promise<boolean> => {
    try {
        const userId = authUser.id;
        const db = await getDB();
        const localProfile: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);

        if (localProfile) {
            const deviceOnboarded = await AsyncStorage.getItem('device_onboarded');
            return deviceOnboarded === 'true';
        }

        const { data: remoteProfile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

        if (remoteProfile && !error) {
            await saveProfileLocal(remoteProfile);
            const deviceOnboarded = await AsyncStorage.getItem('device_onboarded');
            return deviceOnboarded === 'true';
        }

        const meta = authUser.user_metadata || {};
        const avatarUrl = meta.avatar_url || meta.picture || meta.avatar || null;
        let fullName = meta.full_name || meta.name || '';
        const firstName = meta.given_name || meta.first_name || '';
        const lastName = meta.family_name || meta.last_name || '';

        if (!fullName && (firstName || lastName)) {
            fullName = `${firstName} ${lastName}`.trim();
        }

        const newProfile = {
            id: userId,
            email: authUser.email,
            full_name: fullName || (authUser.email ? authUser.email.split('@')[0] : 'User'),
            first_name: firstName,
            last_name: lastName,
            avatar_url: avatarUrl,
            is_onboarded: 0,
            updated_at: new Date().toISOString()
        };

        await saveProfileLocal(newProfile);
        await queueSyncItem('profiles', userId, 'UPSERT', { ...newProfile, is_onboarded: false });

        const deviceOnboarded = await AsyncStorage.getItem('device_onboarded');
        return deviceOnboarded === 'true';
    } catch (e) {
        console.log("Registration Check Error", e);
        return false;
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo?.data?.idToken || (userInfo as any)?.idToken;

        if (idToken) {
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: idToken,
            });

            if (error) throw error;

            if (data?.user) {
                const isDeviceOnboarded = await checkAppRegistration(data.user);
                setTimeout(() => {
                    setGoogleLoading(false);
                    setTimeout(() => {
                        if (isDeviceOnboarded) {
                            router.replace('/(tabs)/home');
                        } else {
                            router.replace({ pathname: '/onboarding', params: { welcome: 'true' } });
                        }
                    }, 500);
                }, 800);
                return;
            }
        } else {
            throw new Error('No ID token present in Google response.');
        }
    } catch (error: any) {
        if (error.code !== 'SIGN_IN_CANCELLED') {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Google Error',
                message: `Code: ${error.code}\nMessage: ${error.message}`,
                onDismiss: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        }
    } finally {
        setGoogleLoading(false);
    }
  };

  if (isLoading || user) return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc' }} />
  );

  return (
    <ImageBackground
        source={require('../assets/images/intro/bgimage.jpeg')}
        className="flex-1"
        blurRadius={4}
    >
      <View className={`absolute inset-0 ${isDark ? 'bg-slate-950/90' : 'bg-slate-50/90'}`} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={googleLoading} message="Connecting..." />

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
                <ScaleButton onPress={() => router.push('/auth')} disabled={googleLoading}>
                    <View className="flex-row items-center justify-center w-full gap-3 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                        <HugeiconsIcon icon={Mail01Icon} size={20} color="white" strokeWidth={2} />
                        <Text className="text-lg font-bold text-white">Continue with Email</Text>
                    </View>
                </ScaleButton>
            </View>

            <View>
                <ScaleButton onPress={handleGoogleLogin} disabled={googleLoading}>
                    <View className={`flex-row items-center justify-center w-full gap-3 border h-14 rounded-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Image source={require('../assets/images/google-logo.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
                        <Text className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>Continue with Google</Text>
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
