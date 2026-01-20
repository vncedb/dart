import { ArrowRight01Icon, LockKeyIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function UpdatePasswordScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const isSignupFlow = params.flow === 'signup';

    const handleUpdate = async () => {
        if (!password || password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: password });
            if (updateError) throw updateError;

            if (isSignupFlow) {
                // If in Signup Flow, proceed to Onboarding
                router.replace('/onboarding/welcome');
            } else {
                // If standard reset, sign out and go home
                await supabase.auth.signOut();
                Alert.alert("Success", "Password updated. Please log in again.", [{ text: "OK", onPress: () => router.replace('/') }]);
            }
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 p-6">
                    <View className="items-center mb-10">
                        <View className="items-center justify-center w-20 h-20 mb-6 rounded-full bg-indigo-50 dark:bg-indigo-900/20">
                            <HugeiconsIcon icon={LockKeyIcon} size={40} color="#6366f1" />
                        </View>
                        <Text className="mb-2 text-3xl font-black text-center text-slate-900 dark:text-white">
                            {isSignupFlow ? "Set Password" : "New Password"}
                        </Text>
                        <Text className="text-center text-slate-500 dark:text-slate-400">
                            {isSignupFlow ? "Secure your account with a strong password." : "Please create a new password for your account."}
                        </Text>
                    </View>

                    <View className="gap-4">
                        <View className={`flex-row items-center border rounded-2xl px-4 h-16 ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                            <HugeiconsIcon icon={LockKeyIcon} size={24} color={error ? "#ef4444" : "#94a3b8"} />
                            <TextInput
                                className={`flex-1 ml-3 text-lg font-medium ${error ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-white'}`}
                                placeholder="Enter Password"
                                placeholderTextColor={error ? "#fca5a5" : "#94a3b8"}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={(t) => { setPassword(t); setError(''); }}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <HugeiconsIcon icon={showPassword ? ViewIcon : ViewOffSlashIcon} size={24} color={error ? "#ef4444" : "#94a3b8"} />
                            </TouchableOpacity>
                        </View>
                        {error ? <Text className="ml-2 text-sm text-red-500">{error}</Text> : null}

                        <TouchableOpacity onPress={handleUpdate} disabled={loading} className="flex-row items-center justify-center w-full h-16 gap-2 mt-4 bg-indigo-600 shadow-lg rounded-2xl shadow-indigo-500/30">
                            {loading ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Text className="text-xl font-bold text-white">{isSignupFlow ? "Create Account" : "Update Password"}</Text>
                                    <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="white" />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}