// filepath: vncedb/dart/dart-8346f6d6d3ba6721214d0c5b9d4684d9a2a9874e/app/edit-profile.tsx
import {
    ArrowDown01Icon,
    InformationCircleIcon,
    UserIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Footer from '../components/Footer';
import Header from '../components/Header';
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import SearchableSelectionModal from '../components/SearchableSelectionModal';
import { PROFESSIONAL_SUFFIXES, PROFESSIONAL_TITLES } from '../constants/profile-options';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { saveProfileLocal } from '../lib/database';
import { getDB } from '../lib/db-client';

const Tooltip = ({ message, theme }: { message: string, theme: any }) => (
    <View style={{ position: 'absolute', right: 0, zIndex: 100, width: 220, marginTop: 8, top: '100%' }}>
        <View style={{ width: '100%' }}>
            <View style={{ position: 'absolute', right: 24, top: -6, width: 12, height: 12, backgroundColor: theme.colors.card, borderLeftWidth: 1, borderTopWidth: 1, borderColor: theme.colors.border, transform: [{ rotate: '45deg' }] }} />
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <HugeiconsIcon icon={InformationCircleIcon} size={16} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', marginBottom: 2, color: theme.colors.text }}>Attention Needed</Text>
                        <Text style={{ fontSize: 11, lineHeight: 15, fontFamily: 'Nunito_400Regular', color: theme.colors.textSecondary }}>{message}</Text>
                    </View>
                </View>
            </View>
        </View>
    </View>
);

const AuthInput = ({ label, value, onChange, placeholder, icon, required, errorKey, readonly, onPress, theme, errors, setErrors, visibleTooltip, setVisibleTooltip }: any) => {
    const isError = errorKey && errors[errorKey];
    const showTooltip = errorKey && visibleTooltip === errorKey;
    const hasValue = value && value.length > 0;
    
    return (
        <View style={{ marginBottom: 20, zIndex: showTooltip ? 50 : 1 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
                {label} {required && <Text style={{ color: '#ef4444' }}>*</Text>}
            </Text>
            <View style={{ position: 'relative' }}>
                <TouchableOpacity activeOpacity={readonly ? 0.7 : 1} onPress={onPress}>
                    <View style={{ 
                        flexDirection: 'row', alignItems: 'center', 
                        backgroundColor: theme.colors.card, 
                        borderRadius: 16, borderWidth: 1, 
                        borderColor: isError ? '#ef4444' : theme.colors.border,
                        height: 56, paddingHorizontal: 16 
                    }}>
                        {icon && <HugeiconsIcon icon={icon} size={22} color={isError ? "#ef4444" : (readonly && hasValue ? theme.colors.primary : theme.colors.textSecondary)} />}
                        
                        {readonly ? (
                            <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Nunito_500Medium', color: hasValue ? theme.colors.text : theme.colors.textSecondary }}>
                                {hasValue ? value : placeholder}
                            </Text>
                        ) : (
                            <TextInput 
                                value={value} 
                                onChangeText={(t) => { onChange(t); if(errorKey) { setErrors((prev:any) => ({...prev, [errorKey]: undefined})); setVisibleTooltip(null); }}} 
                                style={{ flex: 1, marginLeft: 12, padding: 0, fontSize: 15, fontFamily: 'Nunito_500Medium', color: theme.colors.text }} 
                                placeholder={placeholder} 
                                placeholderTextColor={theme.colors.textSecondary}
                                onFocus={() => setVisibleTooltip(null)}
                            />
                        )}
                        
                        {readonly && <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} />}
                        {isError && !readonly && (
                            <TouchableOpacity onPress={() => setVisibleTooltip(showTooltip ? null : errorKey)}>
                                <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
                {showTooltip && <Tooltip message={errors[errorKey] || ''} theme={theme} />}
            </View>
        </View>
    );
};

export default function EditProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user, refreshProfile } = useAuth();
  const { triggerSync } = useSync();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  const [profile, setProfile] = useState<any>({
      first_name: '',
      middle_name: '',
      last_name: '',
      title: '',
      professional_suffix: '',
      avatar_url: null,
      local_avatar_path: null
  });

  const [errors, setErrors] = useState<any>({});
  const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);
  
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [suffixModalVisible, setSuffixModalVisible] = useState(false);

  useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
      const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
      
      return () => {
          showSub.remove();
          hideSub.remove();
      };
  }, []);

  // Capture System back button safely
  useEffect(() => {
      const backAction = () => {
          if (router.canGoBack()) {
              router.back();
          } else {
              router.replace('/(tabs)/profile');
          }
          return true; // Prevents the app from closing
      };
      
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
  }, [router]);

  const loadProfile = useCallback(async () => {
      if (!user) return;
      try {
          const db = await getDB();
          const localProfile: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [user.id]);
          
          let currentProfile = localProfile || {};
          const meta = user.user_metadata || {};

          let fName = currentProfile.first_name || meta.given_name || '';
          let lName = currentProfile.last_name || meta.family_name || '';

          if (!fName && !lName) {
              const fullName = meta.full_name || meta.name || '';
              if (fullName) {
                  const nameParts = fullName.trim().split(' ');
                  fName = nameParts[0] || '';
                  lName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
              }
          }

          setProfile({
              ...currentProfile,
              first_name: fName,
              last_name: lName,
          });

      } catch (e) {
          console.error("Load Profile Error:", e);
      } finally {
          setLoading(false);
      }
  }, [user]);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const handleSave = async () => {
      Keyboard.dismiss();
      setVisibleTooltip(null);

      if (!profile.first_name || !profile.last_name) {
          setErrors({ 
              firstName: !profile.first_name ? "First name is required." : undefined,
              lastName: !profile.last_name ? "Last name is required." : undefined
          });
          setAlertConfig({ visible: true, type: 'warning', title: 'Missing Info', message: 'Please complete required fields.', onConfirm: () => setAlertConfig({ visible: false }) });
          return;
      }

      setSaving(true);
      try {
          const first = profile.first_name.trim();
          const middle = profile.middle_name ? `${profile.middle_name.trim()} ` : '';
          const last = profile.last_name.trim();
          const suffix = profile.professional_suffix ? `, ${profile.professional_suffix.trim()}` : '';
          const title = profile.title ? `${profile.title.trim()} ` : '';
          const generatedFullName = `${title}${first} ${middle}${last}${suffix}`;

          const updatedProfile = {
              ...profile,
              full_name: generatedFullName,
              updated_at: new Date().toISOString()
          };

          await saveProfileLocal(updatedProfile);
          await refreshProfile();
          triggerSync(); 

          if (router.canGoBack()) {
              router.back();
          } else {
              router.replace('/(tabs)/profile');
          }
      } catch (error: any) {
          setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: error.message || 'Could not update profile.', onConfirm: () => setAlertConfig({ visible: false }) });
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <LoadingOverlay visible={saving} message="Saving Profile..." />
        <ModernAlert {...alertConfig} />

        <SearchableSelectionModal visible={titleModalVisible} onClose={() => setTitleModalVisible(false)} onSelect={(val) => setProfile({...profile, title: val})} title="Select Title" options={PROFESSIONAL_TITLES} placeholder="Search title..." currentValue={profile.title} />
        <SearchableSelectionModal visible={suffixModalVisible} onClose={() => setSuffixModalVisible(false)} onSelect={(val) => setProfile({...profile, professional_suffix: val})} title="Select Suffix" options={PROFESSIONAL_SUFFIXES} placeholder="Search suffix..." currentValue={profile.professional_suffix} />

        <Header title="Edit Profile" />

        <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView 
                contentContainerStyle={{ 
                    padding: 24, 
                    paddingBottom: isKeyboardVisible ? 240 : 120 
                }} 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={true}
                onScrollBeginDrag={() => setVisibleTooltip(null)}
            >
                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Nunito_500Medium', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>Professional Details</Text>
                <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                    <AuthInput label="Title" value={profile.title} placeholder="Select Title" onPress={() => setTitleModalVisible(true)} readonly icon={UserIcon} theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                    <AuthInput label="Professional Suffix" value={profile.professional_suffix} placeholder="Select Suffix" onPress={() => setSuffixModalVisible(true)} readonly icon={UserIcon} theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                </View>

                <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Nunito_500Medium', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>Personal Information</Text>
                <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                    <AuthInput label="First Name" value={profile.first_name} placeholder="Enter your first name" onChange={(t: string) => setProfile({...profile, first_name: t})} required icon={UserIcon} errorKey="firstName" theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                    <AuthInput label="Middle Name" value={profile.middle_name} placeholder="Enter your middle name" onChange={(t: string) => setProfile({...profile, middle_name: t})} icon={UserIcon} theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                    <AuthInput label="Last Name" value={profile.last_name} placeholder="Enter your last name" onChange={(t: string) => setProfile({...profile, last_name: t})} required icon={UserIcon} errorKey="lastName" theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
        
        {!isKeyboardVisible && (
            <Footer>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, height: 56, borderRadius: 16, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Nunito_700Bold' }}>Save Changes</Text>
                </TouchableOpacity>
            </Footer>
        )}
    </SafeAreaView>
  );
}