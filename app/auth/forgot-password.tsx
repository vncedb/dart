import { ArrowLeft02Icon, ArrowRight01Icon, InformationCircleIcon, Mail01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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
import { ModernAlert } from '../../components/ModernUI';
import OtpVerificationModal from '../../components/OtpVerificationModal';
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

export default function ForgotPassword() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const insets = useSafeAreaInsets();
    const isDark = colorScheme === 'dark';

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showTooltip, setShowTooltip] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [lastOtpSent, setLastOtpSent] = useState(0);

    const handleSendCode = async () => {
        Keyboard.dismiss();
        setError('');
        setShowTooltip(false);

        const now = Date.now();
        const cooldown = 30000;
        const timeElapsed = now - lastOtpSent;

        if (lastOtpSent > 0 && timeElapsed < cooldown) {
            setAlertConfig({ visible: true, type: 'error', title: 'Please Wait', message: `Wait ${Math.ceil((cooldown - timeElapsed) / 1000)}s before resending.` });
            return;
        }

        if (!email.includes('@')) { setError("Invalid email address."); setShowTooltip(true); return; }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
            if (error) throw new Error(error.message);
            setLastOtpSent(Date.now());
            setShowOtp(true);
        } catch (error: any) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        } finally { setLoading(false); }
    };

    return (
        <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingTop: insets.top }}>
            <ModernAlert {...alertConfig} />
            <OtpVerificationModal 
                visible={showOtp} 
                email={email} 
                onClose={() => setShowOtp(false)}
                onVerify={async (code: string) => {
                    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
                    if (error) return false;
                    setShowOtp(false);
                    router.replace({ pathname: '/auth/update-password', params: { from: 'login' } });
                    return true;
                }}
                onResend={async () => { await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }); }}
            />

            {/* HEADER */}
            <View className="absolute left-0 right-0 z-50 flex-row items-center justify-between px-6" style={{ top: insets.top + 16 }}>
                <TouchableOpacity onPress={() => router.back()} className={`items-center justify-center w-10 h-10 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
                <Image source={isDark ? require('../../assets/images/icon-transparent-white.png') : require('../../assets/images/icon-transparent.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
            </View>

            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowTooltip(false); }}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 px-8">
                    
                    {/* CONTAINER - Replaced centered View with top-aligned structure */}
                    <View className="w-full mt-30">
                        
                        {/* TITLE - Matched with Auth.tsx */}
                        <View className="mb-8">
                            <Text className={`text-3xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                Forgot Password
                            </Text>
                            <Text className={`mt-2 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Enter your email to receive a verification code.
                            </Text>
                        </View>

                        <View className="gap-6">
                            <View className="relative z-50 w-full">
                                <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${error ? 'border-red-500' : ''}`}>
                                    <HugeiconsIcon icon={Mail01Icon} size={22} color={error ? "#ef4444" : "#94a3b8"} />
                                    <TextInput
                                        className={`flex-1 h-full ml-3 font-sans font-medium ${error ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`}
                                        placeholder="Email Address" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address"
                                        value={email} onFocus={() => setShowTooltip(false)} onChangeText={(t) => { setEmail(t); setError(''); }}
                                    />
                                    {error && (
                                        <TouchableOpacity onPress={() => setShowTooltip(!showTooltip)}>
                                            <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {error && showTooltip && <AnimatedTooltip message={error} isDark={isDark} />}
                            </View>

                            <TouchableOpacity onPress={handleSendCode} disabled={loading} className="flex-row items-center justify-center w-full gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                                {loading ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <Text className="font-sans text-lg font-bold text-white">Send Code</Text>
                                        <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="white" strokeWidth={2.5} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </View>
    );
}