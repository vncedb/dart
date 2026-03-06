import { ArrowLeft02Icon, InformationCircleIcon, LockKeyIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

// Tooltip Component
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
                    <View className="flex-1">
                        <Text className={`text-xs font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Attention Needed</Text>
                        <Text className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{message}</Text>
                    </View>
                </View>
            </View>
        </View>
      </RNAnimated.View>
    );
};

export default function UpdatePassword() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colorScheme } = useColorScheme();
    const insets = useSafeAreaInsets();
    const isDark = colorScheme === 'dark';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [email, setEmail] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    
    const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
    
    // [FIXED] Variable name consistent with usage
    const [activeTooltip, setActiveTooltip] = useState<'password' | 'confirm' | null>(null);
    
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const isRecovery = params.type === 'recovery';

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) setEmail(user.email);
        };
        getUser();

        const backAction = () => {
            if (isRecovery) {
                router.replace('/auth');
            } else {
                router.back();
            }
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [isRecovery, router]);

    // [SECURITY] Strict Password Requirements
    const getPasswordRequirementMissing = (pass: string) => {
        if (pass.length < 8) return "Must be at least 8 characters long.";
        if (!/[A-Z]/.test(pass)) return "Must contain at least one uppercase letter.";
        if (!/[a-z]/.test(pass)) return "Must contain at least one lowercase letter.";
        if (!/[0-9]/.test(pass)) return "Must contain at least one number.";
        // Check for special characters (symbols)
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return "Must contain at least one special character.";
        return null;
    };

    const validate = () => {
        const newErrors: any = {};
        
        // Check specific constraints
        const missingReq = getPasswordRequirementMissing(password);
        if (missingReq) {
            newErrors.password = missingReq;
        }

        // Check matching
        if (password !== confirmPassword) {
            newErrors.confirm = "Passwords do not match.";
        }
        
        setErrors(newErrors);
        
        // Show tooltip for the first error found
        if (newErrors.password) setActiveTooltip('password');
        else if (newErrors.confirm) setActiveTooltip('confirm');
        else setActiveTooltip(null);
        
        return Object.keys(newErrors).length === 0;
    };

    const initiateUpdate = async () => {
        Keyboard.dismiss();
        setActiveTooltip(null);
        
        // [SECURITY] Validate BEFORE sending OTP
        if (!validate()) return;
        
        if (!email) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: "Could not retrieve user email. Please sign in again." });
            return;
        }

        setLoading(true);
        try {
            // Confirm identity via OTP
            const { error } = await supabase.auth.signInWithOtp({ 
                email, 
                options: { shouldCreateUser: false } 
            });
            
            if (error) throw error;
            
            setShowOtp(true);
        } catch (e: any) {
            let msg = e.message;
            if (msg.toLowerCase().includes("signups not allowed")) msg = "Security check failed. Please try logging in again.";
            setAlertConfig({ 
                visible: true, 
                type: 'error', 
                title: 'Security Check Failed', 
                message: msg, 
                onDismiss: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) 
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFinalizeUpdate = async (code: string) => {
        if (!email) return false;
        
        // 1. Verify OTP first
        const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        
        if (verifyError) {
             const { error: retryError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
             if (retryError) return false;
        }

        // 2. Update Password
        try {
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;

            setShowOtp(false);
            
            // Show Success Alert
            setTimeout(() => {
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Success',
                    message: 'Your password has been updated securely.',
                    confirmText: isRecovery ? 'Sign In' : 'Done',
                    onConfirm: () => {
                        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                        if (isRecovery) {
                            router.dismissAll();
                            router.replace('/auth');
                        } else {
                            router.back();
                        }
                    }
                });
            }, 500); 
            return true;
        } catch (e: any) {
            setShowOtp(false); 
            setTimeout(() => {
                setAlertConfig({ visible: true, type: 'error', title: 'Update Failed', message: e.message, onDismiss: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) });
            }, 300);
            return true;
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-slate-900">
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message="Sending Security Code..." />

            <OtpVerificationModal 
                visible={showOtp}
                email={email || ''}
                onClose={() => setShowOtp(false)}
                onVerify={handleFinalizeUpdate}
                onResend={async () => {
                    if(email) await supabase.auth.signInWithOtp({ email });
                }}
            />

            <View className="absolute left-0 right-0 z-50 flex-row items-center justify-between px-6" style={{ top: insets.top + 16 }}>
                <TouchableOpacity onPress={() => isRecovery ? router.replace('/auth') : router.back()} className={`items-center justify-center w-10 h-10 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
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
                        <View className="mb-8">
                            <Text className={`text-3xl font-bold text-left ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {isRecovery ? 'Reset Password' : 'Update Password'}
                            </Text>
                            <Text className={`mt-2 text-left ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {isRecovery 
                                    ? "Create a new strong password for your account." 
                                    : "Enter your new password. We'll send a code to confirm it's you."}
                            </Text>
                        </View>

                        <View className="gap-6">
                            {/* New Password */}
                            <View className="relative z-50 w-full">
                                <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.password ? 'border-red-500' : ''}`}>
                                    <HugeiconsIcon icon={LockKeyIcon} size={22} color={errors.password ? "#ef4444" : "#94a3b8"} />
                                    <TextInput
                                        className={`flex-1 h-full ml-3 font-sans font-medium ${errors.password ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`}
                                        placeholder="New Password" 
                                        placeholderTextColor="#94a3b8" 
                                        secureTextEntry={!showPassword}
                                        value={password} 
                                        onFocus={() => setActiveTooltip(null)} 
                                        onChangeText={(t) => { 
                                            setPassword(t); 
                                            if (errors.password) setErrors((p) => ({...p, password: undefined})); 
                                            setActiveTooltip(null);
                                        }}
                                    />
                                    {/* [FIXED] Correctly toggles activeTooltip */}
                                    <TouchableOpacity onPress={() => errors.password ? setActiveTooltip(activeTooltip === 'password' ? null : 'password') : setShowPassword(!showPassword)}>
                                        <HugeiconsIcon 
                                            icon={errors.password ? InformationCircleIcon : (showPassword ? ViewIcon : ViewOffSlashIcon)} 
                                            size={22} 
                                            color={errors.password ? "#ef4444" : "#94a3b8"} 
                                        />
                                    </TouchableOpacity>
                                </View>
                                {errors.password && activeTooltip === 'password' && <Tooltip message={errors.password} isDark={isDark} />}
                            </View>

                            {/* Confirm Password */}
                            <View className="relative z-40 w-full">
                                <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.confirm ? 'border-red-500' : ''}`}>
                                    <HugeiconsIcon icon={LockKeyIcon} size={22} color={errors.confirm ? "#ef4444" : "#94a3b8"} />
                                    <TextInput
                                        className={`flex-1 h-full ml-3 font-sans font-medium ${errors.confirm ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`}
                                        placeholder="Confirm Password" 
                                        placeholderTextColor="#94a3b8" 
                                        secureTextEntry={!showConfirm}
                                        value={confirmPassword} 
                                        onFocus={() => setActiveTooltip(null)} 
                                        onChangeText={(t) => { 
                                            setConfirmPassword(t); 
                                            if (errors.confirm) setErrors((p) => ({...p, confirm: undefined})); 
                                            setActiveTooltip(null);
                                        }}
                                    />
                                    {/* [FIXED] Correctly toggles activeTooltip */}
                                    <TouchableOpacity onPress={() => errors.confirm ? setActiveTooltip(activeTooltip === 'confirm' ? null : 'confirm') : setShowConfirm(!showConfirm)}>
                                        <HugeiconsIcon 
                                            icon={errors.confirm ? InformationCircleIcon : (showConfirm ? ViewIcon : ViewOffSlashIcon)} 
                                            size={22} 
                                            color={errors.confirm ? "#ef4444" : "#94a3b8"} 
                                        />
                                    </TouchableOpacity>
                                </View>
                                {errors.confirm && activeTooltip === 'confirm' && <Tooltip message={errors.confirm} isDark={isDark} />}
                            </View>

                            <TouchableOpacity onPress={initiateUpdate} disabled={loading} className="flex-row items-center justify-center w-full gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                                <Text className="font-sans text-lg font-bold text-white">
                                    Update Password
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </View>
    );
}