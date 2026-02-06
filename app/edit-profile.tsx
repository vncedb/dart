// Footer Fixed to Bottom (Outside KAV)
import {
  ArrowDown01Icon,
  InformationCircleIcon,
  Tick01Icon,
  UserIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
import { useSync } from '../context/SyncContext';
import { queueSyncItem, saveProfileLocal } from '../lib/database';
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';

const Tooltip = ({ message, theme }: { message: string, theme: any }) => (
    <View style={{ position: 'absolute', right: 0, zIndex: 100, width: 220, marginTop: 8, top: '100%' }}>
        <View style={{ width: '100%' }}>
            <View style={{ position: 'absolute', right: 24, top: -6, width: 12, height: 12, backgroundColor: theme.colors.card, borderLeftWidth: 1, borderTopWidth: 1, borderColor: theme.colors.border, transform: [{ rotate: '45deg' }] }} />
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <HugeiconsIcon icon={InformationCircleIcon} size={16} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', marginBottom: 2, color: theme.colors.text }}>Attention Needed</Text>
                        <Text style={{ fontSize: 11, lineHeight: 15, color: theme.colors.textSecondary }}>{message}</Text>
                    </View>
                </View>
            </View>
        </View>
    </View>
);

export default function EditProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [suffixModalVisible, setSuffixModalVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  const [profile, setProfile] = useState({
    id: '', first_name: '', middle_name: '', last_name: '', title: '', professional_suffix: '', full_name: '', 
  });
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [visibleTooltip, setVisibleTooltip] = useState<'firstName' | 'lastName' | null>(null);

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const db = await getDB();
        let profileData: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [user.id]);
        if (!profileData) {
             const { data: remoteProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
             if (remoteProfile) { profileData = remoteProfile; await saveProfileLocal(remoteProfile); }
        }
        if (profileData) {
            setProfile({
                id: user.id, first_name: profileData.first_name || '', last_name: profileData.last_name || '', middle_name: profileData.middle_name || '', title: profileData.title || '', professional_suffix: profileData.professional_suffix || '', full_name: profileData.full_name || '', 
            });
        }
      } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const validate = () => {
      const newErrors: any = {};
      let isValid = true;
      if (!profile.first_name.trim()) { newErrors.firstName = "First Name is required."; isValid = false; }
      if (!profile.last_name.trim()) { newErrors.lastName = "Last Name is required."; isValid = false; }
      setErrors(newErrors);
      if (newErrors.firstName) setVisibleTooltip('firstName');
      else if (newErrors.lastName) setVisibleTooltip('lastName');
      return isValid;
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    setVisibleTooltip(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      const updates = {
        id: user.id, first_name: profile.first_name, middle_name: profile.middle_name, last_name: profile.last_name, title: profile.title, professional_suffix: profile.professional_suffix, full_name: `${profile.first_name} ${profile.last_name}`.trim(), updated_at: new Date().toISOString(),
      };
      await saveProfileLocal(updates);
      await queueSyncItem('profiles', user.id, 'UPDATE', updates);
      triggerSync();
      router.back();
    } catch (error: any) {
      setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: error.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any)=>({...p, visible: false})) });
      setSaving(false);
    } 
  };

  const AuthInput = ({ label, value, onChange, required, icon, errorKey }: any) => {
      const isError = errorKey && errors[errorKey as keyof typeof errors];
      const showTooltip = errorKey && visibleTooltip === errorKey;
      return (
        <View style={{ marginBottom: 20, zIndex: showTooltip ? 50 : 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{label} {required && <Text style={{ color: '#ef4444' }}>*</Text>}</Text>
            <View style={{ position: 'relative' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: isError ? '#ef4444' : theme.colors.border, height: 56, paddingHorizontal: 16 }}>
                    <HugeiconsIcon icon={icon} size={22} color={isError ? "#ef4444" : theme.colors.textSecondary} />
                    <TextInput value={value} onChangeText={(t) => { onChange(t); if(errorKey) { setErrors(prev => ({...prev, [errorKey]: undefined})); setVisibleTooltip(null); }}} style={{ flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: theme.colors.text }} placeholder={`Enter ${label}`} placeholderTextColor={theme.colors.textSecondary} onFocus={() => setVisibleTooltip(null)} />
                    {isError && (<TouchableOpacity onPress={() => setVisibleTooltip(showTooltip ? null : errorKey)}><HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" /></TouchableOpacity>)}
                </View>
                {showTooltip && <Tooltip message={errors[errorKey as keyof typeof errors] || ''} theme={theme} />}
            </View>
        </View>
      );
  };

  const AuthSelect = ({ label, value, onPress }: any) => (
      <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{label}</Text>
          <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: value ? theme.colors.text : theme.colors.textSecondary }}>{value || 'Select'}</Text>
              <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
      </View>
  );

  return (
    <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setVisibleTooltip(null); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={saving} message="Saving Profile..." />
            <SearchableSelectionModal visible={titleModalVisible} onClose={() => setTitleModalVisible(false)} title="Select Title" options={PROFESSIONAL_TITLES} onSelect={(val: string) => setProfile({...profile, title: val})} placeholder="Search titles..." theme={theme} currentValue={profile.title} />
            <SearchableSelectionModal visible={suffixModalVisible} onClose={() => setSuffixModalVisible(false)} title="Select Professional Suffix" options={PROFESSIONAL_SUFFIXES} onSelect={(val: string) => setProfile({...profile, professional_suffix: val})} placeholder="Search suffixes..." theme={theme} currentValue={profile.professional_suffix} />
            
            <Header title="Edit Profile" />

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
                <>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                        style={{ flex: 1 }}
                    >
                        <ScrollView 
                            contentContainerStyle={{ padding: 24, paddingBottom: 40 }} 
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1 }}><AuthSelect label="Title" value={profile.title} onPress={() => setTitleModalVisible(true)} /></View>
                                    <View style={{ flex: 1 }}><AuthSelect label="Suffix" value={profile.professional_suffix} onPress={() => setSuffixModalVisible(true)} /></View>
                                </View>
                                <AuthInput label="First Name" value={profile.first_name} onChange={(t: string) => setProfile({...profile, first_name: t})} required icon={UserIcon} errorKey="firstName" />
                                <AuthInput label="Middle Name" value={profile.middle_name} onChange={(t: string) => setProfile({...profile, middle_name: t})} icon={UserIcon} />
                                <AuthInput label="Last Name" value={profile.last_name} onChange={(t: string) => setProfile({...profile, last_name: t})} required icon={UserIcon} errorKey="lastName" />
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                    
                    <Footer>
                        <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, height: 56, borderRadius: 16, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}>
                            <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginRight: 8 }}>Save Changes</Text>
                            <HugeiconsIcon icon={Tick01Icon} size={20} color="white" strokeWidth={2.5} />
                        </TouchableOpacity>
                    </Footer>
                </>
            )}
        </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}