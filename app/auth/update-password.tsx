import { ArrowLeft02Icon, ArrowRight01Icon, InformationCircleIcon, LockKeyIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModernAlert } from '../../components/ModernUI';
import { supabase } from '../../lib/supabase';

const AnimatedTooltip = ({ message, isDark }: { message: string, isDark: boolean }) => {
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
        <TouchableWithoutFeedback>
          <View className="w-full">
              <View className={`absolute right-[20px] -top-2 w-4 h-4 rotate-45 ${isDark ? 'bg-slate-700' : 'bg-white'} border-l border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`} />
              <View className={`p-4 rounded-xl shadow-xl border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                  <View className="flex-row items-start gap-3">
                      <View className="mt-1"><HugeiconsIcon icon={InformationCircleIcon} size={18} color="#ef4444" /></View>
                      <View className="flex-1">
                          <Text className={`text-xs font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Attention Needed</Text>
                          <Text className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{message}</Text>
                      </View>
                  </View>
              </View>
          </View>
        </TouchableWithoutFeedback>
      </RNAnimated.View>
    );
};

export default function UpdatePasswordScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{password?: string, confirmPassword?: string}>({});
    const [activeTooltip, setActiveTooltip] = useState<'password' | 'confirmPassword' | null>(null);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const isSignupFlow = params.flow === 'signup';
    const fromSource = params.from; 

    const validate = () => {
        let newErrors: any = {};
        let isValid = true;

        if (password.length < 8) newErrors.password = "Min 8 chars.";
        else if (!/[A-Z]/.test(password)) newErrors.password = "Needs 1 uppercase.";
        else if (!/[a-z]/.test(password)) newErrors.password = "Needs 1 lowercase.";
        else if (!/[0-9]/.test(password)) newErrors.password = "Needs 1 number.";
        else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) newErrors.password = "Needs 1 special char.";

        if (password !== confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match.";
        }

        if (newErrors.password) isValid = false;
        if (newErrors.confirmPassword) isValid = false;

        setErrors(newErrors);
        
        if (newErrors.password) setActiveTooltip('password');
        else if (newErrors.confirmPassword) setActiveTooltip('confirmPassword');
        else setActiveTooltip(null);

        return isValid;
    };

    const handleBack = async () => {
        if (fromSource === 'settings') {
            router.back();
        } else {
            // Sign out to prevent redirect loop to Onboarding, then go back to Forgot Password
            await supabase.auth.signOut();
            router.back();
        }
    };

    const handleUpdate = async () => {
        Keyboard.dismiss();
        setActiveTooltip(null);
        if (!validate()) return;

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: password });
            if (updateError) throw updateError;

            if (isSignupFlow) {
                router.replace('/onboarding/welcome');
            } else {
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Password Updated',
                    message: 'Your password has been changed successfully.',
                    onDismiss: async () => {
                        if (fromSource === 'settings') {
                            router.back(); 
                        } else {
                            // Sign out and go to Login Card
                            await supabase.auth.signOut();
                            // Go to index (Login)
                            router.replace('/');
                        }
                    }
                });
            }
        } catch (err: any) {
            setLoading(false);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Error',
                message: err.message,
                onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false}))
            });
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setActiveTooltip(null); }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 p-6 pt-10">
                    <ModernAlert 
                        {...alertConfig} 
                        dismissText={alertConfig.type === 'success' ? (fromSource === 'settings' ? "Done" : "Back to Login") : "Okay"}
                    />

                    <View className="mb-8">
                        {!isSignupFlow && (
                            <TouchableOpacity 
                                onPress={handleBack} 
                                className="items-center justify-center w-10 h-10 mb-6 rounded-full bg-slate-100 dark:bg-slate-800"
                            >
                                <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
                            </TouchableOpacity>
                        )}
                        <Text className="mb-2 text-3xl font-black text-slate-900 dark:text-white">
                            {isSignupFlow ? "Set Password" : "New Password"}
                        </Text>
                        <Text className="text-lg text-slate-500 dark:text-slate-400">
                            Create a strong password to secure your account.
                        </Text>
                    </View>

                    <View className="gap-6">
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
                                    onChangeText={(t) => { setPassword(t); setErrors(prev => ({...prev, password: undefined})); }}
                                />
                                <TouchableOpacity onPress={() => {
                                    if(errors.password) setActiveTooltip(activeTooltip === 'password' ? null : 'password');
                                    else setShowPassword(!showPassword);
                                }}>
                                    <HugeiconsIcon icon={errors.password ? InformationCircleIcon : (showPassword ? ViewIcon : ViewOffSlashIcon)} size={22} color={errors.password ? "#ef4444" : "#94a3b8"} />
                                </TouchableOpacity>
                            </View>
                            {errors.password && activeTooltip === 'password' && <AnimatedTooltip message={errors.password} isDark={isDark} />}
                        </View>

                        <View className="relative z-40 w-full">
                            <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.confirmPassword ? 'border-red-500' : ''}`}>
                                <HugeiconsIcon icon={LockKeyIcon} size={22} color={errors.confirmPassword ? "#ef4444" : "#94a3b8"} />
                                <TextInput
                                    className={`flex-1 h-full ml-3 font-sans font-medium ${errors.confirmPassword ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`}
                                    placeholder="Confirm Password"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={!showConfirm}
                                    value={confirmPassword}
                                    onFocus={() => setActiveTooltip(null)}
                                    onChangeText={(t) => { setConfirmPassword(t); setErrors(prev => ({...prev, confirmPassword: undefined})); }}
                                />
                                <TouchableOpacity onPress={() => {
                                    if(errors.confirmPassword) setActiveTooltip(activeTooltip === 'confirmPassword' ? null : 'confirmPassword');
                                    else setShowConfirm(!showConfirm);
                                }}>
                                    <HugeiconsIcon icon={errors.confirmPassword ? InformationCircleIcon : (showConfirm ? ViewIcon : ViewOffSlashIcon)} size={22} color={errors.confirmPassword ? "#ef4444" : "#94a3b8"} />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && activeTooltip === 'confirmPassword' && <AnimatedTooltip message={errors.confirmPassword} isDark={isDark} />}
                        </View>

                        <TouchableOpacity onPress={handleUpdate} disabled={loading} className="flex-row items-center justify-center w-full gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                            {loading ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Text className="font-sans text-lg font-bold text-white">{isSignupFlow ? "Create Account" : "Update Password"}</Text>
                                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="white" strokeWidth={2.5} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}