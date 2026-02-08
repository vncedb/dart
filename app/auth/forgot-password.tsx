import { ArrowLeft02Icon, ArrowRight01Icon, CheckmarkCircle02Icon, InformationCircleIcon, LockKeyIcon, Mail01Icon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Animated as RNAnimated,
    Easing as RNEasing,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import OtpVerificationModal from '../../components/OtpVerificationModal';
import { supabase } from '../../lib/supabase';

// Reusing Tooltip for consistency
const Tooltip = ({ message, isDark }: { message: string, isDark: boolean }) => {
    const fadeAnim = useRef(new RNAnimated.Value(0)).current; 
    const slideAnim = useRef(new RNAnimated.Value(15)).current; 
    useEffect(() => {
      RNAnimated.parallel([
        RNAnimated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: RNEasing.out(RNEasing.back(1.5)) }),
        RNAnimated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true, easing: RNEasing.out(RNEasing.cubic) }),
      ]).start();
    }, [fadeAnim, slideAnim]);
    return (
      <RNAnimated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }} className="absolute right-0 z-50 w-64 mt-2 top-full">
        <View className="w-full">
            <View className={`absolute right-[20px] -top-2 w-4 h-4 rotate-45 ${isDark ? 'bg-slate-700' : 'bg-white'} border-l border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`} />
            <View className={`p-4 rounded-xl shadow-xl border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                <View className="flex-row items-start gap-3">
                    <HugeiconsIcon icon={InformationCircleIcon} size={18} color="#ef4444" />
                    <View className="flex-1"><Text className={`text-xs font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Attention Needed</Text><Text className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{message}</Text></View>
                </View>
            </View>
        </View>
      </RNAnimated.View>
    );
};

export default function ForgotPassword() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const insets = useSafeAreaInsets();
    const isDark = colorScheme === 'dark';

    // Steps: 'email' -> 'reset'
    const [step, setStep] = useState<'email' | 'reset'>('email');

    // Email State
    const [email, setEmail] = useState('');
    
    // Password State
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // UX State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTooltip, setActiveTooltip] = useState<'email' | 'password' | 'confirm' | null>(null);
    const [showOtp, setShowOtp] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [lastOtpSent, setLastOtpSent] = useState(0);

    // Validation Regex
    const getPasswordRequirementMissing = (pass: string) => {
        if (pass.length < 8) return "Must be at least 8 characters long.";
        if (!/[A-Z]/.test(pass)) return "Must contain at least one uppercase letter.";
        if (!/[a-z]/.test(pass)) return "Must contain at least one lowercase letter.";
        if (!/[0-9]/.test(pass)) return "Must contain at least one number.";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return "Must contain at least one special character.";
        return null;
    };

    useEffect(() => {
        const backAction = () => {
            if (step === 'reset') {
                // If in reset mode, confirm before exiting? Or just go back to email
                setStep('email');
                return true;
            }
            router.back();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [step]);

    // --- STEP 1: SEND EMAIL ---
    const handleSendCode = async () => {
        Keyboard.dismiss();
        setError('');
        setActiveTooltip(null);

        const now = Date.now();
        const cooldown = 30000;
        const timeElapsed = now - lastOtpSent;

        if (lastOtpSent > 0 && timeElapsed < cooldown) {
            setAlertConfig({ visible: true, type: 'error', title: 'Please Wait', message: `Wait ${Math.ceil((cooldown - timeElapsed) / 1000)}s before resending.` });
            return;
        }

        if (!email.includes('@') || !email.includes('.')) { 
            setError("Invalid email address."); 
            setActiveTooltip('email'); 
            return; 
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({ 
                email, 
                options: { shouldCreateUser: false } 
            });
            
            if (error) throw error;
            
            setLastOtpSent(Date.now());
            setShowOtp(true);
        } catch (error: any) {
            let msg = error.message;
            if (msg.toLowerCase().includes("signups not allowed")) {
                msg = "Account not found. Please check your email.";
            }
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: msg, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        } finally { setLoading(false); }
    };

    // --- STEP 2: VERIFY & SWITCH TO RESET ---
    const handleVerifyOtp = async (code: string) => {
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
        if (error) return false;
        
        setShowOtp(false);
        // OTP Verified & Logged In (Temporary session) -> Switch to Reset Form
        setStep('reset'); 
        return true;
    };

    // --- STEP 3: RESET PASSWORD ---
    const handleResetPassword = async () => {
        Keyboard.dismiss();
        setActiveTooltip(null);

        const missingReq = getPasswordRequirementMissing(password);
        if (missingReq) { setError(missingReq); setActiveTooltip('password'); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); setActiveTooltip('confirm'); return; }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;

            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Password Reset',
                message: 'Your password has been reset successfully. You can now sign in.',
                confirmText: 'Back to Sign In',
                onConfirm: () => {
                    setAlertConfig((p: any) => ({ ...p, visible: false }));
                    router.dismissAll();
                    router.replace('/auth');
                }
            });
        } catch (e: any) {
            setAlertConfig({ visible: true, type: 'error', title: 'Reset Failed', message: e.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-slate-900">
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message={step === 'email' ? "Sending Code..." : "Resetting Password..."} />
            
            <OtpVerificationModal 
                visible={showOtp} 
                email={email} 
                onClose={() => setShowOtp(false)}
                onVerify={handleVerifyOtp}
                onResend={async () => { await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }); }}
            />

            {/* HEADER */}
            <View className="absolute left-0 right-0 z-50 flex-row items-center justify-between px-6" style={{ top: insets.top + 16 }}>
                <TouchableOpacity onPress={() => step === 'reset' ? setStep('email') : router.back()} className={`items-center justify-center w-10 h-10 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
            </View>

            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setActiveTooltip(null); }}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    className="flex-1 px-8"
                    style={{ paddingTop: insets.top + 100 }}
                >
                    <View className="w-full">
                        {/* TITLE */}
                        <View className="mb-8">
                            <Text className={`text-3xl font-bold text-left ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {step === 'email' ? 'Forgot Password' : 'Reset Password'}
                            </Text>
                            <Text className={`mt-2 text-left ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {step === 'email' 
                                    ? "Enter your email to receive a verification code." 
                                    : "Create a new strong password for your account."}
                            </Text>
                        </View>

                        {/* FORM: EMAIL STEP */}
                        {step === 'email' && (
                            <View className="gap-6">
                                <View className="relative z-50 w-full">
                                    <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${error && activeTooltip === 'email' ? 'border-red-500' : ''}`}>
                                        <HugeiconsIcon icon={Mail01Icon} size={22} color={error && activeTooltip === 'email' ? "#ef4444" : "#94a3b8"} />
                                        <TextInput
                                            className={`flex-1 h-full ml-3 font-sans font-medium ${error && activeTooltip === 'email' ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`}
                                            placeholder="Email Address" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address"
                                            value={email} onFocus={() => setActiveTooltip(null)} onChangeText={(t) => { setEmail(t); setError(''); }}
                                        />
                                        {error && activeTooltip === 'email' && (
                                            <TouchableOpacity onPress={() => setActiveTooltip(null)}>
                                                <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {error && activeTooltip === 'email' && <Tooltip message={error} isDark={isDark} />}
                                </View>

                                <TouchableOpacity onPress={handleSendCode} disabled={loading} className="flex-row items-center justify-center w-full gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                                    <Text className="font-sans text-lg font-bold text-white">Send Code</Text>
                                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="white" strokeWidth={2.5} />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* FORM: RESET PASSWORD STEP */}
                        {step === 'reset' && (
                            <View className="gap-6">
                                {/* New Password */}
                                <View className="relative z-50 w-full">
                                    <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${error && activeTooltip === 'password' ? 'border-red-500' : ''}`}>
                                        <HugeiconsIcon icon={LockKeyIcon} size={22} color={error && activeTooltip === 'password' ? "#ef4444" : "#94a3b8"} />
                                        <TextInput
                                            className={`flex-1 h-full ml-3 font-sans font-medium ${error && activeTooltip === 'password' ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`}
                                            placeholder="New Password" placeholderTextColor="#94a3b8" secureTextEntry={!showPassword}
                                            value={password} onFocus={() => setActiveTooltip(null)} onChangeText={(t) => { setPassword(t); setError(''); }}
                                        />
                                        <TouchableOpacity onPress={() => error && activeTooltip === 'password' ? setActiveTooltip(null) : setShowPassword(!showPassword)}>
                                            <HugeiconsIcon icon={error && activeTooltip === 'password' ? InformationCircleIcon : (showPassword ? ViewIcon : ViewOffSlashIcon)} size={22} color={error && activeTooltip === 'password' ? "#ef4444" : "#94a3b8"} />
                                        </TouchableOpacity>
                                    </View>
                                    {error && activeTooltip === 'password' && <Tooltip message={error} isDark={isDark} />}
                                </View>

                                {/* Confirm Password */}
                                <View className="relative z-40 w-full">
                                    <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${error && activeTooltip === 'confirm' ? 'border-red-500' : ''}`}>
                                        <HugeiconsIcon icon={LockKeyIcon} size={22} color={error && activeTooltip === 'confirm' ? "#ef4444" : "#94a3b8"} />
                                        <TextInput
                                            className={`flex-1 h-full ml-3 font-sans font-medium ${error && activeTooltip === 'confirm' ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`}
                                            placeholder="Confirm Password" placeholderTextColor="#94a3b8" secureTextEntry={!showConfirm}
                                            value={confirmPassword} onFocus={() => setActiveTooltip(null)} onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                                        />
                                        <TouchableOpacity onPress={() => error && activeTooltip === 'confirm' ? setActiveTooltip(null) : setShowConfirm(!showConfirm)}>
                                            <HugeiconsIcon icon={error && activeTooltip === 'confirm' ? InformationCircleIcon : (showConfirm ? ViewIcon : ViewOffSlashIcon)} size={22} color={error && activeTooltip === 'confirm' ? "#ef4444" : "#94a3b8"} />
                                        </TouchableOpacity>
                                    </View>
                                    {error && activeTooltip === 'confirm' && <Tooltip message={error} isDark={isDark} />}
                                </View>

                                <TouchableOpacity onPress={handleResetPassword} disabled={loading} className="flex-row items-center justify-center w-full gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                                    <Text className="font-sans text-lg font-bold text-white">Reset Password</Text>
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="white" strokeWidth={2.5} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </View>
    );
}