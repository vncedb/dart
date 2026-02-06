// Aligned UI with Settings: Modern animations, removed redundant divider
import {
    Alert02Icon,
    ArrowRight01Icon,
    BiometricAccessIcon,
    LockKeyIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import OtpVerificationModal from '../../components/OtpVerificationModal';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

// --- Modern Settings Item (Standardized) ---
const ModernSettingsItem = ({ icon, label, desc, onPress, rightElement, destructive, isLast, theme }: any) => {
    const scaleValue = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.spring(scaleValue, { toValue: 0.97, useNativeDriver: true, speed: 20 }).start();
    };

    const onPressOut = () => {
        Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
    };

    return (
        <View>
            <Pressable 
                onPress={onPress} 
                onPressIn={onPress ? onPressIn : undefined} 
                onPressOut={onPress ? onPressOut : undefined}
                disabled={!onPress}
            >
                <Animated.View style={{ 
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    transform: [{ scale: scaleValue }]
                }}>
                    <View style={{ 
                        width: 36, height: 36, borderRadius: 10, 
                        backgroundColor: destructive ? '#fee2e2' : theme.colors.background, 
                        alignItems: 'center', justifyContent: 'center', marginRight: 12 
                    }}>
                        <HugeiconsIcon icon={icon} size={18} color={destructive ? '#ef4444' : (onPress || rightElement ? theme.colors.primary : theme.colors.textSecondary)} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: destructive ? '#ef4444' : theme.colors.text }}>{label}</Text>
                        {desc && <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{desc}</Text>}
                    </View>
                    {rightElement ? rightElement : (onPress && <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.textSecondary} />)}
                </Animated.View>
            </Pressable>
            {!isLast && <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginVertical: 4 }} />}
        </View>
    );
};

// --- DELETE CONFIRMATION MODAL ---
const DeleteConfirmationModal = ({ visible, onClose, onConfirm }: any) => {
    const theme = useAppTheme();
    const [timer, setTimer] = useState(10);

    useEffect(() => {
        let interval: any;
        if (visible) {
            setTimer(10);
            interval = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) { clearInterval(interval); return 0; }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <View style={{ width: '100%', backgroundColor: theme.colors.card, borderRadius: 28, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 }}>
                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20 }}>
                        <HugeiconsIcon icon={Alert02Icon} size={32} color="#ef4444" />
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: '800', textAlign: 'center', color: theme.colors.text, marginBottom: 12 }}>Delete Account?</Text>
                    <Text style={{ fontSize: 15, textAlign: 'center', color: theme.colors.textSecondary, lineHeight: 22, marginBottom: 24 }}>
                        You are about to permanently delete your account. This action <Text style={{ fontWeight: 'bold', color: '#ef4444' }}>cannot be undone</Text>. {"\n\n"}
                        All your data including attendance logs, reports, jobs, and settings will be wiped from this device and our servers immediately.
                    </Text>
                    <View style={{ gap: 12 }}>
                        <TouchableOpacity onPress={onConfirm} disabled={timer > 0} style={{ backgroundColor: timer > 0 ? theme.colors.border : '#ef4444', paddingVertical: 16, borderRadius: 16, alignItems: 'center', opacity: timer > 0 ? 0.7 : 1 }}>
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{timer > 0 ? `Wait ${timer}s` : 'Delete Account'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onClose} style={{ paddingVertical: 16, alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default function AccountSecurityScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { signOut, user } = useAuth();
    
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [biometricSupported, setBiometricSupported] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [otpVisible, setOtpVisible] = useState(false);

    useEffect(() => { checkBiometrics(); }, []);

    const checkBiometrics = async () => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        setBiometricSupported(compatible);
        if (compatible) {
            const savedSetting = await AsyncStorage.getItem('appSettings');
            if (savedSetting) {
                const parsed = JSON.parse(savedSetting);
                if (parsed.biometricEnabled) setBiometricEnabled(true);
            }
        }
    };

    const toggleBiometric = async (value: boolean) => {
        if (value) {
            const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to enable biometrics', fallbackLabel: 'Use Passcode' });
            if (result.success) {
                setBiometricEnabled(true);
                updateSetting(true);
            } else {
                setAlertConfig({ visible: true, type: 'error', title: 'Authentication Failed', message: 'Could not enable biometrics.', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) });
                setBiometricEnabled(false);
            }
        } else {
            setBiometricEnabled(false);
            updateSetting(false);
        }
    };

    const updateSetting = async (val: boolean) => {
        try {
            const stored = await AsyncStorage.getItem('appSettings');
            const settings = stored ? JSON.parse(stored) : {};
            settings.biometricEnabled = val;
            await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
        } catch (e) { console.error(e); }
    };

    // --- Biometric Guard for Password Change ---
    const handleChangePassword = async () => {
        if (biometricEnabled && biometricSupported) {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Verify identity to change password',
                fallbackLabel: 'Use Passcode'
            });
            if (!result.success) return; 
        }
        router.push('/auth/update-password');
    };

    const handleDeleteRequest = async () => {
        if (biometricEnabled && biometricSupported) {
            const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to delete account', fallbackLabel: 'Use Passcode' });
            if (!result.success) {
                setAlertConfig({ visible: true, type: 'error', title: 'Verification Failed', message: 'Biometric authentication required to proceed.', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) });
                return;
            }
        }
        setDeleteModalVisible(true);
    };

    const handleConfirmDelete = async () => {
        setDeleteModalVisible(false);
        setLoading(true);
        setLoadingMsg("Sending Verification Code...");
        try {
            if (!user?.email) throw new Error("No user email found.");
            const { error } = await supabase.auth.signInWithOtp({ email: user.email });
            if (error) throw error;
            setOtpVisible(true);
        } catch (error: any) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        } finally { setLoading(false); }
    };

    const handleVerifyOtp = async (code: string) => {
        const { error: verifyError } = await supabase.auth.verifyOtp({ email: user?.email || '', token: code, type: 'magiclink' });
        if (verifyError) return false;
        setOtpVisible(false);
        setLoading(true);
        setLoadingMsg("Deleting Account...");
        try {
            const userId = user?.id;
            if (!userId) throw new Error("User ID missing.");
            const db = await getDB();
            await db.runAsync('DELETE FROM attendance WHERE user_id = ?', [userId]);
            await db.runAsync('DELETE FROM accomplishments WHERE user_id = ?', [userId]);
            await db.runAsync('DELETE FROM saved_reports WHERE user_id = ?', [userId]);
            await db.runAsync('DELETE FROM job_positions WHERE user_id = ?', [userId]);
            await db.runAsync('DELETE FROM profiles WHERE id = ?', [userId]);
            const { error: fnError } = await supabase.functions.invoke('delete-user');
            if (fnError) console.error("Cloud delete failed, local data wiped.");
            setLoading(false);
            setAlertConfig({
                visible: true, type: 'success', title: 'Account Deleted', message: 'Your account has been permanently removed.', confirmText: 'Done',
                onConfirm: async () => { setAlertConfig((prev: any) => ({ ...prev, visible: false })); await signOut(); router.replace('/'); }
            });
            return true;
        } catch (error: any) {
            setLoading(false);
            setAlertConfig({ visible: true, type: 'error', title: 'Deletion Incomplete', message: 'Local data cleared, cloud error. Contact support.', onConfirm: () => { setAlertConfig((p:any) => ({...p, visible: false})); router.replace('/'); } });
            return true;
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="Account & Security" showBack />
            <LoadingOverlay visible={loading} message={loadingMsg} />
            <ModernAlert {...alertConfig} />
            <DeleteConfirmationModal visible={deleteModalVisible} onClose={() => setDeleteModalVisible(false)} onConfirm={handleConfirmDelete} />
            <OtpVerificationModal visible={otpVisible} email={user?.email || ''} onClose={() => setOtpVisible(false)} onVerify={handleVerifyOtp} onResend={async () => { await supabase.auth.signInWithOtp({ email: user?.email || '' }) }} title="Verify Deletion" message="Enter code to confirm deletion" />

            <ScrollView contentContainerStyle={{ padding: 24 }}>
                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionTitle}>LOGIN SECURITY</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        {biometricSupported && (
                            <ModernSettingsItem 
                                icon={BiometricAccessIcon} 
                                label="Biometric Unlock" 
                                desc="Use FaceID/TouchID to open app" 
                                theme={theme}
                                rightElement={
                                    <Switch value={biometricEnabled} onValueChange={toggleBiometric} trackColor={{ false: theme.colors.border, true: theme.colors.success }} thumbColor={'#fff'} style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} />
                                } 
                            />
                        )}
                        <ModernSettingsItem 
                            icon={LockKeyIcon} 
                            label="Change Password" 
                            desc="Update your login credentials" 
                            onPress={handleChangePassword} 
                            isLast 
                            theme={theme} 
                        />
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionTitle}>DANGER ZONE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                         <ModernSettingsItem 
                            icon={Alert02Icon} 
                            label="Delete Account" 
                            desc="Permanently remove all data" 
                            onPress={handleDeleteRequest} 
                            destructive 
                            isLast 
                            theme={theme} 
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', opacity: 0.7, color: '#64748b' },
    card: { borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
});