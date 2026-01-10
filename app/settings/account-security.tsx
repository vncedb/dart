// ... (imports remain the same)
import {
  Delete02Icon,
  FingerPrintIcon,
  LockKeyIcon,
  Mail01Icon,
  Notification03Icon,
  PencilEdit02Icon,
  ViewIcon,
  ViewOffSlashIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import OtpVerificationModal from '../../components/OtpVerificationModal';
import { supabase } from '../../lib/supabase';

// ... (EditModal and PasswordInput components remain the same) ...
// (Omitting duplicates for brevity, copy them from previous response if needed)
const EditModal = ({ visible, onClose, title, children, onSave, saveLabel = "Save" }: any) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 bg-black/50">
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View className="mx-6 bg-white shadow-xl dark:bg-slate-800 rounded-3xl">
        <View className="p-5 border-b border-slate-100 dark:border-slate-700">
          <Text className="font-sans text-lg font-bold text-center text-slate-900 dark:text-white">{title}</Text>
        </View>
        <View className="p-6">
          {children}
          <View className="flex-row gap-3 mt-6">
            <TouchableOpacity onPress={onClose} className="items-center flex-1 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl">
              <Text className="font-bold text-slate-500 dark:text-slate-300">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} className={`items-center flex-1 py-3 rounded-xl ${saveLabel === 'Delete' ? 'bg-red-500' : 'bg-indigo-600'}`}>
              <Text className="font-bold text-white">{saveLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
    </KeyboardAvoidingView>
  </Modal>
);

const PasswordInput = ({ value, onChangeText, placeholder, isError }: any) => {
    const [show, setShow] = useState(false);
    return (
        <View className={`flex-row items-center px-4 h-14 mb-3 border bg-slate-50 dark:bg-slate-900 rounded-xl ${isError ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
            <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={!show} placeholderTextColor={isError ? "#f87171" : "#94a3b8"} className={`flex-1 text-base font-bold ${isError ? 'text-red-600' : 'text-slate-900 dark:text-white'}`} />
            <TouchableOpacity onPress={() => setShow(!show)}><HugeiconsIcon icon={show ? ViewIcon : ViewOffSlashIcon} size={20} color={isError ? "#ef4444" : "#94a3b8"} /></TouchableOpacity>
        </View>
    );
};

export default function AccountSecurityScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // ... (State variables same as before) ...
  const [emailModal, setEmailModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpType, setOtpType] = useState<'email_change' | 'delete'>('email_change');
  const [targetEmail, setTargetEmail] = useState(''); 
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passError, setPassError] = useState(false);
  const [samePassError, setSamePassError] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  // ... (Fetch logic same as before) ...
  const fetchUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!emailModal && user?.email) setNewEmail(user.email);
    checkBiometricStatus();
  }, [emailModal]);

  const checkBiometricStatus = async () => {
      try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          setBiometricSupported(hasHardware && isEnrolled);
          const storedSettings = await AsyncStorage.getItem('appSettings');
          if (storedSettings) {
              const settings = JSON.parse(storedSettings);
              setBiometricEnabled(settings.biometricEnabled || false);
          }
      } catch (e) { console.log(e); }
  };

  const toggleBiometrics = async (value: boolean) => {
      if (value) {
          const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm identity' });
          if (!result.success) {
              setAlertConfig({ visible: true, type: 'error', title: 'Failed', message: 'Biometric setup failed.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
              return;
          }
      }
      setBiometricEnabled(value);
      try {
          const stored = await AsyncStorage.getItem('appSettings');
          const settings = stored ? JSON.parse(stored) : {};
          settings.biometricEnabled = value;
          await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
      } catch (e) { console.log(e); }
  };

  useEffect(() => { fetchUser(); }, [fetchUser]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchUser(); setRefreshing(false); }, [fetchUser]);

  // ... (Email Update & Password Update same as before) ...
  const handleInitiateEmailUpdate = async () => {
    setEmailError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailError('Invalid email.'); return; }
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) { setAlertConfig({ visible: true, type: 'error', title: 'No Internet', message: 'Check connection.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) }); return; }
    setEmailModal(false); setLoadingMsg("Sending Code..."); setLoading(true);
    try {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        else { setTargetEmail(newEmail); setOtpType('email_change'); setOtpVisible(true); }
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || newPassword.length < 8) { setPassError(true); return; }
    setPasswordModal(false); setLoadingMsg("Updating..."); setLoading(true);
    try {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (signInError) { setLoading(false); setPassError(true); setPasswordModal(true); return; }
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) setAlertConfig({ visible: true, type: 'error', title: 'Failed', message: error.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        else { setCurrentPassword(''); setNewPassword(''); setAlertConfig({ visible: true, type: 'success', title: 'Success', message: 'Password updated.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) }); }
    } finally { setLoading(false); }
  };

  // --- UPDATED DELETE LOGIC ---
  const handlePreDeleteConfirmation = () => {
      setAlertConfig({ visible: true, type: 'confirmation', title: 'Delete Account?', message: 'This will wipe all your data immediately. We will send a verification code.', confirmText: 'Delete', onConfirm: () => { setAlertConfig((p:any) => ({...p, visible: false})); handleInitiateDelete(); }, onCancel: () => setAlertConfig((p:any) => ({...p, visible: false})) });
  };

  const handleInitiateDelete = async () => {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) { setAlertConfig({ visible: true, type: 'error', title: 'No Internet', message: 'Check connection.', confirmText: 'OK', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) }); return; }
      setLoadingMsg("Sending Code..."); setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithOtp({ email: user.email });
        if (error) { setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) }); } 
        else { setTargetEmail(user.email); setOtpType('delete'); setOtpVisible(true); }
      } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (code: string) => {
      if (otpType === 'email_change') {
          // ... (Email change logic unchanged) ...
          const { error } = await supabase.auth.verifyOtp({ email: newEmail, token: code, type: 'email_change' });
          if (error) return false;
          const { data: { session } } = await supabase.auth.refreshSession();
          if (session?.user) { setUser(session.user); setNewEmail(session.user.email || ''); await supabase.from('profiles').update({ email: newEmail }).eq('id', session.user.id); }
          setOtpVisible(false); setAlertConfig({ visible: true, type: 'success', title: 'Success', message: 'Email updated.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
          return true;
      } else if (otpType === 'delete') {
          // Verify code first
          const { error: verifyError } = await supabase.auth.verifyOtp({ email: user.email, token: code, type: 'email' }); 
          if (verifyError) return false;
          
          setOtpVisible(false); 
          setLoadingMsg("Deleting Data..."); 
          setLoading(true);
          
          try {
              // 1. Manually delete child data to prevent FK errors
              // This is necessary if ON DELETE CASCADE is not set in DB
              const uid = user.id;
              
              // Unlink jobs from profile
              await supabase.from('profiles').update({ current_job_id: null }).eq('id', uid);
              
              // Delete dependent tables
              await supabase.from('attendance').delete().eq('user_id', uid);
              await supabase.from('accomplishments').delete().eq('user_id', uid);
              await supabase.from('report_history').delete().eq('user_id', uid);
              await supabase.from('job_positions').delete().eq('user_id', uid);
              
              // Finally delete profile (this might trigger user deletion if you have a trigger, otherwise we schedule it)
              const { error: delError } = await supabase.from('profiles').delete().eq('id', uid);
              
              if (delError) {
                  throw delError;
              }

              // Sign out immediately
              await supabase.auth.signOut();
              router.replace('/login');
              
          } catch (e: any) {
              setLoading(false);
              setAlertConfig({ visible: true, type: 'error', title: 'Deletion Failed', message: e.message || 'Could not delete data. Contact support.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
          }
          return true;
      }
      return false;
  };

  // ... (Render UI same as before) ...
  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]" edges={['top']}>
      <LoadingOverlay visible={loading} message={loadingMsg} />
      <ModernAlert {...alertConfig} />
      <OtpVerificationModal visible={otpVisible} email={targetEmail} onClose={() => setOtpVisible(false)} onVerify={handleVerifyOtp} onResend={() => {}} title="Verify Action" />
      
      <EditModal visible={emailModal} onClose={() => setEmailModal(false)} title="Change Email" saveLabel="Send Code" onSave={handleInitiateEmailUpdate}>
        <TextInput value={newEmail} onChangeText={setNewEmail} placeholder="New Email" className="p-4 mb-3 text-base font-bold border bg-slate-50 rounded-xl border-slate-200 dark:text-white" />
        {emailError ? <Text className="text-red-500">{emailError}</Text> : null}
      </EditModal>

      <EditModal visible={passwordModal} onClose={() => setPasswordModal(false)} title="Change Password" saveLabel="Update" onSave={handleUpdatePassword}>
        <PasswordInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current Password" isError={passError} />
        <PasswordInput value={newPassword} onChangeText={setNewPassword} placeholder="New Password" isError={passError} />
      </EditModal>

      <Header title="Account & Security" />

      <ScrollView contentContainerStyle={{ padding: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* ... (Login Details, Biometrics, Settings sections - same as previous) ... */}
        
        {/* LOGIN DETAILS */}
        <View className="mb-6">
            <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Login Details</Text>
            <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm">
                <View className="flex-row items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700/50">
                    <View className="flex-row items-center flex-1 gap-3">
                        <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700"><HugeiconsIcon icon={Mail01Icon} size={20} color="#6366f1" /></View>
                        <View className="flex-1"><Text className="text-xs font-medium text-slate-400">Email</Text><Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>{user?.email}</Text></View>
                    </View>
                    <TouchableOpacity onPress={() => setEmailModal(true)} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700"><HugeiconsIcon icon={PencilEdit02Icon} size={18} color="#6366f1" /></TouchableOpacity>
                </View>
                <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center flex-1 gap-3">
                        <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700"><HugeiconsIcon icon={LockKeyIcon} size={20} color="#6366f1" /></View>
                        <View className="flex-1"><Text className="text-xs font-medium text-slate-400">Password</Text><Text className="text-base font-bold text-slate-900 dark:text-white">••••••••</Text></View>
                    </View>
                    <TouchableOpacity onPress={() => setPasswordModal(true)} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700"><HugeiconsIcon icon={PencilEdit02Icon} size={18} color="#6366f1" /></TouchableOpacity>
                </View>
            </View>
        </View>
        
        {/* BIOMETRICS */}
        {biometricSupported && (
            <View className="mb-6">
                <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Security</Text>
                <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm">
                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center flex-1 gap-3">
                            <View className="items-center justify-center w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20"><HugeiconsIcon icon={FingerPrintIcon} size={20} color="#10b981" /></View>
                            <View className="flex-1"><Text className="text-base font-bold text-slate-900 dark:text-white">Biometric Login</Text></View>
                        </View>
                        <Switch value={biometricEnabled} onValueChange={toggleBiometrics} trackColor={{ false: '#e2e8f0', true: '#10b981' }} thumbColor="#fff" />
                    </View>
                </View>
            </View>
        )}

        <View className="mb-6">
            <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Settings</Text>
            <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm">
                 <TouchableOpacity onPress={() => router.push('/settings/notifications')} className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center gap-3">
                        <View className="items-center justify-center w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20"><HugeiconsIcon icon={Notification03Icon} size={20} color="#6366f1" /></View>
                        <Text className="text-base font-bold text-slate-900 dark:text-white">Notification & Permissions</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>

        {/* DELETE ACTION */}
        <View className="mb-6">
            <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Account Actions</Text>
            <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm border border-red-50 dark:border-red-900/20">
                <TouchableOpacity onPress={handlePreDeleteConfirmation} className="flex-row items-center justify-between p-4 active:bg-red-50 dark:active:bg-red-900/10">
                    <View className="flex-row items-center gap-3">
                        <View className="items-center justify-center w-10 h-10 bg-red-100 rounded-full dark:bg-red-900/40"><HugeiconsIcon icon={Delete02Icon} size={20} color="#ef4444" /></View>
                        <View className="flex-1 pr-4"><Text className="font-sans font-bold text-red-500">Delete Account</Text></View>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}