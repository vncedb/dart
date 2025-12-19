import {
  ArrowDown01Icon,
  ArrowLeft02Icon,
  Camera01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  PlusSignIcon,
  Tick02Icon,
  UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
  Image,
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

// --- COMPONENT IMPORTS ---
import AnalogTimePicker from '../components/AnalogTimePicker';
import DateTimeInput from '../components/DateTimeInput';
import LoadingOverlay from '../components/LoadingOverlay';
import { ModernAlert } from '../components/ModernUI'; // Using the enhanced ModernUI
import SearchableSelectionModal from '../components/SearchableSelectionModal';
import { supabase } from '../lib/supabase';

const JOBS_LIST = [
  { label: 'Accountant', value: 'Accountant' },
  { label: 'Architect', value: 'Architect' },
  { label: 'Data Scientist', value: 'Data Scientist' },
  { label: 'Graphic Designer', value: 'Graphic Designer' },
  { label: 'Project Manager', value: 'Project Manager' },
  { label: 'Software Engineer', value: 'Software Engineer' },
  { label: 'Web Developer', value: 'Web Developer' },
];

// --- INLINE SELECTION MODAL ---
const SelectionModal = ({ visible, onClose, onSelect, currentValue, title, options }: any) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={onClose}>
      <View className="overflow-hidden bg-white shadow-xl dark:bg-slate-800 rounded-3xl">
        <View className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <Text className="font-bold text-center text-slate-900 dark:text-white">{title}</Text>
        </View>
        <ScrollView style={{ maxHeight: 400 }}>
          {options.map((opt: any, idx: number) => (
              <TouchableOpacity key={opt.value} onPress={() => { onSelect(opt.value); onClose(); }} className={`p-5 flex-row justify-between items-center ${idx < options.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
              <Text className="text-base font-medium text-slate-700 dark:text-white">{opt.label}</Text>
              {currentValue === opt.value && <HugeiconsIcon icon={Tick02Icon} size={20} color="#6366f1" />}
              </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={onClose} className="p-4 border-t bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700">
          <Text className="font-bold text-center text-red-500">Cancel</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  </Modal>
);

export default function EditProfileScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modals
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [cutoffModalVisible, setCutoffModalVisible] = useState(false);
  const [titleModalVisible, setTitleModalVisible] = useState(false);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  
  // ANALOG CLOCK STATE
  const [clockVisible, setClockVisible] = useState(false);
  const [clockTarget, setClockTarget] = useState<{ type: 'work' | 'break', field: 'start' | 'end', index?: number } | null>(null);
  const [clockInitialValue, setClockInitialValue] = useState("09:00");

  // Alert Config
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false, type: 'success', title: '', message: '', onConfirm: () => {} });
  
  const [existingJobs, setExistingJobs] = useState<any[]>([]);

  const [profile, setProfile] = useState({
    id: '', first_name: '', last_name: '', title: '', full_name: '', 
    job_title: '', avatar_url: null as string | null,
    company_name: '', cutoff_config: '15-30', department: '', salary: '', 
    rate_type: 'daily', overtime_rate: '', 
    work_start: '08:00', work_end: '17:00',
    breaks: [] as { id: string, description: string, start: string, end: string }[] 
  });
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        
        if (data) {
          setExistingJobs(data.jobs || []);
          const schedule = data.work_schedule || { start: '08:00', end: '17:00' };
          const breaks = Array.isArray(data.break_schedule) ? data.break_schedule : [];
          const isAddMode = mode === 'add';

          setProfile({
            id: user.id, 
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            title: data.title || '',
            full_name: data.full_name || '', 
            avatar_url: data.avatar_url, 
            job_title: isAddMode ? '' : data.job_title || '',
            company_name: isAddMode ? '' : data.company_name || '',
            department: isAddMode ? '' : data.department || '',
            salary: isAddMode ? '' : (data.salary?.toString() || ''),
            rate_type: isAddMode ? 'daily' : (data.rate_type || 'daily'),
            cutoff_config: isAddMode ? '15-30' : (data.cutoff_config || '15-30'),
            overtime_rate: isAddMode ? '' : (data.overtime_rate?.toString() || ''),
            work_start: isAddMode ? '08:00' : (schedule.start || '08:00'),
            work_end: isAddMode ? '17:00' : (schedule.end || '17:00'),
            breaks: isAddMode ? [] : (breaks.length > 0 ? breaks : [])
          });
        }
      } catch (e) { 
        console.log(e);
      } finally { 
        setLoading(false); 
      }
    };
    fetchProfile();
  }, [mode]);

  // --- LOGIC: Upload Avatar to Supabase Storage ---
  const uploadAvatar = async (uri: string, userId: string) => {
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await new Response(blob).arrayBuffer();
        
        const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpeg';
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, arrayBuffer, {
                contentType: blob.type || 'image/jpeg',
                upsert: true,
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (error) {
        console.error("Avatar Upload Error:", error);
        throw new Error("Failed to upload profile picture.");
    }
  };

  const handleBack = () => router.back();

  const handleSave = () => {
    if (!profile.job_title.trim() || !profile.salary.trim()) {
      setAlertConfig({ 
        visible: true, 
        type: 'error', 
        title: 'Missing Info', 
        message: 'Job Title and Rate are required.', 
        confirmText: 'OK', 
        onDismiss: () => setAlertConfig((p: any) => ({...p, visible: false})) 
      });
      return;
    }
    performSave();
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // 1. Handle Image Upload if Local URI
      let finalAvatarUrl = profile.avatar_url;
      if (profile.avatar_url && !profile.avatar_url.startsWith('http')) {
         finalAvatarUrl = await uploadAvatar(profile.avatar_url, user.id);
      }

      const fullNameCombined = `${profile.first_name} ${profile.last_name}`.trim();
      
      const currentJobObject = {
          job_title: profile.job_title,
          company_name: profile.company_name,
          department: profile.department,
          salary: parseFloat(profile.salary) || 0,
          rate_type: profile.rate_type,
          cutoff_config: profile.cutoff_config,
          overtime_rate: profile.overtime_rate ? parseFloat(profile.overtime_rate) : null,
          work_schedule: { start: profile.work_start, end: profile.work_end },
          break_schedule: profile.breaks
      };

      let updatedJobs = [...existingJobs];
      // Remove existing entry for same job to avoid duplicates if updating
      updatedJobs = updatedJobs.filter(j => !(j.job_title === currentJobObject.job_title && j.company_name === currentJobObject.company_name));
      // Add current to top
      updatedJobs.unshift(currentJobObject);

      const updates = {
        id: user.id,
        first_name: profile.first_name, 
        last_name: profile.last_name,
        title: profile.title, 
        full_name: fullNameCombined,
        avatar_url: finalAvatarUrl,
        ...currentJobObject,
        jobs: updatedJobs,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;

      setAlertConfig({ 
          visible: true, 
          type: 'success', 
          title: 'Success', 
          message: 'Profile updated successfully.', 
          confirmText: 'OK', 
          onDismiss: () => { 
            setAlertConfig((p: any) => ({...p, visible: false})); 
            router.back(); 
          },
          onConfirm: () => { 
            setAlertConfig((p: any) => ({...p, visible: false})); 
            router.back(); 
          }
      });
    } catch (error: any) {
      setAlertConfig({ 
        visible: true, 
        type: 'error', 
        title: 'Error', 
        message: error.message || "Failed to save profile.", 
        confirmText: 'OK', 
        onDismiss: () => setAlertConfig((p: any) => ({...p, visible: false})) 
      });
    } finally { 
      setSaving(false); 
    }
  };

  const openTimePicker = (type: 'work' | 'break', field: 'start' | 'end', index?: number) => {
      let currentVal = "08:00";
      if (type === 'work') currentVal = field === 'start' ? profile.work_start : profile.work_end;
      else if (type === 'break' && index !== undefined) currentVal = field === 'start' ? profile.breaks[index].start : profile.breaks[index].end;
      setClockTarget({ type, field, index });
      setClockInitialValue(currentVal || "09:00");
      setClockVisible(true);
  };

  const handleTimeSelect = (time: string) => {
      if (!clockTarget) return;
      const { type, field, index } = clockTarget;
      if (type === 'work') {
          setProfile(p => ({ ...p, [field === 'start' ? 'work_start' : 'work_end']: time }));
      } else if (type === 'break' && index !== undefined) {
          const newBreaks = [...profile.breaks];
          newBreaks[index] = { ...newBreaks[index], [field]: time };
          setProfile(p => ({ ...p, breaks: newBreaks }));
      }
  };

  const addBreak = () => { setProfile(p => ({ ...p, breaks: [...p.breaks, { id: Date.now().toString(), description: '', start: '12:00', end: '13:00' }] })); };
  const removeBreak = (index: number) => { const newBreaks = [...profile.breaks]; newBreaks.splice(index, 1); setProfile(p => ({ ...p, breaks: newBreaks })); };
  const updateBreakDesc = (index: number, val: string) => { const newBreaks = [...profile.breaks]; newBreaks[index] = { ...newBreaks[index], description: val }; setProfile(p => ({ ...p, breaks: newBreaks })); };
  
  const pickImage = async () => { 
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, 
      aspect: [1, 1], 
      quality: 0.5 
    }); 
    if (!result.canceled) {
      setProfile({ ...profile, avatar_url: result.assets[0].uri }); 
    }
  };

  if (loading) return <View className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]" />;

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]" edges={['top']}>
      <ModernAlert 
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        onDismiss={alertConfig.onDismiss}
        onConfirm={alertConfig.onConfirm}
        confirmText={alertConfig.confirmText}
      />
      
      <LoadingOverlay visible={saving} message="Saving Profile..." />
      
      <AnalogTimePicker 
        visible={clockVisible} 
        onClose={() => setClockVisible(false)} 
        onSelect={handleTimeSelect}
        initialValue={clockInitialValue}
        title={clockTarget?.field === 'start' ? 'Start Time' : 'End Time'}
      />

      {/* Modals */}
      <SelectionModal visible={rateModalVisible} onClose={() => setRateModalVisible(false)} title="Select Rate Type" currentValue={profile.rate_type} options={[{ label: 'Daily (Fixed Rate)', value: 'daily' }, { label: 'Hourly Rate', value: 'hourly' }]} onSelect={(val: string) => setProfile({...profile, rate_type: val})} />
      <SelectionModal visible={cutoffModalVisible} onClose={() => setCutoffModalVisible(false)} title="Select Cutoff Period" currentValue={profile.cutoff_config} options={[{ label: 'Semi-Monthly (15th & 30th)', value: '15-30' }, { label: 'Weekly (Every Friday)', value: 'weekly-fri' }, { label: 'Monthly (End of Month)', value: 'monthly' }]} onSelect={(val: string) => setProfile({...profile, cutoff_config: val})} />
      <SelectionModal visible={titleModalVisible} onClose={() => setTitleModalVisible(false)} title="Select Title" currentValue={profile.title} options={[{ label: 'No Title', value: '' }, { label: 'Mr.', value: 'Mr.' }, { label: 'Ms.', value: 'Ms.' }, { label: 'Mrs.', value: 'Mrs.' }, { label: 'Ma\'am', value: 'Ma\'am' }, { label: 'Sir', value: 'Sir' }, { label: 'Dr.', value: 'Dr.' }, { label: 'Engr.', value: 'Engr.' }, { label: 'Atty.', value: 'Atty.' }]} onSelect={(val: string) => setProfile({...profile, title: val})} />
      <SearchableSelectionModal visible={jobModalVisible} onClose={() => setJobModalVisible(false)} title="Select Job Position" placeholder="Search for a job title..." options={JOBS_LIST} onSelect={(val: string) => setProfile({...profile, job_title: val})} />

      {/* Header */}
      <View className="z-10 flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={handleBack} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800"><HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" /></TouchableOpacity>
        <Text className="font-sans text-xl font-bold text-slate-900 dark:text-white">{mode === 'add' ? 'Add Job' : 'Edit Profile'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} className="p-2 rounded-full" style={{ backgroundColor: isDark ? 'rgba(79, 70, 229, 0.3)' : '#e0e7ff' }}>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
          
          <View className="items-center mb-8">
            <TouchableOpacity onPress={pickImage} className="relative">
              <View className="items-center justify-center w-32 h-32 overflow-hidden border-4 border-white rounded-full shadow-lg dark:border-slate-800 bg-slate-200 dark:bg-slate-800">
                {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} className="w-full h-full" /> : <HugeiconsIcon icon={UserCircleIcon} size={64} color="#94a3b8" />}
              </View>
              <View className="absolute bottom-0 right-0 p-2 bg-indigo-600 border-2 border-white rounded-full dark:border-slate-900"><HugeiconsIcon icon={Camera01Icon} size={16} color="white" /></View>
            </TouchableOpacity>
          </View>

          <View className="mb-8">
            <Text className="pb-2 mb-4 text-sm font-bold tracking-widest text-indigo-500 uppercase border-b border-indigo-100 dark:border-indigo-900">Personal Information</Text>
            
            <View className="mb-5">
                <Text className="mb-2 ml-1 text-xs font-bold uppercase text-slate-400">Title</Text>
                <TouchableOpacity onPress={() => setTitleModalVisible(true)} className="flex-row items-center justify-between p-4 bg-white border shadow-sm dark:bg-slate-800 rounded-xl h-14 border-slate-200 dark:border-slate-700">
                    <Text className="text-base font-bold text-slate-900 dark:text-white">{profile.title || 'Select'}</Text>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={16} color="#64748b" />
                </TouchableOpacity>
            </View>

            <InputGroup label="First Name" required value={profile.first_name} onChange={(t: string) => setProfile({...profile, first_name: t})} />
            <InputGroup label="Last Name" required value={profile.last_name} onChange={(t: string) => setProfile({...profile, last_name: t})} />
          </View>

          <View className="mb-6">
            <Text className="pb-2 mb-4 text-sm font-bold tracking-widest text-indigo-500 uppercase border-b border-indigo-100 dark:border-indigo-900">Job Details</Text>
            <InputGroup label="Company Name" required value={profile.company_name} onChange={(t: string) => setProfile({...profile, company_name: t})} placeholder="Company / Organization" />
            
            <View className="mb-5">
                <Text className="mb-2 ml-1 text-xs font-bold uppercase text-slate-400">Job Title <Text className="text-red-500">*</Text></Text>
                <TouchableOpacity onPress={() => setJobModalVisible(true)} className="flex-row items-center justify-between p-4 bg-white border shadow-sm dark:bg-slate-800 rounded-xl min-h-[56px] border-slate-200 dark:border-slate-700">
                    <Text className={`text-base font-bold ${profile.job_title ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                        {profile.job_title || 'Select Job Title'}
                    </Text>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={20} color="#64748b" />
                </TouchableOpacity>
            </View>
            
            <View className="mb-5">
                <View className="flex-row justify-between mb-2 ml-1"><Text className="text-xs font-bold uppercase text-slate-400">Rate <Text className="text-red-500">*</Text></Text></View>
                <View className="flex-row gap-3">
                    <View className="flex-1"><TextInput value={profile.salary} onChangeText={(t) => setProfile({...profile, salary: t})} keyboardType="numeric" className="p-4 text-base font-bold bg-white border shadow-sm dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 h-14" placeholderTextColor="#94a3b8" placeholder="0.00" /></View>
                    <TouchableOpacity onPress={() => setRateModalVisible(true)} className="flex-row items-center justify-between flex-1 p-4 border bg-slate-100 dark:bg-slate-800 rounded-xl h-14 border-slate-200 dark:border-slate-700">
                        <Text className="font-bold capitalize text-slate-900 dark:text-white">{profile.rate_type === 'daily' ? 'Daily' : 'Hourly'}</Text>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={20} color="#64748b" />
                    </TouchableOpacity>
                </View>
            </View>

            <InputGroup label="Department (Optional)" value={profile.department} onChange={(t: string) => setProfile({...profile, department: t})} />
            
            <View className="mb-5">
                <View className="flex-row justify-between mb-2 ml-1"><Text className="text-xs font-bold uppercase text-slate-400">Cutoff Period</Text></View>
                <TouchableOpacity onPress={() => setCutoffModalVisible(true)} className="flex-row items-center justify-between p-4 bg-white border shadow-sm dark:bg-slate-800 rounded-xl h-14 border-slate-200 dark:border-slate-700">
                    <Text className="font-bold capitalize text-slate-900 dark:text-white">
                        {profile.cutoff_config === '15-30' ? '15th & 30th' : profile.cutoff_config === 'weekly-fri' ? 'Weekly (Friday)' : 'Monthly'}
                    </Text>
                    <HugeiconsIcon icon={ArrowDown01Icon} size={20} color="#64748b" />
                </TouchableOpacity>
            </View>

            <InputGroup label="Overtime Rate Multiplier (Optional)" value={profile.overtime_rate} onChange={(t: string) => setProfile({...profile, overtime_rate: t})} keyboardType="numeric" placeholder="e.g. 1.25" />

            <View className="pt-4 mt-2 mb-2 border-t border-slate-100 dark:border-slate-800">
                <View className="mb-5">
                    <Text className="mb-2 ml-1 text-xs font-bold uppercase text-slate-400">Standard Work Hours</Text>
                    <View className="flex-row gap-3">
                        <DateTimeInput type="time" value={profile.work_start} label="Start Time" onChange={() => {}} onPress={() => openTimePicker('work', 'start')} />
                        <View className="justify-center"><Text className="font-bold text-slate-400">-</Text></View>
                        <DateTimeInput type="time" value={profile.work_end} label="End Time" onChange={() => {}} onPress={() => openTimePicker('work', 'end')} />
                    </View>
                </View>

                <View>
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="ml-1 text-xs font-bold uppercase text-slate-400">Unpaid Breaks</Text>
                        <TouchableOpacity onPress={addBreak} className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#e0e7ff' }}>
                            <HugeiconsIcon icon={PlusSignIcon} size={14} color="#6366f1" />
                            <Text className="text-xs font-bold text-indigo-600">Add Break</Text>
                        </TouchableOpacity>
                    </View>
                    {profile.breaks.map((item, index) => (
                        <View key={item.id || index} className="p-4 mb-3 border bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-slate-100 dark:border-slate-700">
                            <TextInput value={item.description} onChangeText={(t) => updateBreakDesc(index, t)} placeholder="Description" className="mb-3 text-base font-bold text-slate-900 dark:text-white" />
                            <View className="flex-row items-center gap-3">
                                <DateTimeInput type="time" value={item.start} label="Start" onChange={() => {}} onPress={() => openTimePicker('break', 'start', index)} />
                                <Text className="text-slate-400">-</Text>
                                <DateTimeInput type="time" value={item.end} label="End" onChange={() => {}} onPress={() => openTimePicker('break', 'end', index)} />
                                <TouchableOpacity onPress={() => removeBreak(index)} className="items-center justify-center p-4 bg-red-100 dark:bg-red-900/30 rounded-xl"><HugeiconsIcon icon={Delete02Icon} size={20} color="#ef4444" /></TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const InputGroup = ({ label, value, onChange, keyboardType, required, placeholder }: any) => (
  <View className="mb-5">
    <Text className="mb-2 ml-1 text-xs font-bold uppercase text-slate-400">{label} {required && <Text className="text-red-500">*</Text>}</Text>
    <TextInput value={value} onChangeText={onChange} keyboardType={keyboardType} className="p-4 text-base font-bold bg-white border shadow-sm dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white border-slate-200 dark:border-slate-700" placeholderTextColor="#94a3b8" placeholder={placeholder || `Enter ${label}`} />
  </View>
);