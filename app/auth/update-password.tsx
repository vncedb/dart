// Footer Fixed Bottom, Outside Keyboard Avoiding View
import {
    InformationCircleIcon,
    LockKeyIcon,
    Tick01Icon,
    ViewIcon,
    ViewOffSlashIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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

import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

// ... (Tooltip and Validate functions same as before) ...
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

export default function UpdatePasswordScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { user } = useAuth();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    
    const [errors, setErrors] = useState<any>({});
    const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);

    const validate = () => {
        const newErrors: any = {};
        let isValid = true;

        if (!currentPassword) { newErrors.current = "Current password is required."; isValid = false; }
        if (newPassword.length < 6) { newErrors.new = "Password must be at least 6 characters."; isValid = false; }
        if (newPassword !== confirmPassword) { newErrors.confirm = "Passwords do not match."; isValid = false; }

        setErrors(newErrors);
        if (newErrors.current) setVisibleTooltip('current');
        else if (newErrors.new) setVisibleTooltip('new');
        else if (newErrors.confirm) setVisibleTooltip('confirm');

        return isValid;
    };

    const handleUpdate = async () => {
        Keyboard.dismiss();
        setVisibleTooltip(null);
        if (!validate() || !user?.email) return;

        setLoading(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ 
                email: user.email, 
                password: currentPassword 
            });

            if (signInError) {
                setErrors({ current: "Incorrect password." });
                setVisibleTooltip('current');
                setLoading(false);
                return;
            }

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

            if (updateError) throw updateError;

            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Password Updated',
                message: 'Your password has been changed successfully.',
                confirmText: 'Done',
                onConfirm: () => {
                    setAlertConfig((p: any) => ({ ...p, visible: false }));
                    router.back();
                }
            });

        } catch (e: any) {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Update Failed',
                message: e.message || "An error occurred.",
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    const PasswordInput = ({ label, value, onChange, show, toggleShow, errorKey, placeholder }: any) => {
        const isError = errorKey && errors[errorKey];
        const showTooltip = errorKey && visibleTooltip === errorKey;

        return (
            <View style={{ marginBottom: 20, zIndex: showTooltip ? 50 : 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
                    {label} <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <View style={{ position: 'relative' }}>
                    <View style={{ 
                        flexDirection: 'row', alignItems: 'center', 
                        backgroundColor: theme.colors.card, 
                        borderRadius: 16, borderWidth: 1, 
                        borderColor: isError ? '#ef4444' : theme.colors.border,
                        height: 56, paddingHorizontal: 16 
                    }}>
                        <HugeiconsIcon icon={LockKeyIcon} size={22} color={isError ? "#ef4444" : theme.colors.textSecondary} />
                        <TextInput 
                            value={value} 
                            onChangeText={(t) => { onChange(t); if(errorKey) { setErrors((p:any) => ({...p, [errorKey]: undefined})); setVisibleTooltip(null); }}} 
                            style={{ flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: theme.colors.text }} 
                            placeholder={placeholder} 
                            placeholderTextColor={theme.colors.textSecondary}
                            secureTextEntry={!show}
                            onFocus={() => setVisibleTooltip(null)}
                        />
                        <TouchableOpacity onPress={toggleShow}>
                            <HugeiconsIcon icon={show ? ViewIcon : ViewOffSlashIcon} size={22} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                        
                        {isError && (
                            <TouchableOpacity onPress={() => setVisibleTooltip(showTooltip ? null : errorKey)} style={{ marginLeft: 8 }}>
                                <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {showTooltip && <Tooltip message={errors[errorKey]} theme={theme} />}
                </View>
            </View>
        );
    };

    return (
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setVisibleTooltip(null); }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
                <Header title="Change Password" showBack />
                <LoadingOverlay visible={loading} message="Updating Password..." />
                <ModernAlert {...alertConfig} />

                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={{ flex: 1 }}
                >
                    <ScrollView 
                        contentContainerStyle={{ padding: 24 }} 
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            
                            <PasswordInput 
                                label="Current Password" 
                                value={currentPassword} 
                                onChange={setCurrentPassword} 
                                show={showCurrent} 
                                toggleShow={() => setShowCurrent(!showCurrent)} 
                                errorKey="current" 
                                placeholder="Enter current password"
                            />

                            <View style={{ alignItems: 'flex-end', marginTop: -12, marginBottom: 20 }}>
                                <TouchableOpacity onPress={() => router.push('/auth/forgot-password')} style={{ paddingVertical: 4 }}>
                                    <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginBottom: 20 }} />

                            <PasswordInput 
                                label="New Password" 
                                value={newPassword} 
                                onChange={setNewPassword} 
                                show={showNew} 
                                toggleShow={() => setShowNew(!showNew)} 
                                errorKey="new" 
                                placeholder="Enter new password"
                            />

                            <PasswordInput 
                                label="Confirm New Password" 
                                value={confirmPassword} 
                                onChange={setConfirmPassword} 
                                show={showConfirm} 
                                toggleShow={() => setShowConfirm(!showConfirm)} 
                                errorKey="confirm" 
                                placeholder="Confirm new password"
                            />

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
                
                <Footer>
                    <TouchableOpacity onPress={handleUpdate} disabled={loading} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, height: 56, borderRadius: 16, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginRight: 8 }}>Update Password</Text>
                        <HugeiconsIcon icon={Tick01Icon} size={20} color="white" strokeWidth={2.5} />
                    </TouchableOpacity>
                </Footer>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}