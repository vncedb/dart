import {
    ArrowDown01Icon,
    ArrowLeft02Icon,
    ArrowRight01Icon,
    Briefcase01Icon,
    Camera01Icon,
    InformationCircleIcon,
    UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import {
    Image,
    Keyboard,
    KeyboardAvoidingView,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// --- IMPORTS FROM YOUR PROJECT ---
import LoadingOverlay from '../../components/LoadingOverlay'; // Added Loading Overlay
import { ModernAlert } from '../../components/ModernUI'; // Added Modern Alert
import SearchableSelectionModal from '../../components/SearchableSelectionModal';
import { JOBS_LIST } from '../../constants/Jobs';
import { supabase } from '../../lib/supabase';

// --- INPUT COMPONENT ---
const RenderInput = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  errorField,
  icon: Icon,
  errors,
  clearAllErrors,
  maxLength
}: any) => {
  const errorMsg = errors[errorField];
  const hasError = !!errorMsg;

  return (
      <View className="relative z-10 mb-4">
          <Text className="mb-2 font-bold text-slate-700 dark:text-slate-300">
              {label} <Text className="text-red-500">*</Text>
          </Text>
          
          <View className={`flex-row items-center w-full px-4 border rounded-2xl transition-all ${
              hasError 
              ? 'border-red-500 bg-red-50 dark:bg-red-900/10' 
              : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
          }`}>
              <View className="mr-3">
                  <HugeiconsIcon icon={Icon} size={20} color={hasError ? "#ef4444" : "#64748b"} />
              </View>

              <TextInput
                  className={`flex-1 py-4 text-lg font-medium ${hasError ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-white'}`}
                  placeholder={placeholder}
                  placeholderTextColor={hasError ? "#fca5a5" : "#94a3b8"}
                  value={value}
                  onChangeText={onChangeText}
                  onFocus={clearAllErrors}
                  maxLength={maxLength}
              />

              {hasError && (
                  <HugeiconsIcon icon={InformationCircleIcon} size={20} color="#ef4444" variant="solid" />
              )}
          </View>
          
          {hasError && (
              <Text className="mt-1 ml-1 text-xs font-semibold text-red-500">{errorMsg}</Text>
          )}
      </View>
  );
};

// --- SELECT COMPONENT ---
const RenderSelect = ({ 
  label, 
  value, 
  onPress, 
  placeholder, 
  errorField, 
  icon: Icon, 
  errors 
}: any) => {
  const errorMsg = errors[errorField];
  const hasError = !!errorMsg;

  return (
      <View className="relative z-10 mb-4">
          <Text className="mb-2 font-bold text-slate-700 dark:text-slate-300">
              {label} <Text className="text-red-500">*</Text>
          </Text>
          
          <TouchableOpacity 
              onPress={onPress}
              activeOpacity={0.7}
              className={`flex-row items-center w-full px-4 border rounded-2xl h-[60px] ${
                  hasError 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10' 
                  : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
              }`}
          >
              <View className="mr-3">
                  <HugeiconsIcon icon={Icon} size={20} color={hasError ? "#ef4444" : "#64748b"} />
              </View>

              <Text className={`flex-1 text-lg font-medium ${value ? (hasError ? 'text-red-900' : 'text-slate-900 dark:text-white') : (hasError ? 'text-red-300' : 'text-slate-400')}`}>
                  {value || placeholder}
              </Text>

              <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={hasError ? "#ef4444" : "#94a3b8"} />
          </TouchableOpacity>

          {hasError && (
              <Text className="mt-1 ml-1 text-xs font-semibold text-red-500">{errorMsg}</Text>
          )}
      </View>
  );
};

export default function InfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; jobTitle?: string }>({});

  // Alert Config State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({ visible: false, type: 'info', title: '', message: '' });

  // --- ANIMATION VALUES ---
  const scale = useSharedValue(1);
  const borderProgress = useSharedValue(0); 

  const animatedImageStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      borderProgress.value,
      [0, 1],
      [isDark ? '#1e293b' : '#ffffff', '#6366f1'] 
    );

    return {
      transform: [{ scale: scale.value }],
      borderColor: borderColor,
      borderWidth: 4,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(1.15); 
    borderProgress.value = withTiming(1, { duration: 200 }); 
  };

  const handlePressOut = () => {
    scale.value = withSpring(1); 
    borderProgress.value = withTiming(0, { duration: 200 }); 
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
    });

    if (!result.canceled) {
        setAvatarUrl(result.assets[0].uri);
    }
  };

  // --- LOGIC: Upload Avatar to Supabase Storage ---
  const uploadAvatar = async (uri: string, userId: string) => {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        
        const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Assumes you have a 'avatars' bucket in Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, arrayBuffer, {
                contentType: blob.type || 'image/jpeg',
                upsert: true,
            });

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error("Avatar Upload Error:", error);
        throw new Error("Failed to upload profile picture.");
    }
  };

  const handleNext = async () => {
      // 1. Validation
      const newErrors: typeof errors = {};
      let hasError = false;

      if (!firstName.trim()) { newErrors.firstName = "First Name is required"; hasError = true; }
      if (!lastName.trim()) { newErrors.lastName = "Last Name is required"; hasError = true; }
      if (!jobTitle.trim()) { newErrors.jobTitle = "Job Title is required"; hasError = true; }

      setErrors(newErrors);
      if (hasError) return;

      setLoading(true);
      try {
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
              let remoteAvatarUrl = null;

              // 2. Upload Image if it's a local file
              if (avatarUrl && !avatarUrl.startsWith('http')) {
                  remoteAvatarUrl = await uploadAvatar(avatarUrl, user.id);
              }

              // 3. Update Profile
              const updates = {
                  first_name: firstName,
                  last_name: lastName,
                  job_title: jobTitle,
                  updated_at: new Date(),
                  ...(remoteAvatarUrl && { avatar_url: remoteAvatarUrl }), // Only update if new image
              };

              const { error } = await supabase
                  .from('profiles')
                  .update(updates)
                  .eq('id', user.id);
                
              if (error) throw error;
              
              router.push('/plan');
          } else {
              throw new Error("User session not found.");
          }

      } catch (error: any) {
          console.log(error);
          setAlertConfig({
            visible: true,
            type: 'error',
            title: 'Setup Failed',
            message: error.message || "We couldn't save your profile details."
          });
      } finally {
          setLoading(false);
      }
  };

  const clearAllErrors = () => setErrors({});

  return (
      <View style={{ flex: 1 }} className="bg-white dark:bg-slate-900">
          
          {/* --- UI ENHANCEMENT: Loading Overlay --- */}
          <LoadingOverlay visible={loading} message="Setting up your profile..." />

          {/* --- UI ENHANCEMENT: Modern Alert --- */}
          <ModernAlert 
            {...alertConfig}
            onDismiss={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
          />

          {/* 1. HEADER */}
          <View 
            style={{ paddingTop: insets.top + 10, paddingHorizontal: 24, paddingBottom: 10 }} 
            className="z-50 bg-white dark:bg-slate-900"
          >
              <TouchableOpacity 
                onPress={() => router.back()} 
                className="p-2 -ml-2 rounded-full active:bg-slate-100 dark:active:bg-slate-800"
              >
                  <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={isDark ? "#FFF" : "#0f172a"} />
              </TouchableOpacity>
          </View>

          {/* 2. MAIN CONTAINER */}
          <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
              style={{ flex: 1 }}
          >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={{ flex: 1 }}>
                      
                      {/* 3. SCROLLABLE CONTENT */}
                      <ScrollView 
                          style={{ flex: 1 }}
                          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} 
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                      >
                          <View className="items-center mt-2 mb-10">
                              {/* Animated Profile Picture */}
                              <Pressable 
                                  onPress={pickImage} 
                                  onPressIn={handlePressIn}
                                  onPressOut={handlePressOut}
                                  className="relative mb-6"
                              >
                                  <Animated.View 
                                    style={[
                                      { width: 100, height: 100, borderRadius: 50, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }, 
                                      animatedImageStyle,
                                      { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' } 
                                    ]}
                                  >
                                      {avatarUrl ? (
                                          <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
                                      ) : (
                                          <HugeiconsIcon icon={UserCircleIcon} size={50} color="#6366f1" />
                                      )}
                                  </Animated.View>

                                  <View className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 border-2 border-white rounded-full dark:border-slate-900 pointer-events-none">
                                      <HugeiconsIcon icon={Camera01Icon} size={14} color="white" />
                                  </View>
                              </Pressable>

                              <Text className="mb-2 text-3xl font-black text-center text-slate-900 dark:text-white">Tell us about you</Text>
                              <Text className="text-center text-slate-500 dark:text-slate-400">This helps us personalize your experience.</Text>
                          </View>

                          <View className="gap-2">
                              <RenderInput 
                                  label="First Name" 
                                  value={firstName} 
                                  onChangeText={setFirstName} 
                                  placeholder="First Name" 
                                  errorField="firstName" 
                                  icon={UserCircleIcon}
                                  errors={errors}
                                  clearAllErrors={clearAllErrors}
                                  maxLength={20}
                              />
                              <RenderInput 
                                  label="Last Name" 
                                  value={lastName} 
                                  onChangeText={setLastName} 
                                  placeholder="Last Name" 
                                  errorField="lastName" 
                                  icon={UserCircleIcon}
                                  errors={errors}
                                  clearAllErrors={clearAllErrors}
                                  maxLength={20}
                              />
                              
                              <RenderSelect 
                                  label="Job Title"
                                  value={jobTitle}
                                  onPress={() => {
                                      clearAllErrors();
                                      setModalVisible(true);
                                  }}
                                  placeholder="Select Job Title"
                                  errorField="jobTitle"
                                  icon={Briefcase01Icon}
                                  errors={errors}
                              />
                          </View>
                      </ScrollView>

                      {/* 4. FOOTER */}
                      <View 
                        className="bg-white border-t dark:bg-slate-900 border-slate-100 dark:border-slate-800"
                        style={{ 
                          paddingHorizontal: 24, 
                          paddingTop: 20,
                          paddingBottom: insets.bottom + 20, 
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: -4 },
                          shadowOpacity: 0.05,
                          shadowRadius: 10,
                          elevation: 10
                        }}
                      >
                          <TouchableOpacity 
                              onPress={handleNext}
                              disabled={loading}
                              className={`flex-row items-center justify-center w-full h-16 gap-2 rounded-2xl ${
                                  (loading) 
                                  ? 'bg-slate-300 dark:bg-slate-700' 
                                  : 'bg-indigo-600 shadow-lg shadow-indigo-500/30'
                              }`}
                          >
                              <Text className="font-sans text-xl font-bold text-white">
                                  {loading ? "Saving..." : "Next"}
                              </Text>
                              {!loading && <HugeiconsIcon icon={ArrowRight01Icon} color="white" size={24} strokeWidth={2.5} />}
                          </TouchableOpacity>
                      </View>
                  </View>
              </TouchableWithoutFeedback>
          </KeyboardAvoidingView>

          <SearchableSelectionModal
              visible={isModalVisible}
              onClose={() => setModalVisible(false)}
              title="Select Job Title"
              options={JOBS_LIST}
              onSelect={(val) => setJobTitle(val)}
              placeholder="Search job titles..."
          />

      </View>
  );
}