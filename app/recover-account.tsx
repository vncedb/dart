import { ArrowLeft02Icon, LockKeyIcon, Mail01Icon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
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

export default function RecoverAccount() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleReactivate = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Please enter your email and password to verify your account.");
            return;
        }
        setLoading(true);
        try {
            // 1. Sign in to verify credentials
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // 2. Check if the account has a deletion schedule
            // Note: We check user_metadata for the 'deletion_scheduled_at' flag set in account-security.tsx
            const userMetadata = data.user?.user_metadata;
            const isScheduledForDeletion = userMetadata?.deletion_scheduled_at;

            if (isScheduledForDeletion) {
                // 3. Clear the deletion schedule
                const { error: updateError } = await supabase.auth.updateUser({
                    data: { deletion_scheduled_at: null }
                });

                if (updateError) throw updateError;

                Alert.alert(
                    "Welcome Back!",
                    "Your account has been successfully reactivated and the deletion request cancelled.",
                    [{ text: "Continue", onPress: () => router.replace('/(tabs)/home') }]
                );
            } else {
                // Account wasn't scheduled for deletion, but they logged in successfully anyway.
                Alert.alert(
                    "Account Active",
                    "Your account is active and was not scheduled for deletion.",
                    [{ text: "Go Home", onPress: () => router.replace('/(tabs)/home') }]
                );
            }

        } catch (error: any) {
            Alert.alert("Recovery Failed", error.message || "Could not verify account.");
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
                        <Text className="mb-2 text-3xl font-black text-slate-900 dark:text-white">Recover Account</Text>
                        <Text className="text-lg text-slate-500 dark:text-slate-400">
                            Did you schedule your account for deletion? Log in now to reactivate it.
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

                        <View>
                            <Text className="mb-2 font-bold text-slate-700 dark:text-slate-300">Password</Text>
                            <View className="flex-row items-center px-4 py-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                <HugeiconsIcon icon={LockKeyIcon} size={24} color="#94a3b8" />
                                <TextInput
                                    className="flex-1 ml-3 text-lg font-medium text-slate-900 dark:text-white"
                                    placeholder="••••••••"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    <HugeiconsIcon icon={showPassword ? ViewIcon : ViewOffIcon} size={24} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleReactivate}
                            disabled={loading}
                            className="items-center justify-center w-full h-16 mt-4 bg-indigo-600 shadow-lg rounded-2xl shadow-indigo-500/30"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-xl font-bold text-white">Reactivate Account</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}