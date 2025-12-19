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
    Image,
    ImageBackground,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Animated as RNAnimated,
    Easing as RNEasing,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    UIManager,
    View
} from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModernAlert, ModernToast } from '../components/ModernUI';
import OtpVerificationModal from '../components/OtpVerificationModal';
import { supabase } from '../lib/supabase';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

WebBrowser.maybeCompleteAuthSession();

// ... [Existing Tooltip & Modal Components remain identical to your file] ...
// I am omitting them here for brevity, assume they are included as per your original file.
// If you need the FULL file strictly without omission, I can paste the full block again, 
// but the logic below is the core Auth Screen export.

// --- ANIMATED TOOLTIP COMPONENT ---
const AnimatedTooltip = ({ message, isDark }: { message: string, isDark: boolean }) => {
    const fadeAnim = useRef(new RNAnimated.Value(0)).current; 
    const slideAnim = useRef(new RNAnimated.Value(15)).current; 
  
    useEffect(() => {
      RNAnimated.parallel([
        RNAnimated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true, easing: RNEasing.out(RNEasing.back(1.5)) }),
        RNAnimated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true, easing: RNEasing.out(RNEasing.cubic) }),
      ]).start();
    }, []);
  
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

// --- RESET PASSWORD MODAL ---
const ResetPasswordModal = ({ visible, onSubmit, onCancel }: any) => {
    const [pass, setPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
  
    const validate = (p: string) => {
      return /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[!@#$%^&*(),.?":{}|<>]/.test(p) && p.length >= 8;
    };
  
    const handleSave = async () => { 
      if(!pass) { setError("Password is required."); return; }
      if(!validate(pass)) { setError("Password must contain 8+ characters, uppercase, lowercase, number, and symbol."); return; }
      setError(null); setLoading(true); await onSubmit(pass); setLoading(false); 
    };
  
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); }}>
          <View className="items-center justify-center flex-1 px-6 bg-black/60">
              <TouchableWithoutFeedback>
                  <View className={`w-full p-6 shadow-2xl rounded-3xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                      <Text className={`mb-6 text-xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Set New Password</Text>
                      <View className="relative z-20 mb-6">
                          <View className={`flex-row items-center px-4 border h-14 rounded-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${error ? 'border-red-500' : ''}`}>
                              <HugeiconsIcon icon={LockKeyIcon} color={error ? "#ef4444" : "#94a3b8"} size={22} />
                              <TextInput placeholder="New Password" secureTextEntry onChangeText={(t) => { setPass(t); setError(null); }} className={`flex-1 ml-3 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} placeholderTextColor="#94a3b8" />
                          </View>
                          {error && <AnimatedTooltip message={error} isDark={isDark} />}
                      </View>
                      <TouchableOpacity onPress={handleSave} disabled={loading} className="items-center justify-center w-full mb-3 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/20">
                          <Text className="text-lg font-bold text-center text-white">{loading ? 'Updating...' : 'Update Password'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={onCancel} className="py-2"><Text className="font-bold text-center text-slate-400">Cancel</Text></TouchableOpacity>
                  </View>
              </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
};

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [visibleTooltip, setVisibleTooltip] = useState<'email' | 'password' | null>(null);

  const [showOtp, setShowOtp] = useState(false);
  const [showResetPass, setShowResetPass] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [toastVisible, setToastVisible] = useState(false);

  const spin = useSharedValue(0);

  useEffect(() => {
    if (params.mode === 'signup') {
        setIsLogin(false);
        spin.value = 1; 
    }
  }, [params.mode]);

  const toggleAuthMode = () => {
    Keyboard.dismiss();
    setErrors({});
    setVisibleTooltip(null);
    spin.value = withTiming(isLogin ? 1 : 0, { duration: 600, easing: Easing.inOut(Easing.cubic) });
    setIsLogin(!isLogin);
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(spin.value, [0, 1], [0, 180]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      zIndex: spin.value === 0 ? 1 : 0,
      opacity: interpolate(spin.value, [0, 0.5, 1], [1, 0, 0]),
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(spin.value, [0, 1], [180, 360]);
    return {
      transform: [{ rotateY: `${rotateValue}deg` }],
      zIndex: spin.value === 1 ? 1 : 0,
      opacity: interpolate(spin.value, [0, 0.5, 1], [0, 0, 1]),
    };
  });

  const validatePassword = (pass: string) => {
    return /[a-z]/.test(pass) && /[A-Z]/.test(pass) && /[0-9]/.test(pass) && /[!@#$%^&*(),.?":{}|<>]/.test(pass) && pass.length >= 8;
  };

  const handleValidation = () => {
    const newErrors: any = {};
    let valid = true;
    if (!email.includes('@')) { newErrors.email = "Please enter a valid email address."; valid = false; }
    
    if (isLogin) {
        if (!password) { newErrors.password = "Password is required."; valid = false; }
    } else {
        if (!validatePassword(password)) { newErrors.password = "Password must contain at least 8 characters, including uppercase, lowercase, number, and symbol."; valid = false; }
    }
    setErrors(newErrors);
    if (newErrors.email) setVisibleTooltip('email');
    else if (newErrors.password) setVisibleTooltip('password');
    else setVisibleTooltip(null);
    return valid;
  };

  const handleAuthAction = async () => {
    Keyboard.dismiss();
    setErrors({});
    setVisibleTooltip(null);
    
    if (!handleValidation()) return;

    setLoading(true);

    if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('invalid login') || msg.includes('credential')) { 
                setErrors({ password: 'Incorrect email or password.' });
                setVisibleTooltip('password'); 
            } else if (msg.includes('email not confirmed')) { 
                setErrors({ email: 'Email not confirmed.' }); 
                setVisibleTooltip('email');
            } else { 
                setAlertConfig({ visible: true, type: 'error', title: 'Login Failed', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) }); 
            }
        } else {
            setToastVisible(true);
            setTimeout(() => { setToastVisible(false); router.replace('/(tabs)/home'); }, 1000);
        }
    } else {
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
            if (session) router.replace('/introduction');
            else setShowOtp(true);
        }
    }
  };

  const handleForgotPassword = async () => {
    if (!email.includes('@')) { setErrors({ email: "Please enter your email address first." }); setVisibleTooltip('email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('signups not allowed') || msg.includes('user not found')) {
            setErrors({ email: "This email is not registered." });
            setVisibleTooltip('email');
        } else {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        }
    } else {
        setShowOtp(true);
    }
  };

  const handleUpdatePassword = async (newPass: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { setAlertConfig({ visible: true, type: 'error', title: 'Failed', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) }); } 
    else { setShowResetPass(false); setToastVisible(true); setTimeout(() => { setToastVisible(false); router.replace('/(tabs)/home'); }, 1000); }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo = makeRedirectUri({ path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true }, });
      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned');
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success') {
        const { url } = res;
        const { params } = QueryParams.getQueryParams(url.replace('#', '?'));
        if (params.access_token && params.refresh_token) {
            await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
            router.replace('/(tabs)/home');
        }
      }
    } catch (error: any) {
        if (error.message !== 'User cancelled the auth session') {
            setAlertConfig({ visible: true, type: 'error', title: 'Google Sign In Failed', message: error.message, onDismiss: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        }
    } finally { setGoogleLoading(false); }
  };

  const renderCardContent = (mode: 'login' | 'signup') => (
    <View className={`p-8 shadow-2xl rounded-[32px] ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <View className="flex-row items-center justify-between mb-8">
            <TouchableOpacity onPress={() => router.replace('/')} className={`items-center justify-center w-10 h-10 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color="#64748b" />
            </TouchableOpacity>
            <View className="items-center justify-center bg-white border shadow-sm w-14 h-14 rounded-2xl border-slate-100">
                <Image source={require('../assets/images/logo.png')} style={{ width: 35, height: 35 }} resizeMode="contain" />
            </View>
        </View>

        <Text className={`mb-8 font-sans text-2xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </Text>

        <View className="relative z-20 mb-6">
            <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.email ? 'border-red-500' : ''}`}>
            <HugeiconsIcon icon={Mail01Icon} color={errors.email ? "#ef4444" : "#94a3b8"} size={22} />
            <TextInput 
                placeholder="Email Address" placeholderTextColor="#94a3b8" 
                className={`flex-1 h-full ml-3 font-sans font-medium ${errors.email ? 'text-red-500' : (isDark ? 'text-white' : 'text-slate-700')}`} 
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

        <View className="relative z-10 mb-16">
            <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} ${errors.password ? 'border-red-500' : ''}`}>
            <HugeiconsIcon icon={LockKeyIcon} color={errors.password ? "#ef4444" : "#94a3b8"} size={22} />
            <TextInput 
                placeholder="Password" placeholderTextColor="#94a3b8" 
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
            {mode === 'login' && (
                <View className="absolute z-0 right-2 -bottom-7">
                    <TouchableOpacity onPress={handleForgotPassword}>
                        <Text className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Forgot?</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>

        <TouchableOpacity onPress={handleAuthAction} disabled={loading} className="flex-row items-center justify-center gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
            {loading ? (
            <Text className="font-sans text-lg font-bold text-white">Please wait...</Text>
            ) : (
            <>
                <Text className="font-sans text-lg font-bold text-white">{mode === 'login' ? 'Sign In' : 'Sign Up'}</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} color="white" size={20} strokeWidth={2.5} />
            </>
            )}
        </TouchableOpacity>

        <View className="flex-row items-center my-6">
            <View className={`flex-1 h-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <Text className="mx-4 font-sans text-xs font-bold tracking-wider uppercase text-slate-400">OR</Text>
            <View className={`flex-1 h-[1px] ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
        </View>

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

        <View className="flex-row justify-center mt-6">
            <Text className="font-sans text-slate-500">{mode === 'login' ? "Don't have an account? " : "Already have an account? "}</Text>
            <TouchableOpacity onPress={toggleAuthMode}>
                <Text className="ml-1 font-sans font-bold text-indigo-600 dark:text-indigo-400">{mode === 'login' ? 'Sign Up' : 'Log In'}</Text>
            </TouchableOpacity>
        </View>
    </View>
  );

  return (
    <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setVisibleTooltip(null); }}>
      <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80' }} className="justify-center flex-1" blurRadius={5}>
        <View className={`absolute inset-0 ${isDark ? 'bg-slate-900/80' : 'bg-slate-50/90'}`} />
        <ModernToast visible={toastVisible} message="Success!" type="success" />
        <ModernAlert {...alertConfig} />

        <ResetPasswordModal visible={showResetPass} onSubmit={handleUpdatePassword} onCancel={() => setShowResetPass(false)} />

        <OtpVerificationModal 
            visible={showOtp} 
            email={email} 
            onClose={() => setShowOtp(false)} 
            onVerify={async (code: string) => { 
                const type = isLogin ? 'email' : 'signup'; 
                const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
                if(error) return false;
                setShowOtp(false);
                if(isLogin) setShowResetPass(true);
                else router.replace('/introduction');
                return true;
            }} 
            onResend={async () => { await supabase.auth.signInWithOtp({ email }); }}
        />

        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 p-6">
                <View style={{ height: 620, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Animated.View style={[styles.cardFace, frontAnimatedStyle]}>{renderCardContent('login')}</Animated.View>
                    <Animated.View style={[styles.cardFace, backAnimatedStyle]}>{renderCardContent('signup')}</Animated.View>
                </View>
            </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
    cardFace: { width: '100%', position: 'absolute', backfaceVisibility: 'hidden' },
});