import {
  ArrowDown01Icon,
  Briefcase01Icon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { supabase } from '../lib/supabase';

const JobSelectionModal = ({ visible, onClose, onSelect, currentJobId, jobs, onAddJob, theme }: any) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
      <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, maxHeight: '80%' }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: theme.colors.text }}>Select Primary Job</Text>
        </View>
        
        <ScrollView contentContainerStyle={{ padding: 0 }}>
          {jobs.length === 0 ? (
             <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                <Text style={{ color: theme.colors.textSecondary }}>No jobs found.</Text>
             </View>
          ) : (
            jobs.map((job: any, idx: number) => {
                const companyDisplay = job.company_name || job.company || '';
                return (
                    <TouchableOpacity 
                        key={job.id} 
                        onPress={() => { onSelect(job); onClose(); }} 
                        style={{ 
                            padding: 20, 
                            flexDirection: 'row', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            borderBottomWidth: idx < jobs.length - 1 ? 1 : 0,
                            borderBottomColor: theme.colors.border
                        }}
                    >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 4 }}>
                                {job.title}
                            </Text>
                            {companyDisplay ? (
                                <Text numberOfLines={1} style={{ fontSize: 13, color: theme.colors.textSecondary }}>
                                    {companyDisplay}
                                </Text>
                            ) : null}
                        </View>
                        
                        {currentJobId === job.id && (
                            <HugeiconsIcon icon={Tick02Icon} size={20} color={theme.colors.primary} />
                        )}
                    </TouchableOpacity>
                );
            })
          )}
        </ScrollView>

        <TouchableOpacity 
            onPress={() => { onClose(); onAddJob(); }} 
            style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: 16, 
                borderTopWidth: 1, 
                borderTopColor: theme.colors.border, 
                backgroundColor: theme.colors.background 
            }}
        >
          <HugeiconsIcon icon={PlusSignIcon} size={20} color={theme.colors.primary} />
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.primary, marginLeft: 8 }}>Add New Job</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  </Modal>
);

export default function EditProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [suffixModalVisible, setSuffixModalVisible] = useState(false);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);

  const [profile, setProfile] = useState({
    id: '', 
    first_name: '', 
    last_name: '', 
    title: '', 
    professional_suffix: '', 
    full_name: '', 
    current_job_id: null as string | null,
    display_job_title: 'No Job Selected',
    display_company: ''
  });
  
  useFocusEffect(
    useCallback(() => { fetchData(); }, [])
  );

  const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: jobsData } = await supabase.from('job_positions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        setAvailableJobs(jobsData || []);

        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        
        let currentJobName = 'Select a Job';
        let currentCompany = '';
        let currentJobId = null;

        if (profileData) {
            currentJobId = profileData.current_job_id;
            if (currentJobId && jobsData) {
                const active = jobsData.find((j:any) => j.id === currentJobId);
                if (active) {
                    currentJobName = active.title;
                    currentCompany = active.company_name || active.company || '';
                }
            }
            setProfile({
                id: user.id, 
                first_name: profileData.first_name || '',
                last_name: profileData.last_name || '',
                title: profileData.title || '',
                professional_suffix: profileData.professional_suffix || '', 
                full_name: profileData.full_name || '', 
                current_job_id: currentJobId,
                display_job_title: currentJobName,
                display_company: currentCompany
            });
        }
      } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!profile.first_name.trim() || !profile.last_name.trim()) {
      setAlertConfig({ visible: true, type: 'error', title: 'Missing Info', message: 'Name is required.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any)=>({...p, visible: false})) });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const updates = {
        id: user.id,
        first_name: profile.first_name, 
        last_name: profile.last_name,
        title: profile.title, 
        professional_suffix: profile.professional_suffix,
        full_name: `${profile.first_name} ${profile.last_name}`.trim(),
        current_job_id: profile.current_job_id,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      router.back();
    } catch (error: any) {
      const msg = error.message === 'Network request failed' ? 'Check your internet connection and try again.' : error.message;
      setAlertConfig({ 
          visible: true, 
          type: 'error', 
          title: 'Save Failed', 
          message: msg, 
          confirmText: 'OK',
          onConfirm: () => setAlertConfig((p:any)=>({...p, visible: false})) 
      });
    } finally { 
        setSaving(false); 
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={saving} message="Saving Profile..." />

      <SearchableSelectionModal 
        visible={titleModalVisible} 
        onClose={() => setTitleModalVisible(false)} 
        title="Select Title" 
        options={PROFESSIONAL_TITLES} 
        onSelect={(val: string) => setProfile({...profile, title: val})} 
        placeholder="Search titles..."
        theme={theme} 
        currentValue={profile.title}
      />

      <SearchableSelectionModal 
        visible={suffixModalVisible} 
        onClose={() => setSuffixModalVisible(false)} 
        title="Select Professional Suffix" 
        options={PROFESSIONAL_SUFFIXES} 
        onSelect={(val: string) => setProfile({...profile, professional_suffix: val})} 
        placeholder="Search suffixes..."
        theme={theme}
        currentValue={profile.professional_suffix}
      />
      
      <JobSelectionModal 
        visible={jobModalVisible} 
        onClose={() => setJobModalVisible(false)} 
        currentJobId={profile.current_job_id} 
        jobs={availableJobs}
        onSelect={(job: any) => setProfile({
            ...profile, 
            current_job_id: job.id, 
            display_job_title: job.title, 
            display_company: job.company_name || job.company || '' 
        })}
        onAddJob={() => router.push('/job/form')}
        theme={theme}
      />

      <Header 
        title="Edit Profile" 
        rightElement={
            <TouchableOpacity 
                onPress={handleSave} 
                disabled={saving || loading}
                style={{ padding: 8, backgroundColor: theme.colors.primaryLight, borderRadius: 20 }}
            >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color={theme.colors.primary} />
            </TouchableOpacity>
        }
      />

      {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
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
                <InputGroup theme={theme} label="Last Name" required value={profile.last_name} onChange={(t: string) => setProfile({...profile, last_name: t})} />
              </View>

              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.primary, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 }}>Job Assignment</Text>
                <View>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Current Job</Text>
                    <TouchableOpacity onPress={() => setJobModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                             <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                <HugeiconsIcon icon={Briefcase01Icon} size={20} color={theme.colors.primary} />
                             </View>
                             <View style={{ flex: 1 }}>
                                 <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: 'bold', color: profile.current_job_id ? theme.colors.text : theme.colors.textSecondary }}>
                                     {profile.display_job_title}
                                 </Text>
                                 {profile.display_company ? (
                                    <Text numberOfLines={1} style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                                        {profile.display_company}
                                    </Text>
                                 ) : null}
                             </View>
                        </View>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} />
                    </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const InputGroup = ({ label, value, onChange, required, theme }: any) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
        {label} {required && <Text style={{ color: theme.colors.danger }}>*</Text>}
    </Text>
    <TextInput 
        value={value} 
        onChangeText={onChange} 
        style={{ padding: 16, fontSize: 16, fontWeight: 'bold', backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text }}
        placeholderTextColor={theme.colors.textSecondary} 
        placeholder={`Enter ${label}`} 
    />
  </View>
);