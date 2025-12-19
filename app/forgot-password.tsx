import { ArrowLeft02Icon, Mail01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const handleReset = async () => {
        if (!email) {
            Alert.alert("Error", "Please enter your email address.");
            return;
        }
        setLoading(true);
        try {
            // Note: This sends a Password Reset email. 
            // We redirect to login so the 'PASSWORD_RECOVERY' event listener in login.tsx can catch it.
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'dartapp://login', 
            });
            
            if (error) throw error;

            Alert.alert(
                "Check your email",
                "We've sent you a password reset link.",
                [{ text: "OK", onPress: () => router.back() }]
            );
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 p-6">
                    {/* Header */}
                    <View className="mb-8">
                        <TouchableOpacity 
                            onPress={() => router.back()} 
                            className="items-center justify-center w-10 h-10 mb-6 rounded-full bg-slate-100 dark:bg-slate-800"
                        >
                            <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
                        </TouchableOpacity>
                        <Text className="mb-2 text-3xl font-black text-slate-900 dark:text-white">Forgot Password</Text>
                        <Text className="text-lg text-slate-500 dark:text-slate-400">
                            Enter your email and we&apos;ll help you reset your password.
                        </Text>
                    </View>

                    {/* Form */}
                    <View className="gap-4">
                        <View>
                            <Text className="mb-2 font-bold text-slate-700 dark:text-slate-300">Email Address</Text>
                            <View className="flex-row items-center px-4 py-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                <HugeiconsIcon icon={Mail01Icon} size={24} color="#94a3b8" />
                                <TextInput
                                    className="flex-1 ml-3 text-lg font-medium text-slate-900 dark:text-white"
                                    placeholder="name@example.com"
                                    placeholderTextColor="#94a3b8"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleReset}
                            disabled={loading}
                            className="items-center justify-center w-full h-16 mt-4 bg-indigo-600 shadow-lg rounded-2xl shadow-indigo-500/30"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-xl font-bold text-white">Send Reset Link</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}