import {
  ArrowLeft02Icon,
  Delete02Icon,
  LockKeyIcon,
  Mail01Icon,
  PencilEdit02Icon,
  ViewIcon,
  ViewOffSlashIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import OtpVerificationModal from '../components/OtpVerificationModal'; // Import
import { supabase } from '../lib/supabase';

// --- SUB-COMPONENT: EDIT MODAL (Generic) ---
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

// --- SUB-COMPONENT: PASSWORD INPUT ---
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
  
  // Modals & State
  const [emailModal, setEmailModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  
  // OTP Modal State
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpType, setOtpType] = useState<'email_change' | 'delete'>('email_change');
  const [targetEmail, setTargetEmail] = useState(''); // Email to show in modal (usually new email or current email)

  // Email State
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passError, setPassError] = useState(false);
  const [samePassError, setSamePassError] = useState(false);

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false, type: 'success', title: '', message: '', onConfirm: () => {} });

  const fetchUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (!emailModal && user?.email) setNewEmail(user.email);
  }, [emailModal]);

  useEffect(() => { fetchUser(); }, [fetchUser]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchUser(); setRefreshing(false); }, [fetchUser]);

  // --- ACTIONS ---

  const handleInitiateEmailUpdate = async () => {
    setEmailError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setEmailError('Please enter a valid email address.'); return; }
    if (user?.email && newEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) { setEmailError('This is already your current email.'); return; }

    setEmailModal(false); setLoadingMsg("Sending Code..."); setLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoading(false);
    
    if (error) setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
    else { 
        setTargetEmail(newEmail);
        setOtpType('email_change');
        setOtpVisible(true);
    }
  };

  const handleUpdatePassword = async () => {
    setPassError(false);
    setSamePassError(false);
    if (!currentPassword) { setPassError(true); return; }
    if (currentPassword === newPassword) { setSamePassError(true); return; }
    if (newPassword.length < 8) { setPassError(true); return; }

    setPasswordModal(false); setLoadingMsg("Updating..."); setLoading(true);
    
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (signInError) { setLoading(false); setPassError(true); setPasswordModal(true); return; }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    
    if (error) setAlertConfig({ visible: true, type: 'error', title: 'Failed', message: error.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
    else { setCurrentPassword(''); setNewPassword(''); setAlertConfig({ visible: true, type: 'success', title: 'Success', message: 'Password changed.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) }); }
  };

  // --- DELETE FLOW ---
  const handlePreDeleteConfirmation = () => {
      setAlertConfig({
          visible: true,
          type: 'confirmation',
          title: 'Are you absolutely sure?',
          message: 'This action is irreversible. We will send a verification code to confirm.',
          confirmText: 'Yes, Delete',
          onConfirm: () => {
              setAlertConfig((p:any) => ({...p, visible: false}));
              handleInitiateDelete();
          },
          onCancel: () => setAlertConfig((p:any) => ({...p, visible: false}))
      });
  };

  const handleInitiateDelete = async () => {
      setLoadingMsg("Sending Verification..."); setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ email: user.email });
      setLoading(false);
      
      if (error) {
          setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
      } else { 
          setTargetEmail(user.email);
          setOtpType('delete');
          setOtpVisible(true);
      }
  };

  // --- UNIVERSAL VERIFY CALLBACK ---
  const handleVerifyOtp = async (code: string) => {
      if (otpType === 'email_change') {
          const { error } = await supabase.auth.verifyOtp({ email: newEmail, token: code, type: 'email_change' });
          if (error) return false;

          const { data: { session } } = await supabase.auth.refreshSession();
          if (session && session.user) {
              setUser(session.user);
              setNewEmail(session.user.email || '');
              await supabase.from('profiles').update({ email: newEmail }).eq('id', session.user.id);
          }
          setOtpVisible(false);
          setAlertConfig({ visible: true, type: 'success', title: 'Success', message: 'Email updated successfully.', confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
          return true;
      } 
      else if (otpType === 'delete') {
          const { error: verifyError } = await supabase.auth.verifyOtp({ email: user.email, token: code, type: 'email' }); // Usually magiclink/email type for this flow
          if (verifyError) return false;

          setOtpVisible(false);
          setLoadingMsg("Deleting Account..."); setLoading(true);
          const deletionDate = new Date(); deletionDate.setDate(deletionDate.getDate() + 30);
          
          const { error: updateError } = await supabase.auth.updateUser({ data: { deletion_scheduled_at: deletionDate.toISOString() } });
          setLoading(false);
          
          if (updateError) {
             setAlertConfig({ visible: true, type: 'error', title: 'Error', message: updateError.message, confirmText: 'OK', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
          } else {
             await supabase.auth.signOut();
             setAlertConfig({ visible: true, type: 'info', title: 'Account Deletion Scheduled', message: `Your account will be deleted in 30 days. Log in before then to cancel.`, confirmText: 'Understood', onConfirm: () => { setAlertConfig((p:any) => ({...p, visible: false})); router.replace('/login'); } });
          }
          return true;
      }
  };

  const handleResendOtp = async () => {
      if (otpType === 'email_change') { await supabase.auth.updateUser({ email: newEmail }); } 
      else { await supabase.auth.signInWithOtp({ email: user.email }); }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]" edges={['top']}>
      <LoadingOverlay visible={loading} message={loadingMsg} />
      <ModernAlert {...alertConfig} />

      {/* --- REUSABLE OTP MODAL --- */}
      <OtpVerificationModal
        visible={otpVisible}
        email={targetEmail}
        onClose={() => setOtpVisible(false)}
        onVerify={handleVerifyOtp}
        onResend={handleResendOtp}
        title={otpType === 'delete' ? 'Confirm Deletion' : 'Verify Email'}
      />

      {/* --- EMAIL EDIT MODAL --- */}
      <EditModal visible={emailModal} onClose={() => setEmailModal(false)} title="Change Email" saveLabel="Send Code" onSave={handleInitiateEmailUpdate}>
        <Text className="mb-4 text-sm text-center text-slate-500">We&apos;ll send a code to the new address.</Text>
        <TextInput 
            value={newEmail} 
            onChangeText={(t) => { setNewEmail(t); setEmailError(''); }} 
            placeholder="New Email" 
            keyboardType="email-address" 
            autoCapitalize="none"
            className={`p-4 mb-3 text-base font-bold bg-slate-50 border rounded-xl placeholder-slate-400 ${emailError ? 'border-red-500 text-red-500' : 'border-slate-200 text-slate-900 dark:text-white'}`} 
            placeholderTextColor="#94a3b8" 
        />
        {emailError ? <Text className="mb-2 text-xs font-bold text-center text-red-500">{emailError}</Text> : null}
      </EditModal>

      {/* --- PASSWORD MODAL --- */}
      <EditModal visible={passwordModal} onClose={() => setPasswordModal(false)} title="Change Password" saveLabel="Update" onSave={handleUpdatePassword}>
        <PasswordInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current Password" isError={passError} />
        <PasswordInput value={newPassword} onChangeText={(t: string) => { setNewPassword(t); setSamePassError(false); setPassError(false); }} placeholder="New Password" isError={passError || samePassError} />
        {samePassError && <Text className="mt-2 text-xs font-bold text-center text-red-500">New password cannot be the same as the current password.</Text>}
        {passError && !samePassError && <Text className="mt-2 text-xs font-bold text-center text-red-500">Requirements: 8+ chars, Upper, Lower, Digit, Symbol</Text>}
      </EditModal>

      {/* HEADER */}
      <View className="z-10 flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800"><HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" /></TouchableOpacity>
        <Text className="flex-1 mx-4 font-sans text-xl font-bold text-center text-slate-900 dark:text-white" numberOfLines={1}>Account & Security</Text>
        <View className="w-10" /> 
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* LOGIN DETAILS */}
        <View className="mb-6">
            <Text className="mb-3 ml-1 text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Login Details</Text>
            <View className="bg-white dark:bg-slate-800 rounded-[24px] overflow-hidden shadow-sm">
                <View className="flex-row items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700/50">
                    <View className="flex-row items-center flex-1 gap-3 pr-2">
                        <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700"><HugeiconsIcon icon={Mail01Icon} size={20} color="#6366f1" /></View>
                        <View className="flex-1"><Text className="text-xs font-medium text-slate-400">Email Address</Text><Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>{user?.email}</Text></View>
                    </View>
                    <TouchableOpacity onPress={() => setEmailModal(true)} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700"><HugeiconsIcon icon={PencilEdit02Icon} size={18} color="#6366f1" /></TouchableOpacity>
                </View>
                <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center flex-1 gap-3 pr-2">
                        <View className="items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700"><HugeiconsIcon icon={LockKeyIcon} size={20} color="#6366f1" /></View>
                        <View className="flex-1"><Text className="text-xs font-medium text-slate-400">Password</Text><Text className="text-base font-bold text-slate-900 dark:text-white">••••••••••••</Text></View>
                    </View>
                    <TouchableOpacity onPress={() => setPasswordModal(true)} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700"><HugeiconsIcon icon={PencilEdit02Icon} size={18} color="#6366f1" /></TouchableOpacity>
                </View>
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