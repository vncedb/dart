import {
  ArrowLeft02Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Download02Icon,
  File01Icon,
  FingerPrintIcon,
  Logout02Icon,
  Mail01Icon,
  Moon02Icon,
  PlusSignIcon,
  Settings02Icon,
  Shield01Icon,
  Tick02Icon,
  VolumeHighIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import { supabase } from '../lib/supabase';

// --- TYPES ---
interface AppSettings {
  // System
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  biometricEnabled: boolean;
  // Notifications
  notifCheckInOut: boolean;
  notifReportGen: boolean;
  notifCutoff: boolean;
  notifGeneral: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  vibrationEnabled: true,
  soundEnabled: true,
  biometricEnabled: false,
  notifCheckInOut: true,
  notifReportGen: true,
  notifCutoff: true,
  notifGeneral: true,
};

const SettingItem = ({ icon: Icon, color, label, value, onToggle, disabled }: any) => {
  if (!Icon) return null;
  return (
    <View className="flex-row items-center justify-between p-4">
      <View className="flex-row items-center gap-3">
        <View className={`items-center justify-center w-10 h-10 rounded-full ${disabled ? 'bg-slate-50 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-700'}`}>
           <HugeiconsIcon icon={Icon} size={20} color={disabled ? '#cbd5e1' : color} />
        </View>
        <Text className={`font-sans font-bold ${disabled ? 'text-slate-300' : 'text-slate-700 dark:text-slate-200'}`}>{label}</Text>
      </View>
      <Switch 
        value={value} 
        onValueChange={onToggle} 
        disabled={disabled}
        trackColor={{ false: '#e2e8f0', true: color }} 
        thumbColor={Platform.OS === 'android' ? '#fff' : ''}
      />
    </View>
  );
};

const PrivacyModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View className="flex-1 bg-white dark:bg-slate-900">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
        <Text className="font-sans text-xl font-bold text-slate-900 dark:text-white">Privacy Policy</Text>
        <TouchableOpacity onPress={onClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
          {Cancel01Icon && <HugeiconsIcon icon={Cancel01Icon} size={20} color="#64748b" />}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="mb-4 font-sans text-base leading-6 text-slate-600 dark:text-slate-300">
          <Text className="font-bold">Last Updated: {new Date().toLocaleDateString()}</Text>
          {'\n\n'}
          1. <Text className="font-bold">Data Collection</Text>{'\n'}
          We collect personal information such as your name, email address, and job details solely for the purpose of generating daily reports and managing your profile.
          {'\n\n'}
          2. <Text className="font-bold">Data Usage</Text>{'\n'}
          Your data is used to populate report templates and authenticate your access to the application. We do not sell your data to third parties.
        </Text>
        <View className="h-10" />
      </ScrollView>
    </View>
  </Modal>
);

export default function SettingsScreen() {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false, type: 'success', title: '', message: '', onConfirm: () => {} });

  useFocusEffect(useCallback(() => { loadSettings(); fetchProfile(); checkHardware(); }, []));

  const checkHardware = async () => { setBiometricsSupported(await LocalAuthentication.hasHardwareAsync()); };
  
  const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile({ ...data, email: user.email });
  };

  const loadSettings = async () => { 
      try { 
          const localJson = await AsyncStorage.getItem('appSettings'); 
          let currentSettings = localJson ? { ...DEFAULT_SETTINGS, ...JSON.parse(localJson) } : DEFAULT_SETTINGS;
          setSettings(currentSettings);

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
             const { data, error } = await supabase.from('profiles').select('app_settings').eq('id', user.id).single();
             if (!error && data?.app_settings) {
                 const merged = { ...currentSettings, ...data.app_settings };
                 setSettings(merged);
                 await AsyncStorage.setItem('appSettings', JSON.stringify(merged));
             }
          }
      } catch (e) { console.log('Settings Sync Error (Ignored):', e); } 
  };

  const updateSetting = async (key: keyof AppSettings, value: boolean) => {
    if (key === 'biometricEnabled' && value === true) {
      if (!biometricsSupported) { Alert.alert("Not Supported", "Biometric hardware is not available."); return; }
      if (!(await LocalAuthentication.isEnrolledAsync())) { Alert.alert("Not Enrolled", "No biometrics setup on device."); return; }
    }

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('profiles').update({ app_settings: newSettings }).eq('id', user.id);
        }
    } catch (e) { console.log("Sync error:", e); }
  };
  
  const handleToggleTheme = async () => {
      toggleColorScheme();
      // Wait for toggle to effect or just infer the new one
      const newTheme = colorScheme === 'dark' ? 'light' : 'dark';
      await AsyncStorage.setItem('user-theme', newTheme);
  };

  const handleClearCache = async () => {
    setAlertConfig({ 
        visible: true, 
        type: 'confirmation', 
        title: 'Clear App Cache?', 
        message: 'This will reset settings, local temporary files, and cached reports.', 
        confirmText: 'Clear Now', 
        onConfirm: async () => { 
            setAlertConfig((p: any) => ({...p, visible: false}));
            setLoadingMessage("Cleaning up...");
            setLoading(true);
            try {
                const keys = ['appSettings', 'cachedReports', 'tempDrafts', 'userPin']; 
                await AsyncStorage.multiRemove(keys);
                setSettings(DEFAULT_SETTINGS);
                setTimeout(() => {
                    setLoading(false);
                    setAlertConfig({ visible: true, type: 'success', title: 'Cleaned', message: 'Cache cleared successfully.', confirmText: 'OK', onConfirm: () => setAlertConfig((p: any) => ({...p, visible: false})) });
                }, 800);
            } catch (e) {
                setLoading(false);
                Alert.alert("Error", "Failed to clear cache.");
            }
        }, 
        onCancel: () => setAlertConfig((p: any) => ({...p, visible: false})) 
    });
  };

  const handleCheckUpdate = async () => {
    setLoadingMessage("Checking for updates...");
    setLoading(true);
    try {
      if (__DEV__) { setLoading(false); setAlertConfig({ visible: true, type: 'info', title: 'Development Mode', message: 'OTA updates disabled in dev.', confirmText: 'OK', onConfirm: () => setAlertConfig((p: any) => ({...p, visible: false})) }); return; }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) { setLoading(false); setAlertConfig({ visible: true, type: 'success', title: 'Update Available', message: 'Restart to apply?', confirmText: 'Restart', onConfirm: async () => { await Updates.fetchUpdateAsync(); await Updates.reloadAsync(); }, onCancel: () => setAlertConfig((p: any) => ({...p, visible: false})) }); } 
      else { setLoading(false); setAlertConfig({ visible: true, type: 'success', title: 'Up to Date', message: `Version: ${Constants.expoConfig?.version}`, confirmText: 'Awesome', onConfirm: () => setAlertConfig((p: any) => ({...p, visible: false})) }); }
    } catch (error: any) { setLoading(false); setAlertConfig({ visible: true, type: 'error', title: 'Check Failed', message: 'Connection error.', confirmText: 'OK', onConfirm: () => setAlertConfig((p: any) => ({...p, visible: false})) }); }
  };

  const handleSupport = () => Linking.openURL('mailto:support@dart.app?subject=DART App Support');
  
  const switchJob = async (job: any) => {
      if (!profile) return;
      setLoadingMessage("Switching Profile..."); setLoading(true);
      const updates = { job_title: job.job_title, company_name: job.company_name, department: job.department, salary: job.salary, rate_type: job.rate_type, cutoff_config: job.cutoff_config, work_schedule: job.work_schedule };
      await supabase.from('profiles').update(updates).eq('id', profile.id);
      setTimeout(async () => { await fetchProfile(); setLoading(false); setAlertConfig({ visible: true, type: 'success', title: 'Switched', message: `Active: ${job.job_title}`, confirmText: 'OK', onConfirm: () => setAlertConfig((p: any) => ({...p, visible: false})) }); }, 800);
  };
  
  const handleLogout = async () => { 
      setAlertConfig({ 
          visible: true, 
          type: 'confirmation', 
          title: 'Sign Out?', 
          message: 'Log out of account?', 
          confirmText: 'Log Out', 
          onConfirm: async () => { 
              setAlertConfig((p:any) => ({...p, visible: false})); 
              await supabase.auth.signOut(); 
              router.replace('/'); 
          }, 
          onCancel: () => setAlertConfig((p:any) => ({...p, visible: false})) 
      }); 
  };

  const jobs = profile?.jobs || [];
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]" edges={['top']}>
      <LoadingOverlay visible={loading} message={loadingMessage} />
      <ModernAlert {...alertConfig} />
      <PrivacyModal visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />

      <View className="z-10 flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800">
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
        </TouchableOpacity>
        <Text className="flex-1 mx-4 font-sans text-xl font-bold text-center text-slate-900 dark:text-white" numberOfLines={1}>Settings</Text>
        <View className="w-10" /> 
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Workforce Profiles</Text>
        <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden mb-6 shadow-sm">
            {jobs.length === 0 ? (
                <View className="items-center p-6"><Text className="font-medium text-slate-400 dark:text-slate-500">No additional jobs saved.</Text></View>
            ) : (
                jobs.map((job: any, idx: number) => {
                    const isActive = profile?.job_title === job.job_title && profile?.company_name === job.company_name;
                    return (
                        <TouchableOpacity key={idx} onPress={() => !isActive && switchJob(job)} disabled={isActive} className={`flex-row items-center justify-between p-4 ${idx < jobs.length - 1 ? 'border-b border-slate-100 dark:border-slate-700/50' : ''}`}>
                            <View className="flex-row items-center flex-1 gap-3 pr-4">
                                <View className={`items-center justify-center w-10 h-10 rounded-full ${isActive ? 'bg-indigo-100 dark:bg-indigo-900' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                    {Briefcase01Icon && <HugeiconsIcon icon={Briefcase01Icon} size={20} color={isActive ? '#6366f1' : '#64748b'} />}
                                </View>
                                <View className="flex-1">
                                    <Text className={`font-sans font-bold ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`} numberOfLines={1}>{job.job_title}</Text>
                                    <Text className="text-xs font-medium text-slate-400" numberOfLines={1}>{job.company_name}</Text>
                                </View>
                            </View>
                            {isActive && CheckmarkCircle02Icon && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="#6366f1" />}
                        </TouchableOpacity>
                    );
                })
            )}
            <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
            <TouchableOpacity onPress={() => router.push({ pathname: '/edit-profile', params: { mode: 'add' } })} className="flex-row items-center justify-center p-4 active:bg-slate-50 dark:active:bg-slate-700/50">
                {PlusSignIcon && <HugeiconsIcon icon={PlusSignIcon} size={18} color="#6366f1" />}
                <Text className="ml-2 font-sans font-bold text-indigo-600">Add Another Job</Text>
            </TouchableOpacity>
        </View>

        <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Account</Text>
        <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden mb-6 shadow-sm">
            <TouchableOpacity onPress={() => router.push('/account-security')} className="flex-row items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/50">
                <View className="flex-row items-center gap-3">
                    <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700">
                        {Shield01Icon && <HugeiconsIcon icon={Shield01Icon} size={20} color="#64748b" />}
                    </View>
                    <View>
                        <Text className="font-sans font-bold text-slate-900 dark:text-white">Account & Security</Text>
                        <Text className="text-xs text-slate-400">Email, Password, Deletion</Text>
                    </View>
                </View>
                {ArrowRight01Icon && <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="#94a3b8" />}
            </TouchableOpacity>
        </View>

        <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Notifications</Text>
        <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden mb-6 shadow-sm">
          <SettingItem icon={Tick02Icon} color="#10b981" label="Check In/Out Alerts" value={settings.notifCheckInOut} onToggle={(v: boolean) => updateSetting('notifCheckInOut', v)} />
          <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
          <SettingItem icon={File01Icon} color="#3b82f6" label="Report Generated" value={settings.notifReportGen} onToggle={(v: boolean) => updateSetting('notifReportGen', v)} />
          <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
          <SettingItem icon={Calendar03Icon} color="#f59e0b" label="Cutoff Reminders" value={settings.notifCutoff} onToggle={(v: boolean) => updateSetting('notifCutoff', v)} />
        </View>

        <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Preferences</Text>
        <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden mb-6 shadow-sm">
          <SettingItem icon={FingerPrintIcon} color="#ec4899" label="Biometric Login" value={settings.biometricEnabled} onToggle={(v: boolean) => updateSetting('biometricEnabled', v)} disabled={!biometricsSupported} />
          <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
          <SettingItem icon={Moon02Icon} color="#6366f1" label="Dark Mode" value={colorScheme === 'dark'} onToggle={handleToggleTheme} />
        </View>

        <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">System</Text>
        <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden mb-6 shadow-sm">
          <SettingItem icon={Settings02Icon} color="#10b981" label="Haptic Vibration" value={settings.vibrationEnabled} onToggle={(v: boolean) => updateSetting('vibrationEnabled', v)} />
          <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
          <SettingItem icon={VolumeHighIcon} color="#f97316" label="Sound Effects" value={settings.soundEnabled} onToggle={(v: boolean) => updateSetting('soundEnabled', v)} />
          <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
          <TouchableOpacity onPress={handleClearCache} className="flex-row items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/50">
             <View className="flex-row items-center gap-3">
               <View className="items-center justify-center w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20">
                 {Delete02Icon && <HugeiconsIcon icon={Delete02Icon} size={20} color="#ef4444" />}
               </View>
               <Text className="font-sans font-bold text-slate-700 dark:text-slate-200">Clear Cache</Text>
             </View>
          </TouchableOpacity>
        </View>

        <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">About</Text>
        <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden mb-8 shadow-sm">
          <TouchableOpacity onPress={() => setPrivacyVisible(true)} className="flex-row items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/50">
             <View className="flex-row items-center gap-3">
               <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700">
                 {Shield01Icon && <HugeiconsIcon icon={Shield01Icon} size={20} color="#64748b" />}
               </View>
               <Text className="font-sans font-bold text-slate-700 dark:text-slate-200">Privacy Policy</Text>
             </View>
          </TouchableOpacity>
          <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
          <TouchableOpacity onPress={handleSupport} className="flex-row items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/50">
             <View className="flex-row items-center gap-3">
               <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700">
                 {Mail01Icon && <HugeiconsIcon icon={Mail01Icon} size={20} color="#64748b" />}
               </View>
               <Text className="font-sans font-bold text-slate-700 dark:text-slate-200">Contact Support</Text>
             </View>
          </TouchableOpacity>
          <View className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4" />
          <TouchableOpacity onPress={handleCheckUpdate} className="flex-row items-center justify-between p-4 active:bg-slate-50 dark:active:bg-slate-700/50">
             <View className="flex-row items-center gap-3">
               <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700">
                 {Download02Icon && <HugeiconsIcon icon={Download02Icon} size={20} color="#64748b" />}
               </View>
               <Text className="font-sans font-bold text-slate-700 dark:text-slate-200">Version {appVersion}</Text>
             </View>
             <View className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700">
                <Text className="text-xs font-bold text-slate-500 dark:text-slate-400">Check Update</Text>
             </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleLogout} className="flex-row items-center justify-center p-4 border border-red-100 bg-red-50 dark:bg-red-900/10 rounded-2xl dark:border-red-900/30 active:opacity-80">
          <HugeiconsIcon icon={Logout02Icon} size={20} color="#ef4444" />
          <Text className="ml-2 font-sans font-bold text-red-500">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}