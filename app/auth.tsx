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
import React, { useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Animated as RNAnimated,
    Easing as RNEasing,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernAlert, ModernToast } from '../components/ModernUI';
import OtpVerificationModal from '../components/OtpVerificationModal';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// --- ANIMATED TOOLTIP COMPONENT ---
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
      <RNAnimated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }} className="absolute right-0 z-50 w-64 top-14">
        <TouchableWithoutFeedback>
          <View className="w-full">
              <View className={`absolute right-5 -top-2 w-4 h-4 rotate-45 ${isDark ? 'bg-slate-700' : 'bg-white'} border-l border-t ${isDark ? 'border-slate-600' : 'border-slate-200'}`} />
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

export default function AuthScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [visibleTooltip, setVisibleTooltip] = useState<'email' | 'password' | 'confirmPassword' | null>(null);

  const [showOtp, setShowOtp] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [toastVisible, setToastVisible] = useState(false);

  // Animation Values
  const modeAnim = useSharedValue(0); // 0: Login, 1: Signup, 2: Reset (Using 0/1 mostly for morph)
  const cardOpacity = useSharedValue(0); 
  const cardTranslateY = useSharedValue(100); 

  // --- INITIALIZATION & ANIMATION ---
  useEffect(() => {
    // Opening: Slide Up (No Bounce) + Fade In
    cardOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    cardTranslateY.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });

    if (routeParams.mode === 'signup') {
        setAuthMode('signup');
        modeAnim.value = 1; 
    }
  }, [routeParams.mode]);

  useEffect(() => {
    const backAction = () => {
        handleBack();
        return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, []);

  const performNavigation = () => {
    if (router.canGoBack()) {
        router.back();
    } else {
        router.replace('/');
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    // Closing: Only Fade Out
    cardOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
            runOnJS(performNavigation)();
        }
    });
  };

  const toggleAuthMode = () => {
    Keyboard.dismiss();
    setErrors({});
    setVisibleTooltip(null);
    setConfirmPassword('');
    
    // Morph Animation
    const targetVal = authMode === 'login' ? 1 : 0;
    modeAnim.value = withTiming(targetVal, { duration: 500, easing: Easing.inOut(Easing.cubic) });
    
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  };

  // --- MORPHING STYLES ---
  
  // Login / Reset View Style
  const loginStyle = useAnimatedStyle(() => {
    // Visible when modeAnim is 0 (Login)
    // When moving to 1 (Signup): Fade Out, Scale Down slightly
    const opacity = interpolate(modeAnim.value, [0, 1], [1, 0]);
    const scale = interpolate(modeAnim.value, [0, 1], [1, 0.95]);
    const pointerEvents = modeAnim.value < 0.5 ? 'auto' : 'none'; // Disable touches when hidden

    return {
      opacity,
      transform: [{ scale }],
      zIndex: modeAnim.value < 0.5 ? 1 : 0,
      pointerEvents: pointerEvents as any, 
    };
  });

  // Signup View Style
  const signupStyle = useAnimatedStyle(() => {
    // Visible when modeAnim is 1 (Signup)
    // When moving from 0 (Login): Fade In, Scale Down from 1.05 to 1
    const opacity = interpolate(modeAnim.value, [0, 1], [0, 1]);
    const scale = interpolate(modeAnim.value, [0, 1], [1.05, 1]);
    const pointerEvents = modeAnim.value > 0.5 ? 'auto' : 'none';

    return {
      opacity,
      transform: [{ scale }],
      zIndex: modeAnim.value > 0.5 ? 1 : 0,
      pointerEvents: pointerEvents as any,
    };
  });

  // Entrance/Exit Style for Main Container
  const containerAnimatedStyle = useAnimatedStyle(() => ({
      opacity: cardOpacity.value,
      transform: [{ translateY: cardTranslateY.value }]
  }));

  // --- VALIDATION ---
  const getPasswordRequirementMissing = (pass: string) => {
      if (pass.length < 8) return "Must be at least 8 characters long.";
      if (!/[A-Z]/.test(pass)) return "Must contain at least one uppercase letter.";
      if (!/[a-z]/.test(pass)) return "Must contain at least one lowercase letter.";
      if (!/[0-9]/.test(pass)) return "Must contain at least one number.";
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) return "Must contain at least one special character.";
      return null;
  };

  const handleValidation = () => {
    const newErrors: any = {};
    let valid = true;
    if (!email.includes('@')) { newErrors.email = "Please enter a valid email address."; valid = false; }
    
    if (authMode === 'login') {
        if (!password) { newErrors.password = "Password is required."; valid = false; }
    } 
    else if (authMode === 'signup' || authMode === 'reset') {
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

  const checkUserExists = async (emailToCheck: string) => {
      try {
          const { data, error } = await supabase.from('profiles').select('id').ilike('email', emailToCheck).maybeSingle();
          if (error) return false;
          return !!data;
      } catch (e) { return false; }
  };

  const checkAppRegistration = async (userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!profile) { await supabase.from('profiles').insert([{ id: userId, email: email }]); }
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
            const exists = await checkUserExists(email);
            if (!exists) {
                setLoading(false);
                setErrors({ email: "Account not found. Please sign up." });
                setVisibleTooltip('email');
                return;
            }
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            setLoading(false);
            if (error) {
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
                    await checkAppRegistration(data.user.id);
                    setToastVisible(true);
                    setTimeout(() => { setToastVisible(false); router.replace('/(tabs)/home'); }, 1000);
                }
            }
        } 
        else if (authMode === 'signup') {
            const exists = await checkUserExists(email);
            if (exists) {
                setLoading(false);
                setErrors({ email: "This email is already registered. Please log in." });
                setVisibleTooltip('email');
                return;
            }
            const { data: { session }, error } = await supabase.auth.signUp({ email, password });
            setLoading(false);
            if (error) {
                if (error.message.includes('already registered')) {
                    setErrors({ email: 'This email is already registered.' });
                    setVisibleTooltip('email');
                } else {
                    setAlertConfig({ visible: true, type: 'error', title: 'Sign Up Failed', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
                }
            } else {
                if (session) {
                     await checkAppRegistration(session.user.id);
                     router.replace('/introduction');
                } else {
                    setShowOtp(true);
                }
            }
        }
        else if (authMode === 'reset') {
            const { error } = await supabase.auth.updateUser({ password: password });
            setLoading(false);
            if (error) {
                setAlertConfig({ visible: true, type: 'error', title: 'Update Failed', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
            } else {
                supabase.functions.invoke('send-email', { body: { email: email, type: 'PASSWORD_CHANGED' } });
                setToastVisible(true);
                setTimeout(() => { 
                    setToastVisible(false);
                    setAuthMode('login');
                    setPassword('');
                    setConfirmPassword('');
                }, 1500);
            }
        }
    } catch (err: any) {
        setLoading(false);
        setAlertConfig({ visible: true, type: 'error', title: 'Error', message: err.message || 'An unexpected error occurred.', onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
    }
  };

  const handleForgotPassword = async () => {
    Keyboard.dismiss();
    setErrors({});
    if (!email.includes('@')) { 
        setErrors({ email: "Please enter your email address first." }); 
        setVisibleTooltip('email'); 
        return; 
    }
    setLoading(true);
    const exists = await checkUserExists(email);
    if (!exists) {
        setLoading(false);
        setErrors({ email: "This email is not registered." });
        setVisibleTooltip('email');
        return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) {
        setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
    } else {
        setShowOtp(true);
        setAlertConfig({ 
            visible: true, 
            type: 'success', 
            title: 'Code Sent', 
            message: `We've sent a verification code to ${email}.`, 
            onDismiss: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) 
        });
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
            if (user) await checkAppRegistration(user.id);
            router.replace('/(tabs)/home');
        } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                if (session.user) await checkAppRegistration(session.user.id);
                router.replace('/(tabs)/home');
            }
        }
      }
    } catch (error: any) {
        if (error.message !== 'User cancelled the auth session') {
            setAlertConfig({ visible: true, type: 'error', title: 'Google Sign In Failed', message: error.message || "Could not sign in.", onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        }
    } finally { setGoogleLoading(false); }
  };

  const renderCardContent = (currentMode: 'login' | 'signup' | 'reset') => (
    <View className={`p-8 shadow-2xl rounded-[32px] ${isDark ? 'bg-slate-800' : 'bg-white'}`} style={{ height: '100%' }}>
        
        {/* Header - Logo without Box Container */}
        <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={handleBack} className={`items-center justify-center w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color="#64748b" />
            </TouchableOpacity>
            
            {/* Logo Image Only (Removed Box) */}
            <Image 
                source={isDark ? require('../assets/images/icon-transparent-white.png') : require('../assets/images/icon-transparent.png')} 
                style={{ width: 40, height: 40 }} 
                resizeMode="contain" 
            />
        </View>

        {/* Center Content Wrapper: Title, Inputs, Button */}
        <View className="flex-1 w-full justify-evenly">
            
            {/* Title */}
            <Text className={`font-sans text-2xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {currentMode === 'login' ? 'Welcome Back' : (currentMode === 'reset' ? 'Create New Password' : 'Create Account')}
            </Text>

            {/* INPUTS SECTION (Fixed Height for stability, centered in flex space) */}
            <View className="relative w-full h-[240px] justify-center">
                {/* Email Input */}
                <View className="relative z-50 w-full mb-6">
                    <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.email ? 'border-red-500' : ''}`}>
                        <HugeiconsIcon icon={Mail01Icon} color={errors.email ? "#ef4444" : "#94a3b8"} size={22} />
                        <TextInput 
                            placeholder="Email Address" placeholderTextColor="#94a3b8" 
                            editable={currentMode !== 'reset'} 
                            className={`flex-1 h-full ml-3 font-sans font-medium ${errors.email ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')} ${currentMode === 'reset' ? 'opacity-50' : ''}`} 
                            autoCapitalize="none" keyboardType="email-address" value={email} 
                            onFocus={() => setVisibleTooltip(null)}
                            onChangeText={(t) => { setEmail(t); setErrors((prev) => ({...prev, email: undefined})); setVisibleTooltip(null); }} 
                        />
                        {errors.email && (
                            <TouchableOpacity onPress={() => setVisibleTooltip(visibleTooltip === 'email' ? null : 'email')}>
                                <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {errors.email && visibleTooltip === 'email' && <AnimatedTooltip message={errors.email} isDark={isDark} />}
                </View>

                {/* Password Input */}
                <View className="relative z-40 w-full mb-6">
                    <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.password ? 'border-red-500' : ''}`}>
                        <HugeiconsIcon icon={LockKeyIcon} color={errors.password ? "#ef4444" : "#94a3b8"} size={22} />
                        <TextInput 
                            placeholder={currentMode === 'reset' ? "New Password" : "Password"} 
                            placeholderTextColor="#94a3b8" 
                            className={`flex-1 h-full ml-3 font-sans font-medium ${errors.password ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
                            secureTextEntry={!showPassword} value={password} 
                            onFocus={() => setVisibleTooltip(null)}
                            onChangeText={(t) => { setPassword(t); setErrors((prev) => ({...prev, password: undefined})); setVisibleTooltip(null); }} 
                        />
                        <TouchableOpacity onPress={() => {
                            if (errors.password) setVisibleTooltip(visibleTooltip === 'password' ? null : 'password');
                            else setShowPassword(!showPassword);
                        }}>
                            <HugeiconsIcon icon={errors.password ? InformationCircleIcon : (showPassword ? ViewIcon : ViewOffSlashIcon)} size={22} color={errors.password ? "#ef4444" : "#94a3b8"} />
                        </TouchableOpacity>
                    </View>
                    {errors.password && visibleTooltip === 'password' && <AnimatedTooltip message={errors.password} isDark={isDark} />}
                    
                    {/* Forgot Password Link (Login Only) */}
                    {currentMode === 'login' && (
                        <View className="absolute z-0 right-2 -bottom-7">
                            <TouchableOpacity onPress={handleForgotPassword}>
                                <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Forgot?</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Confirm Password (Signup & Reset Only) */}
                {(currentMode === 'signup' || currentMode === 'reset') && (
                    <View className="relative z-30 w-full mb-6">
                        <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.confirmPassword ? 'border-red-500' : ''}`}>
                            <HugeiconsIcon icon={LockKeyIcon} color={errors.confirmPassword ? "#ef4444" : "#94a3b8"} size={22} />
                            <TextInput 
                                placeholder="Confirm Password" placeholderTextColor="#94a3b8" 
                                className={`flex-1 h-full ml-3 font-sans font-medium ${errors.confirmPassword ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
                                secureTextEntry={!showConfirmPassword} value={confirmPassword} 
                                onFocus={() => setVisibleTooltip(null)}
                                onChangeText={(t) => { setConfirmPassword(t); setErrors((prev) => ({...prev, confirmPassword: undefined})); setVisibleTooltip(null); }} 
                            />
                            <TouchableOpacity onPress={() => {
                                if (errors.confirmPassword) setVisibleTooltip(visibleTooltip === 'confirmPassword' ? null : 'confirmPassword');
                                else setShowConfirmPassword(!showConfirmPassword);
                            }}>
                                <HugeiconsIcon icon={errors.confirmPassword ? InformationCircleIcon : (showConfirmPassword ? ViewIcon : ViewOffSlashIcon)} size={22} color={errors.confirmPassword ? "#ef4444" : "#94a3b8"} />
                            </TouchableOpacity>
                        </View>
                        {errors.confirmPassword && visibleTooltip === 'confirmPassword' && <AnimatedTooltip message={errors.confirmPassword} isDark={isDark} />}
                    </View>
                )}
            </View>

            {/* Action Button */}
            <TouchableOpacity onPress={handleAuthAction} disabled={loading} className="flex-row items-center justify-center gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
                {loading ? (
                <Text className="font-sans text-lg font-bold text-white">Please wait...</Text>
                ) : (
                <>
                    <Text className="font-sans text-lg font-bold text-white">
                        {currentMode === 'login' ? 'Sign In' : (currentMode === 'reset' ? 'Update Password' : 'Sign Up')}
                    </Text>
                    <HugeiconsIcon icon={ArrowRight01Icon} color="white" size={20} strokeWidth={2.5} />
                </>
                )}
            </TouchableOpacity>
        </View>

        {/* Bottom Section (Separator, Google, Footer) */}
        <View>
            {currentMode !== 'reset' && (
                <View className="flex-row items-center my-6">
                    <View className={`flex-1 h-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    <Text className="mx-4 font-sans text-xs font-bold tracking-wider uppercase text-slate-400">OR</Text>
                    <View className={`flex-1 h-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                </View>
            )}

            {currentMode !== 'reset' && (
                <TouchableOpacity onPress={handleGoogleLogin} disabled={googleLoading} className={`flex-row items-center justify-center gap-3 border h-14 rounded-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    {googleLoading ? (
                        <Text className="font-sans font-bold text-slate-500">Connecting...</Text>
                    ) : (
                        <>
                        <Image source={require('../assets/images/google-logo.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
                        <Text className={`font-sans font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>Continue with Google</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}

            {currentMode !== 'reset' && (
                <View className="flex-row justify-center mt-6">
                    <Text className="font-sans text-slate-500">{currentMode === 'login' ? "Don't have an account? " : "Already have an account? "}</Text>
                    <TouchableOpacity onPress={toggleAuthMode}>
                        <Text className="ml-1 font-sans font-bold text-indigo-600 dark:text-indigo-400">{currentMode === 'login' ? 'Sign Up' : 'Log In'}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {currentMode === 'reset' && (
                <View className="flex-row justify-center mt-6">
                    <TouchableOpacity onPress={() => { setAuthMode('login'); setPassword(''); setConfirmPassword(''); }}>
                        <Text className="font-sans font-bold text-slate-500">Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    </View>
  );

  return (
    <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setVisibleTooltip(null); }}>
      <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80' }} className="justify-center flex-1" blurRadius={5}>
        <View className={`absolute inset-0 ${isDark ? 'bg-slate-900/80' : 'bg-slate-50/90'}`} />
        <ModernToast visible={toastVisible} message="Success!" type="success" />
        <ModernAlert {...alertConfig} />

        <OtpVerificationModal 
            visible={showOtp} 
            email={email} 
            onClose={() => setShowOtp(false)} 
            onVerify={async (code: string) => {
                const type = authMode === 'login' ? 'recovery' : 'signup';
                const { data: { session }, error } = await supabase.auth.verifyOtp({ email, token: code, type });
                if(error) return false;
                setShowOtp(false);
                
                if(authMode === 'login') {
                    setAuthMode('reset');
                    setPassword('');
                    setConfirmPassword('');
                } else {
                    if (session?.user?.email) {
                        supabase.functions.invoke('send-email', {
                            body: { email: session.user.email, type: 'WELCOME' }
                        });
                        await checkAppRegistration(session.user.id);
                    }
                    router.replace('/introduction');
                }
                return true;
            }}
            onResend={async () => {
                if (authMode === 'login') {
                    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
                } else {
                    await supabase.auth.resend({ type: 'signup', email });
                }
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Code Sent',
                    message: 'Please check your email inbox.',
                    onDismiss: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
                });
            }}
        />

        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 p-6">
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Animated.View style={[styles.cardContainer, containerAnimatedStyle]}>
                        
                        {/* Login View */}
                        <Animated.View style={[styles.cardFace, loginStyle]}>
                            {renderCardContent(authMode === 'reset' ? 'reset' : 'login')}
                        </Animated.View>

                        {/* Signup View */}
                        <Animated.View style={[styles.cardFace, signupStyle]}>
                            {renderCardContent('signup')}
                        </Animated.View>

                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
    cardContainer: { width: '100%', height: 690 },
    cardFace: { width: '100%', height: '100%', position: 'absolute' },
});