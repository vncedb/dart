import {
    ArrowRight01Icon,
    InformationCircleIcon,
    LockKeyIcon,
    ViewIcon,
    ViewOffIcon
} from '@hugeicons/core-free-icons';
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

export default function UpdatePasswordScreen() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleUpdate = async () => {
        // Validation Logic
        if (!password || password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: password });
            if (updateError) throw updateError;

            await supabase.auth.signOut();

            Alert.alert(
                "Success", 
                "Your password has been updated. Please log in with your new password.",
                [{ text: "OK", onPress: () => router.replace('/') }]
            );

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    // Handle Icon Click
    const handleIconPress = () => {
        if (error) {
            // If error exists, clicking the icon shows the error details
            Alert.alert("Invalid Input", error);
        } else {
            // If no error, toggle password visibility
            setShowPassword(!showPassword);
        }
    };

    // Handle Text Change (Clear error immediately)
    const handleTextChange = (text: string) => {
        setPassword(text);
        if (error) setError('');
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="justify-center flex-1 p-6">
                    
                    <View className="items-center mb-10">
                        <View className="items-center justify-center w-20 h-20 mb-6 rounded-full bg-indigo-50 dark:bg-indigo-900/20">
                            <HugeiconsIcon icon={LockKeyIcon} size={40} color="#6366f1" />
                        </View>
                        <Text className="mb-2 text-3xl font-black text-center text-slate-900 dark:text-white">New Password</Text>
                        <Text className="text-center text-slate-500 dark:text-slate-400">
                            Please create a new password for your account.
                        </Text>
                    </View>

                    <View className="gap-4">
                        <View>
                            <Text className={`font-bold mb-2 ${error ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                {error ? "Error" : "New Password"}
                            </Text>
                            
                            <View className={`flex-row items-center border rounded-2xl px-4 py-4 ${
                                error 
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/10' 
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                            }`}>
                                <HugeiconsIcon 
                                    icon={LockKeyIcon} 
                                    size={24} 
                                    color={error ? "#ef4444" : "#94a3b8"} 
                                />
                                <TextInput
                                    className={`flex-1 ml-3 text-lg font-medium ${error ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-white'}`}
                                    placeholder="••••••••"
                                    placeholderTextColor={error ? "#fca5a5" : "#94a3b8"}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={handleTextChange}
                                />
                                <TouchableOpacity onPress={handleIconPress}>
                                    <HugeiconsIcon 
                                        // LOGIC: If error -> Show 'i' (red), Else -> Show Eye (gray)
                                        icon={error ? InformationCircleIcon : (showPassword ? ViewIcon : ViewOffIcon)} 
                                        size={24} 
                                        color={error ? "#ef4444" : "#94a3b8"} 
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={handleUpdate}
                            disabled={loading}
                            className={`w-full h-16 rounded-2xl flex-row gap-2 items-center justify-center shadow-lg shadow-indigo-500/30 mt-4 ${
                                error ? 'bg-red-500 shadow-red-500/30' : 'bg-indigo-600'
                            }`}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-xl font-bold text-white">
                                        {error ? "Try Again" : "Update Password"}
                                    </Text>
                                    {!error && <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="white" />}
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}