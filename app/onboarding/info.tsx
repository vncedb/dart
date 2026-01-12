import {
    ArrowRight02Icon,
    Briefcase01Icon,
    Camera01Icon,
    InformationCircleIcon,
    PlusSignIcon,
    Search01Icon,
    Tick02Icon,
    UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import { ModernAlert } from '../../components/ModernUI';
import { JOBS_LIST } from '../../constants/Jobs';
import { useAuth } from '../../context/AuthContext';
import { saveProfileLocal } from '../../lib/database';
import { supabase } from '../../lib/supabase';

// --- JOB TITLE MODAL ---
const JobTitleModal = ({ visible, onClose, onSelect, currentValue }: any) => {
  const [search, setSearch] = useState('');
  
  const filteredJobs = useMemo(() => {
      if (!search) return JOBS_LIST;
      return JOBS_LIST.filter(job => job.label.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  const exactMatch = filteredJobs.some(job => job.label.toLowerCase() === search.toLowerCase());

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <Text className="text-xl font-bold text-slate-900 dark:text-white">Select Job Title</Text>
              <TouchableOpacity onPress={onClose}><Text className="font-bold text-slate-400">Cancel</Text></TouchableOpacity>
          </View>

          <View className="px-6 py-4">
              <View className="flex-row items-center h-12 px-4 border bg-slate-50 dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700">
                  <HugeiconsIcon icon={Search01Icon} size={20} color="#94a3b8" />
                  <TextInput 
                      placeholder="Search or add title..." 
                      placeholderTextColor="#94a3b8"
                      value={search}
                      onChangeText={setSearch}
                      autoFocus
                      className="flex-1 ml-3 font-semibold text-slate-900 dark:text-white"
                  />
              </View>
          </View>

          <FlatList
              data={filteredJobs}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
              ListHeaderComponent={
                  (search.trim().length > 0 && !exactMatch) ? (
                      <TouchableOpacity 
                          onPress={() => { onSelect(search.trim()); onClose(); setSearch(''); }}
                          className="flex-row items-center gap-3 p-4 mb-2 border-b border-indigo-100 dark:border-indigo-900/30"
                      >
                          <View className="items-center justify-center w-8 h-8 bg-indigo-100 rounded-full dark:bg-indigo-900">
                              <HugeiconsIcon icon={PlusSignIcon} size={16} color="#6366f1" />
                          </View>
                          <View>
                              <Text className="font-bold text-indigo-600 dark:text-indigo-400">Add "{search}"</Text>
                              <Text className="text-xs text-slate-400">Use this as a custom title</Text>
                          </View>
                      </TouchableOpacity>
                  ) : null
              }
              renderItem={({ item }) => (
                  <TouchableOpacity 
                      onPress={() => { onSelect(item.value); onClose(); setSearch(''); }}
                      className="flex-row items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800"
                  >
                      <Text className={`text-base font-semibold ${item.value === currentValue ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {item.label}
                      </Text>
                      {item.value === currentValue && <View className="mr-2"><HugeiconsIcon icon={Tick02Icon} size={20} color="#6366f1" /></View>}
                  </TouchableOpacity>
              )}
          />
      </SafeAreaView>
    </Modal>
  );
};

// --- COMPONENTS ---
const RenderInput = ({ label, value, onChangeText, placeholder, errorField, icon: Icon, errors, clearAllErrors, maxLength, optional }: any) => {
  const errorMsg = errors[errorField];
  const hasError = !!errorMsg;
  return (
      <View className="relative z-10 mb-4">
          <Text className="mb-2 font-bold text-slate-700 dark:text-slate-300">
            {label} {!optional && <Text className="text-red-500">*</Text>}
          </Text>
          <View className={`flex-row items-center w-full px-4 border rounded-2xl transition-all ${hasError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
              <View className="mr-3"><HugeiconsIcon icon={Icon} size={20} color={hasError ? "#ef4444" : "#64748b"} /></View>
              <TextInput className={`flex-1 py-4 text-lg font-medium ${hasError ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-white'}`} placeholder={placeholder} placeholderTextColor={hasError ? "#fca5a5" : "#94a3b8"} value={value} onChangeText={onChangeText} onFocus={clearAllErrors} maxLength={maxLength} />
              {hasError && <HugeiconsIcon icon={InformationCircleIcon} size={20} color="#ef4444" variant="solid" />}
          </View>
          {hasError && <Text className="mt-1 ml-1 text-xs font-semibold text-red-500">{errorMsg}</Text>}
      </View>
  );
};

export default function InfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { setIsOnboarded } = useAuth(); 

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; jobTitle?: string }>({});
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  const scale = useSharedValue(1);
  const borderProgress = useSharedValue(0); 

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: interpolateColor(borderProgress.value, [0, 1], [isDark ? '#1e293b' : '#ffffff', '#6366f1']),
    borderWidth: 4,
  }));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (!result.canceled) setAvatarUrl(result.assets[0].uri);
  };

  const uploadAvatar = async (uri: string, userId: string) => {
    // Optimization: If it's already a remote URL, skip upload
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
        throw error; // Propagate error so handleNext catches it
    }
  };

  const handleNext = async () => {
      // 1. Validation
      const newErrors: typeof errors = {};
      let hasError = false;
      if (!firstName.trim()) { newErrors.firstName = "First Name is required"; hasError = true; }
      if (!lastName.trim()) { newErrors.lastName = "Last Name is required"; hasError = true; }
      
      setErrors(newErrors);
      if (hasError) return;

      // 2. CHECK INTERNET (Strict Requirement for Initial Setup)
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
          setAlertConfig({
              visible: true,
              type: 'warning',
              title: 'No Internet Connection',
              message: 'To complete your profile setup, an internet connection is required. Please check your connection and try again.',
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
                 // Trigger upload and let it throw if it fails
                 finalAvatarUrl = await uploadAvatar(avatarUrl, user.id);
              }

              const profileData = {
                  id: user.id,
                  first_name: firstName,
                  middle_name: middleName || null, 
                  last_name: lastName,
                  job_title: jobTitle,
                  full_name: `${firstName} ${middleName ? middleName + ' ' : ''}${lastName}`.trim(),
                  updated_at: new Date().toISOString(),
                  avatar_url: finalAvatarUrl,
                  is_onboarded: true, 
              };

              // 3. Update Supabase (Online)
              const { error } = await supabase.from('profiles').update(profileData).eq('id', user.id);
              if (error) throw error;

              // 4. Update Local DB (Offline Cache)
              await saveProfileLocal(profileData);
              
              // 5. Complete
              await setIsOnboarded(true); 
              router.replace('/(tabs)/home');
          }
      } catch (error: any) {
          setAlertConfig({ 
            visible: true, 
            type: 'error', 
            title: 'Setup Failed', 
            message: error.message || "Something went wrong. Please try again.",
            confirmText: 'Try Again',
            onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})),
          });
      } finally {
          setLoading(false);
      }
  };

  return (
      <View style={{ flex: 1 }} className="bg-white dark:bg-slate-900">
          <LoadingOverlay visible={loading} message="Setting up your profile..." />
          <ModernAlert {...alertConfig} />

          <Header title="Setup Your Profile" />

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={{ flex: 1 }}>
                      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                          <View className="items-center mt-2 mb-10">
                              <Pressable onPress={pickImage} onPressIn={() => { scale.value = withSpring(1.15); borderProgress.value = withTiming(1); }} onPressOut={() => { scale.value = withSpring(1); borderProgress.value = withTiming(0); }} className="relative mb-6">
                                  <Animated.View style={[{ width: 100, height: 100, borderRadius: 50, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }, animatedImageStyle]}>
                                      {avatarUrl ? <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" /> : <HugeiconsIcon icon={UserCircleIcon} size={50} color="#6366f1" />}
                                  </Animated.View>
                                  <View className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 border-2 border-white rounded-full dark:border-slate-900 pointer-events-none"><HugeiconsIcon icon={Camera01Icon} size={14} color="white" /></View>
                              </Pressable>
                              <Text className="mb-2 text-3xl font-black text-center text-slate-900 dark:text-white">Tell us about you</Text>
                              <Text className="text-center text-slate-500 dark:text-slate-400">This helps us personalize your experience.</Text>
                          </View>

                          <View className="gap-2">
                              <RenderInput label="First Name" value={firstName} onChangeText={setFirstName} placeholder="First Name" errorField="firstName" icon={UserCircleIcon} errors={errors} clearAllErrors={() => setErrors({})} maxLength={20} />
                              
                              <RenderInput label="Middle Name" value={middleName} onChangeText={setMiddleName} placeholder="Middle Name (Optional)" errorField="middleName" icon={UserCircleIcon} errors={errors} clearAllErrors={() => setErrors({})} maxLength={20} optional={true} />
                              
                              <RenderInput label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Last Name" errorField="lastName" icon={UserCircleIcon} errors={errors} clearAllErrors={() => setErrors({})} maxLength={20} />
                              
                              <View className="relative z-10 mb-4">
                                <Text className="mb-2 font-bold text-slate-700 dark:text-slate-300">Job Position</Text>
                                <TouchableOpacity 
                                    onPress={() => {
                                        if(!jobTitle) {
                                            router.push('/job/form'); 
                                        } else {
                                            setModalVisible(true);
                                        }
                                    }}
                                    className="flex-row items-center justify-between w-full px-4 py-4 border border-indigo-100 bg-indigo-50 rounded-2xl dark:bg-indigo-900/20 dark:border-indigo-800"
                                >
                                    <View className="flex-row items-center gap-3">
                                        <HugeiconsIcon icon={Briefcase01Icon} size={22} color="#6366f1" />
                                        <Text className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">
                                            {jobTitle || "Setup Job Position"}
                                        </Text>
                                    </View>
                                    {!jobTitle && <HugeiconsIcon icon={ArrowRight02Icon} size={20} color="#6366f1" />}
                                </TouchableOpacity>
                                {jobTitle ? <Text className="mt-2 text-xs text-center text-slate-400">Tap to change job title</Text> : null}
                              </View>

                          </View>
                      </ScrollView>

                      <View className="bg-white border-t dark:bg-slate-900 border-slate-100 dark:border-slate-800" style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: insets.bottom + 20, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 }}>
                          <TouchableOpacity onPress={handleNext} disabled={loading} className={`flex-row items-center justify-center w-full h-16 gap-2 rounded-2xl ${loading ? 'bg-slate-300 dark:bg-slate-700' : 'bg-indigo-600 shadow-lg shadow-indigo-500/30'}`}>
                              <Text className="font-sans text-xl font-bold text-white">{loading ? "Setting up..." : "Complete Setup"}</Text>
                              {!loading && <HugeiconsIcon icon={ArrowRight02Icon} color="white" size={24} strokeWidth={2.5} />}
                          </TouchableOpacity>
                      </View>
                  </View>
              </TouchableWithoutFeedback>
          </KeyboardAvoidingView>

          <JobTitleModal visible={isModalVisible} onClose={() => setModalVisible(false)} currentValue={jobTitle} onSelect={(val: string) => setJobTitle(val)} />
      </View>
  );
}