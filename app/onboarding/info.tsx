import {
  ArrowLeft02Icon,
  ArrowRight01Icon,
  Camera01Icon,
  Logout02Icon,
  PencilEdit02Icon,
  UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Footer from '../../components/Footer';
import InputModal from '../../components/InputModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import { ModernAlert } from '../../components/ModernUI'; // Ensuring we use the correct UI kit
import { useAuth } from '../../context/AuthContext';
import { saveProfileLocal } from '../../lib/database';
import { supabase } from '../../lib/supabase';

const shadowStyle = Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    android: { elevation: 2 }
});

const TIMEOUT_LIMIT = 30000; // 30 Seconds

const NameCard = ({ label, value, onPress, required, isDark, error }: any) => (
    <View className="mb-4">
        <Text className={`mb-2 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {label} {required && <Text className="text-red-500">*</Text>}
        </Text>
        <TouchableOpacity 
            onPress={onPress} 
            activeOpacity={0.7}
            style={[
                shadowStyle,
                { 
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    borderColor: error ? '#ef4444' : (isDark ? '#334155' : '#e2e8f0'),
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: 60
                }
            ]}
        >
            <Text 
                className={`text-lg font-semibold ${value ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-400'}`}
                numberOfLines={1}
            >
                {value || 'Not Set'}
            </Text>
            <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={isDark ? '#475569' : '#cbd5e1'} />
        </TouchableOpacity>
        {error && <Text className="mt-1 ml-1 text-xs text-red-500">{error}</Text>}
    </View>
);

export default function InfoScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { setIsOnboarded } = useAuth(); 

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  const [modalVisible, setModalVisible] = useState(false);
  const [activeField, setActiveField] = useState<'first' | 'middle' | 'last' | null>(null);

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
        quality: 0.5, // Reduced quality for faster upload
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

  // --- MAIN SETUP LOGIC WITH TIMEOUT ---
  const performSetup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found.");

      let finalAvatarUrl = avatarUrl;
      // Only upload if it's a local file
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

      // Critical Update - If this succeeds, we consider setup done
      const { error } = await supabase.from('profiles').update(profileData).eq('id', user.id);
      if (error) throw error;

      // Background tasks (Fire & Forget) - Don't await these to speed up UI
      Promise.all([saveProfileLocal(profileData), setIsOnboarded(true)])
        .catch(e => console.log('Background Sync Error', e));

      return true;
  };

  const handleNext = async () => {
      // 1. Validation
      const newErrors: typeof errors = {};
      let hasError = false;
      if (!firstName.trim()) { newErrors.firstName = "Required"; hasError = true; }
      if (!lastName.trim()) { newErrors.lastName = "Required"; hasError = true; }
      setErrors(newErrors);
      if (hasError) return;

      // 2. Connectivity Check
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
          setAlertConfig({ visible: true, type: 'warning', title: 'Offline', message: 'Internet connection is required.', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) });
          return;
      }

      setLoading(true);

      // 3. Race against Timeout
      try {
          // Create a timeout promise that rejects after 30s
          const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Timeout")), TIMEOUT_LIMIT)
          );

          // Race the actual setup against the timeout
          await Promise.race([performSetup(), timeoutPromise]);

          // If successful (and beat the timeout)
          router.replace('/(tabs)/home');

      } catch (error: any) {
          setLoading(false);
          
          if (error.message === "Timeout") {
              setAlertConfig({ 
                  visible: true, 
                  type: 'error', 
                  title: 'Connection Timeout', 
                  message: 'The setup is taking longer than expected (30s). Please check your internet connection and try again.', 
                  onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) 
              });
          } else {
              setAlertConfig({ 
                  visible: true, 
                  type: 'error', 
                  title: 'Setup Failed', 
                  message: error.message || "An unexpected error occurred.", 
                  onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) 
              });
          }
      }
  };

  // --- MODAL & LOGOUT HANDLERS ---
  const openModal = (field: 'first' | 'middle' | 'last') => {
      if (field === 'first') setErrors(prev => ({ ...prev, firstName: '' }));
      if (field === 'last') setErrors(prev => ({ ...prev, lastName: '' }));
      setActiveField(field);
      setModalVisible(true);
  };

  const getModalConfig = () => {
      switch (activeField) {
          case 'first': return { title: 'First Name', val: firstName, set: setFirstName, ph: 'e.g. John' };
          case 'middle': return { title: 'Middle Name', val: middleName, set: setMiddleName, ph: 'e.g. Doe (Optional)' };
          case 'last': return { title: 'Last Name', val: lastName, set: setLastName, ph: 'e.g. Smith' };
          default: return { title: '', val: '', set: () => {}, ph: '' };
      }
  };
  const { title, val, set, ph } = getModalConfig();

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
          <LoadingOverlay visible={loading} message="Finalizing setup..." />
          <ModernAlert {...alertConfig} />
          
          <InputModal 
            visible={modalVisible} 
            onClose={() => setModalVisible(false)} 
            title={title} 
            initialValue={val} 
            placeholder={ph} 
            onConfirm={(txt) => set(txt)} 
          />

          <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <TouchableOpacity 
                onPress={handleBack} 
                className="items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800"
              >
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={isDark ? '#e2e8f0' : '#475569'} />
              </TouchableOpacity>
              
              <Text className="text-lg font-bold text-slate-900 dark:text-white">Your Profile</Text>
              
              <TouchableOpacity 
                onPress={handleLogout} 
                className="items-center justify-center w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20"
              >
                  <HugeiconsIcon icon={Logout02Icon} size={20} color="#ef4444" />
              </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
                  <View className="items-center py-6">
                      <Pressable 
                        onPress={pickImage} 
                        onPressIn={() => { scale.value = withSpring(1.15); borderProgress.value = withTiming(1); }} 
                        onPressOut={() => { scale.value = withSpring(1); borderProgress.value = withTiming(0); }} 
                        className="relative mb-6"
                      >
                          <Animated.View style={[{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }, animatedImageStyle]}>
                              {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
                              ) : (
                                <HugeiconsIcon icon={UserCircleIcon} size={64} color={isDark ? "#475569" : "#cbd5e1"} />
                              )}
                          </Animated.View>
                          
                          <View 
                            style={[
                                { 
                                    position: 'absolute', 
                                    bottom: 0, 
                                    right: 0, 
                                    width: 38, 
                                    height: 38, 
                                    borderRadius: 19, 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    borderWidth: 3,
                                    backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                                    borderColor: isDark ? '#334155' : '#e2e8f0', 
                                }
                            ]}
                          >
                              <HugeiconsIcon 
                                icon={Camera01Icon} 
                                size={16} 
                                color={isDark ? '#f1f5f9' : '#0f172a'} 
                              />
                          </View>
                      </Pressable>
                      
                      <Text className="text-2xl font-bold text-slate-900 dark:text-white">Let&apos;s get to know you!</Text>
                      <Text className="mt-1 text-center text-slate-500 dark:text-slate-400">Please provide your details below.</Text>
                  </View>

                  <View className="mt-4">
                      <NameCard label="First Name" value={firstName} onPress={() => openModal('first')} required isDark={isDark} error={errors.firstName} />
                      <NameCard label="Middle Name" value={middleName} onPress={() => openModal('middle')} isDark={isDark} />
                      <NameCard label="Last Name" value={lastName} onPress={() => openModal('last')} required isDark={isDark} error={errors.lastName} />
                  </View>
              </ScrollView>
          </View>

          <Footer>
              <Button 
                title={loading ? "Setting up..." : "Complete Setup"}
                onPress={handleNext}
                disabled={loading}
                variant="primary"
                style={{ width: '100%' }}
                icon={!loading ? <HugeiconsIcon icon={ArrowRight01Icon} color="white" size={20} /> : undefined}
              />
          </Footer>
      </SafeAreaView>
  );
}