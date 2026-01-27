import {
    ArrowLeft02Icon,
    ArrowRight01Icon,
    InformationCircleIcon,
    LockKeyIcon,
    Mail01Icon,
    ViewIcon,
    ViewOffSlashIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernAlert, ModernToast } from '../components/ModernUI';
import OtpVerificationModal from '../components/OtpVerificationModal';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Static Tooltip (No Animation)
const Tooltip = ({ message, isDark }: { message: string, isDark: boolean }) => (
    <View className="absolute right-0 z-50 w-64 mt-2 top-full">
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
    </View>
);

export default function AuthScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [visibleTooltip, setVisibleTooltip] = useState<'email' | 'password' | 'confirmPassword' | null>(null);

  const [showOtp, setShowOtp] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (routeParams.mode === 'signup') setAuthMode('signup');
  }, [routeParams.mode]);

  useEffect(() => {
    const backAction = () => {
        router.replace('/');
        return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  const toggleAuthMode = () => {
    Keyboard.dismiss();
    setErrors({});
    setVisibleTooltip(null);
    setAuthMode(prev => prev === 'login' ? 'signup' : 'login');
  };

  const getPasswordRequirementMissing = (pass: string) => {
      if (pass.length < 8) return "Must be at least 8 characters long.";
      if (!/[A-Z]/.test(pass)) return "Must contain at least one uppercase letter.";
      if (!/[a-z]/.test(pass)) return "Must contain at least one lowercase letter.";
      if (!/[0-9]/.test(pass)) return "Must contain at least one number.";
      return null;
  };

  const handleValidation = () => {
    const newErrors: any = {};
    let valid = true;

    if (!email.includes('@') || !email.includes('.')) { 
        newErrors.email = "Please enter a valid email address."; 
        valid = false; 
    }
    
    if (!password) { 
        newErrors.password = "Password is required."; 
        valid = false; 
    } else if (authMode === 'signup') {
        const missingReq = getPasswordRequirementMissing(password);
        if (missingReq) { newErrors.password = missingReq; valid = false; }
        if (password !== confirmPassword) { newErrors.confirmPassword = "Passwords do not match."; valid = false; }
    }

    setErrors(newErrors);
    
    if (newErrors.email) setVisibleTooltip('email');
    else if (newErrors.password) setVisibleTooltip('password');
    else if (newErrors.confirmPassword) setVisibleTooltip('confirmPassword');
    else setVisibleTooltip(null);

    return valid;
  };

  const checkAppRegistration = async (user: any) => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (!profile) {
          let fullName = '';
          if (user.user_metadata?.full_name) {
              fullName = user.user_metadata.full_name;
          } else {
              const randomNum = Math.floor(1000 + Math.random() * 9000);
              fullName = `User${randomNum}`;
          }

          await supabase.from('profiles').insert([{ 
              id: user.id, 
              email: user.email, 
              full_name: fullName,
              updated_at: new Date()
          }]);
      }
      return true;
  };

  const handleAuthAction = async () => {
    Keyboard.dismiss();
    setErrors({});
    setVisibleTooltip(null);
    if (!handleValidation()) return;

    setLoading(true);

    try {
        if (authMode === 'login') {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
                setLoading(false);
                const msg = error.message.toLowerCase();
                if (msg.includes('invalid login') || msg.includes('credential')) { 
                    setErrors({ password: 'Incorrect email or password.' });
                    setVisibleTooltip('password'); 
                } else if (msg.includes('email not confirmed')) { 
                    setErrors({ email: 'Email not confirmed. Code resent.' }); 
                    setVisibleTooltip('email');
                    await supabase.auth.resend({ type: 'signup', email });
                    setShowOtp(true);
                } else { 
                    setAlertConfig({ visible: true, type: 'error', title: 'Login Failed', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) }); 
                }
            } else {
                if (data.user) {
                    await checkAppRegistration(data.user);
                }
            }
        } 
        else if (authMode === 'signup') {
            // 1. Pre-check: Try to see if this email exists in profiles to prevent fake signup flow
            // This works if RLS allows reading profiles (common in dev).
            const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', email).single();
            
            if (existingProfile) {
                setLoading(false);
                setErrors({ email: 'This email is already registered. Please sign in.' });
                setVisibleTooltip('email');
                return;
            }

            // 2. Proceed with Supabase Signup
            const { data: { session, user }, error } = await supabase.auth.signUp({ email, password });
            
            if (error) {
                setLoading(false);
                if (error.message.toLowerCase().includes('already registered') || error.message.includes('unique constraint')) {
                    setErrors({ email: 'This email is already registered.' });
                    setVisibleTooltip('email');
                } else {
                    setAlertConfig({ visible: true, type: 'error', title: 'Sign Up Failed', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
                }
            } else {
                if (session && user) {
                     await checkAppRegistration(user);
                } else {
                    // Success, but requires verification
                    setLoading(false); 
                    setShowOtp(true);
                }
            }
        }
    } catch (err: any) {
        setLoading(false);
        setAlertConfig({ visible: true, type: 'error', title: 'Error', message: err.message || 'An unexpected error occurred.', onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo = makeRedirectUri({ scheme: 'dartapp', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned from Supabase');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success' && res.url) {
        const paramsStr = res.url.includes('#') ? res.url.split('#')[1] : res.url.split('?')[1];
        const result = QueryParams.getQueryParams('?' + paramsStr);
        const authParams = result.params;
        
        if (authParams['access_token'] && authParams['refresh_token']) {
            const { data: { user }, error: sessionError } = await supabase.auth.setSession({ access_token: authParams['access_token'], refresh_token: authParams['refresh_token'] });
            if (sessionError) throw sessionError;
            if (user) await checkAppRegistration(user);
        }
      }
    } catch (error: any) {
        if (error.message !== 'User cancelled the auth session') {
            setAlertConfig({ visible: true, type: 'error', title: 'Google Sign In Failed', message: error.message || "Could not sign in.", onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        }
    } finally { setGoogleLoading(false); }
  };

  return (
    <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setVisibleTooltip(null); }}>
      <ImageBackground source={require('../assets/images/intro/bgimage.jpeg')} className="flex-1" blurRadius={5}>
        <View className={`absolute inset-0 ${isDark ? 'bg-slate-900/85' : 'bg-slate-50/90'}`} />
        <ModernToast visible={toastVisible} message="Success!" type="success" />
        <ModernAlert {...alertConfig} />
        
        <OtpVerificationModal 
            visible={showOtp} 
            email={email} 
            onClose={() => setShowOtp(false)} 
            onVerify={async (code: string) => {
                const { data: { session }, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
                if(error) return false;
                setShowOtp(false);
                if (session?.user) {
                    supabase.functions.invoke('send-email', { body: { email: session.user.email, type: 'WELCOME' } });
                    await checkAppRegistration(session.user);
                }
                return true;
            }}
            onResend={async () => { await supabase.auth.resend({ type: 'signup', email }); }}
        />

        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
            {/* HEADER */}
            <View className="absolute left-0 right-0 z-50 flex-row items-center justify-between px-6" style={{ top: insets.top + 16 }}>
                <TouchableOpacity onPress={() => router.replace('/')} className={`items-center justify-center w-10 h-10 rounded-full ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
                <Image source={isDark ? require('../assets/images/icon-transparent-white.png') : require('../assets/images/icon-transparent.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 px-8">
                {/* CONTAINER - Flex 1 & Center to hold position */}
                <View className="justify-center flex-1 w-full">
                    
                    {/* TITLE */}
                    <View className="mb-10">
                        <Text className={`text-3xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </Text>
                        <Text className={`mt-2 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {authMode === 'login' ? 'Sign in to continue your progress' : 'Join us and boost your productivity'}
                        </Text>
                    </View>

                    {/* FORM */}
                    <View className="justify-center">
                        {/* EMAIL */}
                        <View className="relative z-50 mb-5">
                            <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} ${errors.email ? 'border-red-500' : ''}`}>
                                <HugeiconsIcon icon={Mail01Icon} color={errors.email ? "#ef4444" : "#94a3b8"} size={22} />
                                <TextInput 
                                    placeholder="Email Address" placeholderTextColor="#94a3b8" 
                                    className={`flex-1 h-full ml-3 font-sans font-medium ${errors.email ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
                                    autoCapitalize="none" keyboardType="email-address" value={email} 
                                    onFocus={() => setVisibleTooltip(null)}
                                    onChangeText={(t) => { setEmail(t); setErrors(prev => ({...prev, email: undefined})); setVisibleTooltip(null); }} 
                                />
                                {errors.email && (
                                    <TouchableOpacity onPress={() => setVisibleTooltip(visibleTooltip === 'email' ? null : 'email')}>
                                        <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                            {errors.email && visibleTooltip === 'email' && <Tooltip message={errors.email} isDark={isDark} />}
                        </View>

                        {/* PASSWORD */}
                        <View className="relative z-40 mb-5">
                            <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} ${errors.password ? 'border-red-500' : ''}`}>
                                <HugeiconsIcon icon={LockKeyIcon} color={errors.password ? "#ef4444" : "#94a3b8"} size={22} />
                                <TextInput 
                                    placeholder="Password" placeholderTextColor="#94a3b8" 
                                    className={`flex-1 h-full ml-3 font-sans font-medium ${errors.password ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
                                    secureTextEntry={!showPassword} value={password} 
                                    onFocus={() => setVisibleTooltip(null)}
                                    onChangeText={(t) => { setPassword(t); setErrors(prev => ({...prev, password: undefined})); setVisibleTooltip(null); }} 
                                />
                                <TouchableOpacity onPress={() => errors.password ? setVisibleTooltip(visibleTooltip === 'password' ? null : 'password') : setShowPassword(!showPassword)}>
                                    <HugeiconsIcon icon={errors.password ? InformationCircleIcon : (showPassword ? ViewIcon : ViewOffSlashIcon)} size={22} color={errors.password ? "#ef4444" : "#94a3b8"} />
                                </TouchableOpacity>
                            </View>
                            {errors.password && visibleTooltip === 'password' && <Tooltip message={errors.password} isDark={isDark} />}
                            
                            {/* FORGOT PASSWORD - Only in Login Mode */}
                            {authMode === 'login' && (
                                <View className="absolute right-0 -bottom-8">
                                    <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
                                        <Text className="font-bold text-indigo-500">Forgot Password?</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* CONFIRM PASSWORD (Ghost Element) */}
                        {/* We use opacity 0 instead of removing it to keep layout height consistent */}
                        <View className="relative z-30" style={{ opacity: authMode === 'signup' ? 1 : 0 }} pointerEvents={authMode === 'signup' ? 'auto' : 'none'}>
                            <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} ${errors.confirmPassword ? 'border-red-500' : ''}`}>
                                <HugeiconsIcon icon={LockKeyIcon} color={errors.confirmPassword ? "#ef4444" : "#94a3b8"} size={22} />
                                <TextInput 
                                    placeholder="Confirm Password" placeholderTextColor="#94a3b8" 
                                    className={`flex-1 h-full ml-3 font-sans font-medium ${errors.confirmPassword ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
                                    secureTextEntry={!showConfirmPassword} value={confirmPassword} 
                                    onFocus={() => setVisibleTooltip(null)}
                                    onChangeText={(t) => { setConfirmPassword(t); setErrors(prev => ({...prev, confirmPassword: undefined})); setVisibleTooltip(null); }} 
                                />
                                <TouchableOpacity onPress={() => errors.confirmPassword ? setVisibleTooltip(visibleTooltip === 'confirmPassword' ? null : 'confirmPassword') : setShowConfirmPassword(!showConfirmPassword)}>
                                    <HugeiconsIcon icon={errors.confirmPassword ? InformationCircleIcon : (showConfirmPassword ? ViewIcon : ViewOffSlashIcon)} size={22} color={errors.confirmPassword ? "#ef4444" : "#94a3b8"} />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && visibleTooltip === 'confirmPassword' && <Tooltip message={errors.confirmPassword} isDark={isDark} />}
                        </View>
                    </View>

                    {/* ACTIONS */}
                    <View className="mt-8">
                        <View>
                            <TouchableOpacity onPress={handleAuthAction} disabled={loading} className="flex-row items-center justify-center w-full gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30 active:opacity-90">
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Text className="text-lg font-bold text-white">{authMode === 'login' ? 'Sign In' : 'Create Account'}</Text>
                                        <HugeiconsIcon icon={ArrowRight01Icon} color="white" size={20} strokeWidth={2.5} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View>
                            <View className="flex-row items-center my-6">
                                <View className={`flex-1 h-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                                <Text className="mx-4 text-xs font-bold tracking-wider uppercase text-slate-400">OR</Text>
                                <View className={`flex-1 h-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                            </View>

                            <TouchableOpacity onPress={handleGoogleLogin} disabled={googleLoading} className={`flex-row items-center justify-center gap-3 border h-14 rounded-2xl active:opacity-90 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                {googleLoading ? (
                                    <Text className="font-bold text-slate-500">Connecting...</Text>
                                ) : (
                                    <>
                                        <Image source={require('../assets/images/google-logo.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
                                        <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>Continue with Google</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row justify-center mt-6">
                            <Text className="text-slate-500">{authMode === 'login' ? "Don't have an account? " : "Already have an account? "}</Text>
                            <TouchableOpacity onPress={toggleAuthMode}>
                                <Text className="ml-1 font-bold text-indigo-500">{authMode === 'login' ? 'Sign Up' : 'Log In'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}