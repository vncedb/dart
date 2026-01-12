import {
  ArrowDown01Icon,
  Briefcase01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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

const { height } = Dimensions.get('window');

// --- Types ---
interface Job {
  id: string;
  title: string;
  company?: string;
  company_name?: string;
  [key: string]: any;
}

interface JobSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (job: Job) => void;
  currentJobId: string | null;
  jobs: Job[];
  onAddJob: () => void;
  theme: any;
}

// --- Animated JobSelectionModal ---
const JobSelectionModal = ({ visible, onClose, onSelect, currentJobId, jobs, onAddJob, theme }: JobSelectionModalProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 90 })
      ]).start();
    } else {
        fadeAnim.setValue(0);
        slideAnim.setValue(height);
    }
  }, [visible, fadeAnim, slideAnim]);

  const closeModal = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { 
          toValue: height, 
          duration: 250, 
          easing: Easing.out(Easing.cubic), 
          useNativeDriver: true 
      })
    ]).start(() => {
        if (callback) callback();
        onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={true} transparent animationType="none" onRequestClose={() => closeModal()}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Fixed: Explicit Absolute Fill to avoid TS Errors */}
        <Animated.View 
            style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)', 
                opacity: fadeAnim 
            }}
        >
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeModal()} />
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: slideAnim }], width: '100%' }}>
            <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', height: '80%' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text }}>Select Primary Job</Text>
                    <TouchableOpacity onPress={() => closeModal()} style={{ padding: 8, borderRadius: 50, backgroundColor: theme.colors.background }}>
                        <HugeiconsIcon icon={Cancel01Icon} size={18} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {jobs.length === 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32 }}><Text style={{ color: theme.colors.textSecondary }}>No jobs found.</Text></View>
                ) : (
                    jobs.map((job: Job, idx: number) => {
                        const companyDisplay = job.company || job.company_name || '';
                        return (
                            <TouchableOpacity key={job.id} onPress={() => closeModal(() => onSelect(job))} style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: idx < jobs.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 4 }}>{job.title}</Text>
                                    {companyDisplay ? <Text numberOfLines={1} style={{ fontSize: 13, color: theme.colors.textSecondary }}>{companyDisplay}</Text> : null}
                                </View>
                                {currentJobId === job.id && <HugeiconsIcon icon={Tick02Icon} size={20} color={theme.colors.primary} />}
                            </TouchableOpacity>
                        );
                    })
                )}
                </ScrollView>
                <TouchableOpacity onPress={() => closeModal(onAddJob)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background, paddingBottom: 34 }}>
                    <HugeiconsIcon icon={PlusSignIcon} size={20} color={theme.colors.primary} /><Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.primary, marginLeft: 8 }}>Add New Job</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function EditProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [suffixModalVisible, setSuffixModalVisible] = useState(false);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);

  const [profile, setProfile] = useState({
    id: '', 
    first_name: '', 
    middle_name: '', 
    last_name: '', 
    title: '', 
    professional_suffix: '', 
    full_name: '', 
    current_job_id: null as string | null,
    display_job_title: 'No Job Selected',
    display_company: ''
  });
  
  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const db = await getDB();
        
        let profileData: any = null;
        let jobsData: Job[] = [];

        // Fetch Profile & Jobs
        profileData = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [user.id]);
        const localJobs = await db.getAllAsync('SELECT * FROM job_positions WHERE user_id = ?', [user.id]);
        
        // Cast to Job[] to satisfy TS
        jobsData = (localJobs as Job[]) || [];

        // If no local profile, try fetching remote
        if (!profileData) {
             const { data: remoteProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
             if (remoteProfile) {
                 profileData = remoteProfile;
                 await saveProfileLocal(remoteProfile); 
             }
        }
        
        setAvailableJobs(jobsData);
        
        let currentJobName = 'Select a Job';
        let currentCompany = '';
        let currentJobId = null;

        if (profileData) {
            currentJobId = profileData.current_job_id;
            if (currentJobId && jobsData.length > 0) {
                const active = jobsData.find((j) => j.id === currentJobId);
                if (active) { 
                    currentJobName = active.title; 
                    currentCompany = active.company || active.company_name || ''; 
                }
            }
            setProfile({
                id: user.id, 
                first_name: profileData.first_name || '',
                last_name: profileData.last_name || '',
                middle_name: profileData.middle_name || '',
                title: profileData.title || '',
                professional_suffix: profileData.professional_suffix || '', 
                full_name: profileData.full_name || '', 
                current_job_id: currentJobId,
                display_job_title: currentJobName,
                display_company: currentCompany
            });
        }
      } catch (e) { 
          console.log(e); 
      } finally { 
          // Ensure loading stays true until everything is set
          setLoading(false); 
      }
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
        current_job_id: profile.current_job_id,
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
      <JobSelectionModal visible={jobModalVisible} onClose={() => setJobModalVisible(false)} currentJobId={profile.current_job_id} jobs={availableJobs} onSelect={(job: any) => setProfile({ ...profile, current_job_id: job.id, display_job_title: job.title, display_company: job.company || job.company_name || '' })} onAddJob={() => router.push('/job/form')} theme={theme} />

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
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.primary, textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 }}>Job Assignment</Text>
                <View>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Current Job</Text>
                    <TouchableOpacity onPress={() => setJobModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                             <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}><HugeiconsIcon icon={Briefcase01Icon} size={20} color={theme.colors.primary} /></View>
                             <View style={{ flex: 1 }}>
                                 <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: 'bold', color: profile.current_job_id ? theme.colors.text : theme.colors.textSecondary }}>{profile.display_job_title}</Text>
                                 {profile.display_company ? <Text numberOfLines={1} style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{profile.display_company}</Text> : null}
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