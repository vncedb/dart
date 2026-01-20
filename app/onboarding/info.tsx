import {
    ArrowRight02Icon,
    Camera01Icon,
    UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import {
    Image,
    Pressable,
    ScrollView,
    Text,
    TextInput,
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

import Button from '../../components/Button'; // Assuming you have a generic Button component, if not use TouchableOpacity
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import { ModernAlert } from '../../components/ModernUI';
import { useAuth } from '../../context/AuthContext';
import { saveProfileLocal } from '../../lib/database';
import { supabase } from '../../lib/supabase';

// --- INPUT COMPONENT ---
const RenderInput = ({ label, value, onChangeText, placeholder, icon: Icon, maxLength, optional, error }: any) => {
  return (
      <View className="mb-5">
          <Text className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            {label} {!optional && <Text className="text-red-500">*</Text>}
          </Text>
          <View 
            className={`flex-row items-center w-full px-4 border rounded-2xl h-14 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 ${error ? 'border-red-500' : ''}`}
          >
              <View className="mr-3">
                <HugeiconsIcon icon={Icon} size={20} color={error ? "#ef4444" : "#64748b"} />
              </View>
              <TextInput 
                className="flex-1 h-full text-base font-medium text-slate-900 dark:text-white" 
                placeholder={placeholder} 
                placeholderTextColor="#94a3b8" 
                value={value} 
                onChangeText={onChangeText} 
                maxLength={maxLength} 
              />
          </View>
          {error && <Text className="mt-1 ml-1 text-xs text-red-500">{error}</Text>}
      </View>
  );
};

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

  const scale = useSharedValue(1);
  const borderProgress = useSharedValue(0); 

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
        quality: 0.5 
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
    } catch (error) {
        console.error("Avatar upload failed:", error);
        throw error;
    }
  };

  const handleNext = async () => {
      const newErrors: typeof errors = {};
      let hasError = false;
      if (!firstName.trim()) { newErrors.firstName = "Required"; hasError = true; }
      if (!lastName.trim()) { newErrors.lastName = "Required"; hasError = true; }
      
      setErrors(newErrors);
      if (hasError) return;

      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
          setAlertConfig({
              visible: true,
              type: 'warning',
              title: 'No Internet Connection',
              message: 'Internet connection is required to setup your profile.',
              confirmText: 'Okay',
              onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
          });
          return;
      }

      setLoading(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
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
              
              await saveProfileLocal(profileData);
              await setIsOnboarded(true); 
              router.replace('/(tabs)/home');
          }
      } catch (error: any) {
          setAlertConfig({ 
            visible: true, 
            type: 'error', 
            title: 'Setup Failed', 
            message: error.message || "Something went wrong.",
            confirmText: 'Try Again',
            onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})),
          });
      } finally {
          setLoading(false);
      }
  };

  return (
      <SafeAreaView style={{ flex: 1 }} className="bg-white dark:bg-slate-900" edges={['top', 'bottom']}>
          <LoadingOverlay visible={loading} message="Finalizing setup..." />
          <ModernAlert {...alertConfig} />

          {/* Header */}
          <Header 
            title="Your Profile" 
            onBack={() => router.back()} // Explicitly handle back navigation
          />

          <View style={{ flex: 1 }}>
              <ScrollView 
                style={{ flex: 1 }} 
                contentContainerStyle={{ padding: 24 }} 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
              >
                  {/* Avatar Section */}
                  <View className="items-center py-6">
                      <Pressable 
                        onPress={pickImage} 
                        onPressIn={() => { scale.value = withSpring(1.15); borderProgress.value = withTiming(1); }} 
                        onPressOut={() => { scale.value = withSpring(1); borderProgress.value = withTiming(0); }} 
                        className="relative mb-6"
                      >
                          <Animated.View style={[{ width: 110, height: 110, borderRadius: 55, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }, animatedImageStyle]}>
                              {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
                              ) : (
                                <HugeiconsIcon icon={UserCircleIcon} size={60} color={isDark ? "#475569" : "#cbd5e1"} />
                              )}
                          </Animated.View>
                          <View className="absolute bottom-0 right-0 p-2 bg-indigo-600 border-4 border-white rounded-full dark:border-slate-900">
                              <HugeiconsIcon icon={Camera01Icon} size={16} color="white" />
                          </View>
                      </Pressable>
                      <Text className="text-2xl font-bold text-slate-900 dark:text-white">Who are you?</Text>
                      <Text className="mt-1 text-center text-slate-500 dark:text-slate-400">
                        Let&apos;s get to know each other.
                      </Text>
                  </View>

                  {/* Form Section */}
                  <View className="gap-2 mt-4">
                      <RenderInput 
                        label="First Name" 
                        value={firstName} 
                        onChangeText={setFirstName} 
                        placeholder="e.g. John" 
                        icon={UserCircleIcon} 
                        maxLength={20} 
                        error={errors.firstName}
                      />
                      
                      <RenderInput 
                        label="Middle Name" 
                        value={middleName} 
                        onChangeText={setMiddleName} 
                        placeholder="e.g. Doe (Optional)" 
                        icon={UserCircleIcon} 
                        maxLength={20} 
                        optional={true} 
                      />
                      
                      <RenderInput 
                        label="Last Name" 
                        value={lastName} 
                        onChangeText={setLastName} 
                        placeholder="e.g. Smith" 
                        icon={UserCircleIcon} 
                        maxLength={20} 
                        error={errors.lastName}
                      />
                  </View>
              </ScrollView>
          </View>

          {/* Fixed Footer */}
          <Footer>
              <Button 
                title={loading ? "Setting up..." : "Complete Setup"}
                onPress={handleNext}
                disabled={loading}
                variant="primary"
                style={{ width: '100%' }}
                icon={!loading ? <HugeiconsIcon icon={ArrowRight02Icon} color="white" size={20} /> : undefined}
              />
          </Footer>
      </SafeAreaView>
  );
}