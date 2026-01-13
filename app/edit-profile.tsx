import {
  ArrowDown01Icon,
  CheckmarkCircle02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    id: '', 
    first_name: '', 
    middle_name: '', 
    last_name: '', 
    title: '', 
    professional_suffix: '', 
    full_name: '', 
  });
  
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
             if (remoteProfile) {
                 profileData = remoteProfile;
                 await saveProfileLocal(remoteProfile); 
             }
        }
        
        if (profileData) {
            setProfile({
                id: user.id, 
                first_name: profileData.first_name || '',
                last_name: profileData.last_name || '',
                middle_name: profileData.middle_name || '',
                title: profileData.title || '',
                professional_suffix: profileData.professional_suffix || '', 
                full_name: profileData.full_name || '', 
            });
        }
      } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!profile.first_name.trim() || !profile.last_name.trim()) {
      setAlertConfig({ visible: true, type: 'error', title: 'Missing Info', message: 'First and Last Name are required.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any)=>({...p, visible: false})) });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const updates = {
        id: user.id,
        first_name: profile.first_name, 
        middle_name: profile.middle_name,
        last_name: profile.last_name,
        title: profile.title, 
        professional_suffix: profile.professional_suffix,
        full_name: `${profile.first_name} ${profile.last_name}`.trim(),
        updated_at: new Date().toISOString(),
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

  const InputGroup = ({ label, value, onChange, required, theme }: any) => (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>{label} {required && <Text style={{ color: theme.colors.danger }}>*</Text>}</Text>
      <TextInput value={value} onChangeText={onChange} style={{ padding: 16, fontSize: 16, fontWeight: 'bold', backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text }} placeholderTextColor={theme.colors.textSecondary} placeholder={`Enter ${label}`} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={saving} message="Saving Profile..." />

      <SearchableSelectionModal visible={titleModalVisible} onClose={() => setTitleModalVisible(false)} title="Select Title" options={PROFESSIONAL_TITLES} onSelect={(val: string) => setProfile({...profile, title: val})} placeholder="Search titles..." theme={theme} currentValue={profile.title} />
      <SearchableSelectionModal visible={suffixModalVisible} onClose={() => setSuffixModalVisible(false)} title="Select Professional Suffix" options={PROFESSIONAL_SUFFIXES} onSelect={(val: string) => setProfile({...profile, professional_suffix: val})} placeholder="Search suffixes..." theme={theme} currentValue={profile.professional_suffix} />

      <Header title="Edit Profile" rightElement={<TouchableOpacity onPress={handleSave} disabled={saving || loading} style={{ padding: 8, backgroundColor: theme.colors.primaryLight, borderRadius: 20 }}><HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color={theme.colors.primary} /></TouchableOpacity>} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
              <View style={{ marginBottom: 32 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.primary, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 }}>Personal Information</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Title</Text>
                        <TouchableOpacity onPress={() => setTitleModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: 'bold', color: profile.title ? theme.colors.text : theme.colors.textSecondary }}>{profile.title || 'Select'}</Text>
                            <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={theme.colors.icon} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Suffix</Text>
                        <TouchableOpacity onPress={() => setSuffixModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: 'bold', color: profile.professional_suffix ? theme.colors.text : theme.colors.textSecondary }}>{profile.professional_suffix || 'None'}</Text>
                            <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={theme.colors.icon} />
                        </TouchableOpacity>
                    </View>
                </View>
                <InputGroup theme={theme} label="First Name" required value={profile.first_name} onChange={(t: string) => setProfile({...profile, first_name: t})} />
                <InputGroup theme={theme} label="Middle Name" value={profile.middle_name} onChange={(t: string) => setProfile({...profile, middle_name: t})} />
                <InputGroup theme={theme} label="Last Name" required value={profile.last_name} onChange={(t: string) => setProfile({...profile, last_name: t})} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}