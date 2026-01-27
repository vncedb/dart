import {
    ArrowLeft02Icon,
    ArrowRight01Icon,
    Camera01Icon,
    InformationCircleIcon,
    Logout02Icon,
    UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ModernAlert } from '../../components/ModernUI';
import { useAuth } from '../../context/AuthContext';
import { saveProfileLocal } from '../../lib/database';
import { supabase } from '../../lib/supabase';

const TIMEOUT_LIMIT = 30000; // 30 Seconds

// --- TOOLTIP COMPONENT ---
const AnimatedTooltip = ({ message, isDark }: { message: string, isDark: boolean }) => {
    const sv = useSharedValue(0);
    const translateY = useSharedValue(15);

    useEffect(() => {
        sv.value = withSpring(1);
        translateY.value = withSpring(0);
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: sv.value,
        transform: [{ translateY: translateY.value }]
    }));
  
    return (
      <Animated.View style={[style, { position: 'absolute', right: 0, top: '100%', marginTop: 8, zIndex: 50, width: 256 }]}>
        <TouchableWithoutFeedback>
          <View style={{ width: '100%' }}>
              <View style={{ position: 'absolute', right: 20, top: -8, width: 16, height: 16, transform: [{ rotate: '45deg' }], backgroundColor: isDark ? '#334155' : '#ffffff', borderLeftWidth: 1, borderTopWidth: 1, borderColor: isDark ? '#475569' : '#e2e8f0' }} />
              <View style={{ padding: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5, backgroundColor: isDark ? '#334155' : '#ffffff', borderWidth: 1, borderColor: isDark ? '#475569' : '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <View style={{ marginTop: 2 }}><HugeiconsIcon icon={InformationCircleIcon} size={18} color="#ef4444" /></View>
                      <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: isDark ? 'white' : '#0f172a' }}>Attention Needed</Text>
                          <Text style={{ fontSize: 12, lineHeight: 16, color: isDark ? '#cbd5e1' : '#64748b' }}>{message}</Text>
                      </View>
                  </View>
              </View>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    );
};

export default function InfoScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  // FIX: Use completeOnboarding from AuthContext (not setIsOnboarded)
  const { completeOnboarding } = useAuth(); 

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [visibleTooltip, setVisibleTooltip] = useState<'firstName' | 'lastName' | null>(null);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  // Animation Refs
  const scale = useSharedValue(1);
  const borderProgress = useSharedValue(0); 

  useEffect(() => {
    const backAction = () => {
      router.replace('/onboarding/welcome');
      return true; 
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.user_metadata) {
            const meta = user.user_metadata;
            if (!avatarUrl && (meta.avatar_url || meta.picture)) {
                setAvatarUrl(meta.avatar_url || meta.picture);
            }
            if (!firstName && !lastName) {
                if (meta.given_name) setFirstName(meta.given_name);
                if (meta.family_name) setLastName(meta.family_name);
                
                if ((!meta.given_name || !meta.family_name) && meta.full_name) {
                    const names = meta.full_name.trim().split(' ');
                    if (names.length === 1) setFirstName(names[0]);
                    else if (names.length === 2) { setFirstName(names[0]); setLastName(names[1]); }
                    else if (names.length > 2) {
                        setFirstName(names[0]);
                        setLastName(names[names.length - 1]);
                        setMiddleName(names.slice(1, -1).join(' '));
                    }
                }
            }
        }
    };
    loadUserData();
  }, []); 

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: interpolateColor(borderProgress.value, [0, 1], [isDark ? '#1e293b' : '#ffffff', '#6366f1']),
    borderWidth: 4,
  }));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ 
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true, 
        aspect: [1, 1], 
        quality: 0.5, 
    });
    if (!result.canceled) setAvatarUrl(result.assets[0].uri);
  };

  const uploadAvatar = async (uri: string, userId: string) => {
    if (uri.startsWith('http')) return uri;
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, arrayBuffer, { contentType: blob.type || 'image/jpeg', upsert: true });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) { throw error; }
  };

  const performSetup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found.");

      let finalAvatarUrl = avatarUrl;
      if (avatarUrl && !avatarUrl.startsWith('http')) {
          finalAvatarUrl = await uploadAvatar(avatarUrl, user.id);
      }

      const profileData = {
          id: user.id,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          full_name: `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim(),
          updated_at: new Date().toISOString(),
          avatar_url: finalAvatarUrl,
          is_onboarded: true, 
      };

      const { error } = await supabase.from('profiles').update(profileData).eq('id', user.id);
      if (error) throw error;

      // Save to local DB but DO NOT redirect yet
      await saveProfileLocal(profileData);
      
      return true;
  };

  const handleNext = async () => {
      Keyboard.dismiss();
      setVisibleTooltip(null);
      
      const newErrors: typeof errors = {};
      let hasError = false;
      if (!firstName.trim()) { newErrors.firstName = "First name is required."; hasError = true; }
      else if (!lastName.trim()) { newErrors.lastName = "Last name is required."; hasError = true; }
      
      setErrors(newErrors);
      
      if (hasError) {
          if (newErrors.firstName) setVisibleTooltip('firstName');
          else if (newErrors.lastName) setVisibleTooltip('lastName');
          return;
      }

      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
          setAlertConfig({ visible: true, type: 'warning', title: 'Offline', message: 'Internet connection is required.', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) });
          return;
      }

      setLoading(true);

      try {
          const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Timeout")), TIMEOUT_LIMIT)
          );

          // Wait for setup to finish
          await Promise.race([performSetup(), timeoutPromise]);
          
          // Use completeOnboarding to set flag and redirect to Home
          await completeOnboarding();

      } catch (error: any) {
          setLoading(false);
          if (error.message === "Timeout") {
              setAlertConfig({ visible: true, type: 'error', title: 'Connection Timeout', message: 'The setup is taking longer than expected. Please try again.', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
          } else {
              setAlertConfig({ visible: true, type: 'error', title: 'Setup Failed', message: error.message || "An unexpected error occurred.", onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
          }
      }
  };

  const handleBack = () => {
      router.replace('/onboarding/welcome');
  };

  const handleLogout = async () => {
      setAlertConfig({
          visible: true,
          type: 'warning',
          title: 'Sign Out',
          message: 'Are you sure you want to cancel setup and sign out?',
          confirmText: 'Sign Out',
          cancelText: 'Cancel',
          onConfirm: async () => {
              setAlertConfig((p: any) => ({ ...p, visible: false }));
              setLoading(true);
              await supabase.auth.signOut();
              router.replace('/auth');
          },
          onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false })),
          onDismiss: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
      });
  };

  return (
      <SafeAreaView style={{ flex: 1 }} className="bg-white dark:bg-slate-900" edges={['top', 'bottom']}>
          <ModernAlert {...alertConfig} />
          
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <TouchableOpacity onPress={handleBack} className="items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800">
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={isDark ? '#e2e8f0' : '#475569'} />
              </TouchableOpacity>
              <Text className="text-lg font-bold text-slate-900 dark:text-white">Your Profile</Text>
              <TouchableOpacity onPress={handleLogout} className="items-center justify-center w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20">
                  <HugeiconsIcon icon={Logout02Icon} size={20} color="#ef4444" />
              </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
              <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setVisibleTooltip(null); }}>
                  <View className="flex-1 px-8 pt-6">
                      
                      {/* Avatar Section */}
                      <Animated.View entering={FadeInUp.duration(600).springify()} className="items-center mb-8">
                          <Pressable 
                            onPress={pickImage} 
                            onPressIn={() => { scale.value = withSpring(1.15); borderProgress.value = withTiming(1); }} 
                            onPressOut={() => { scale.value = withSpring(1); borderProgress.value = withTiming(0); }} 
                            className="relative mb-4"
                          >
                              <Animated.View style={[{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }, animatedImageStyle]}>
                                  {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
                                  ) : (
                                    <HugeiconsIcon icon={UserCircleIcon} size={64} color={isDark ? "#475569" : "#cbd5e1"} />
                                  )}
                              </Animated.View>
                              <View className="absolute bottom-0 right-0 items-center justify-center w-10 h-10 bg-indigo-600 border-4 border-white rounded-full dark:border-slate-900">
                                  <HugeiconsIcon icon={Camera01Icon} size={16} color="white" />
                              </View>
                          </Pressable>
                          <Text className="text-2xl font-bold text-slate-900 dark:text-white">Let&apos;s get to know you!</Text>
                      </Animated.View>

                      {/* Inputs Matching Auth.tsx Style */}
                      <Animated.View entering={FadeInUp.delay(200).duration(600).springify()} className="gap-6">
                          
                          {/* First Name */}
                          <View className="relative z-50 w-full">
                              <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.firstName ? 'border-red-500' : ''}`}>
                                  <HugeiconsIcon icon={UserCircleIcon} color={errors.firstName ? "#ef4444" : "#94a3b8"} size={22} />
                                  <TextInput 
                                      placeholder="First Name" placeholderTextColor="#94a3b8" 
                                      className={`flex-1 h-full ml-3 font-sans font-medium ${errors.firstName ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
                                      value={firstName} 
                                      onFocus={() => setVisibleTooltip(null)}
                                      onChangeText={(t) => { setFirstName(t); setErrors((prev) => ({...prev, firstName: undefined})); setVisibleTooltip(null); }} 
                                  />
                                  {errors.firstName && (
                                      <TouchableOpacity onPress={() => setVisibleTooltip(visibleTooltip === 'firstName' ? null : 'firstName')}>
                                          <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                                      </TouchableOpacity>
                                  )}
                              </View>
                              {errors.firstName && visibleTooltip === 'firstName' && <AnimatedTooltip message={errors.firstName} isDark={isDark} />}
                          </View>

                          {/* Middle Name */}
                          <View className="relative z-40 w-full">
                              <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                  <HugeiconsIcon icon={UserCircleIcon} color="#94a3b8" size={22} />
                                  <TextInput 
                                      placeholder="Middle Name (Optional)" placeholderTextColor="#94a3b8" 
                                      className={`flex-1 h-full ml-3 font-sans font-medium ${isDark ? 'text-white' : 'text-slate-700'}`} 
                                      value={middleName} 
                                      onFocus={() => setVisibleTooltip(null)}
                                      onChangeText={setMiddleName} 
                                  />
                              </View>
                          </View>

                          {/* Last Name */}
                          <View className="relative z-30 w-full">
                              <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.lastName ? 'border-red-500' : ''}`}>
                                  <HugeiconsIcon icon={UserCircleIcon} color={errors.lastName ? "#ef4444" : "#94a3b8"} size={22} />
                                  <TextInput 
                                      placeholder="Last Name" placeholderTextColor="#94a3b8" 
                                      className={`flex-1 h-full ml-3 font-sans font-medium ${errors.lastName ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
                                      value={lastName} 
                                      onFocus={() => setVisibleTooltip(null)}
                                      onChangeText={(t) => { setLastName(t); setErrors((prev) => ({...prev, lastName: undefined})); setVisibleTooltip(null); }} 
                                  />
                                  {errors.lastName && (
                                      <TouchableOpacity onPress={() => setVisibleTooltip(visibleTooltip === 'lastName' ? null : 'lastName')}>
                                          <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                                      </TouchableOpacity>
                                  )}
                              </View>
                              {errors.lastName && visibleTooltip === 'lastName' && <AnimatedTooltip message={errors.lastName} isDark={isDark} />}
                          </View>

                      </Animated.View>

                      {/* Footer Button */}
                      <Animated.View entering={FadeInDown.delay(400).duration(600).springify()} className="pb-8 mt-auto">
                          <TouchableOpacity 
                              onPress={handleNext}
                              disabled={loading}
                              className={`w-full h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg ${loading ? 'bg-slate-300 dark:bg-slate-700' : 'bg-indigo-600 shadow-indigo-500/30'}`}
                          >
                              {loading ? (
                                  <ActivityIndicator color={isDark ? "#94a3b8" : "white"} />
                              ) : (
                                  <>
                                      <Text className="text-xl font-bold text-white">Complete Setup</Text>
                                      <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="white" strokeWidth={2.5} />
                                  </>
                              )}
                          </TouchableOpacity>
                      </Animated.View>

                  </View>
              </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
      </SafeAreaView>
  );
}