// filepath: app/settings/gemini.tsx
import { Key01Icon, Link01Icon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';

export default function GeminiSettingsScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    useEffect(() => {
        loadApiKey();
    }, []);

    const loadApiKey = async () => {
        try {
            const key = await AsyncStorage.getItem('gemini_api_key');
            if (key) {
                setApiKey(key);
            }
        } catch (error) {
            console.error('Failed to load API key', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveKey = async () => {
        setIsSaving(true);
        try {
            if (apiKey.trim().length === 0) {
                await AsyncStorage.removeItem('gemini_api_key');
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Key Removed',
                    message: 'Gemini API Key has been removed successfully.',
                    confirmText: 'Okay',
                    onConfirm: () => {
                        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                        router.back();
                    }
                });
            } else {
                await AsyncStorage.setItem('gemini_api_key', apiKey.trim());
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Saved',
                    message: 'Gemini API Key has been saved successfully.',
                    confirmText: 'Okay',
                    onConfirm: () => {
                        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                        router.back();
                    }
                });
            }
        } catch (error) {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Error',
                message: 'Failed to save the API key.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <ModernAlert {...alertConfig} />
            
            <Header title="Gemini API Key" />

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={{ flex: 1 }}
            >
                <ScrollView 
                    contentContainerStyle={{ padding: 24, paddingBottom: 100 }} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.infoBox, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '30' }]}>
                        <Text style={[styles.infoText, { color: theme.colors.text }]}>
                            DART uses Google&apos;s Gemini AI to power advanced features like smart summaries and data generation. To enable this, please provide your own free Gemini API Key.
                        </Text>
                        <TouchableOpacity 
                            onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')} 
                            style={styles.linkRow}
                        >
                            <Text style={[styles.linkText, { color: theme.colors.primary }]}>Get your API Key here</Text>
                            <HugeiconsIcon icon={Link01Icon} size={16} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                            API Key
                        </Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <HugeiconsIcon icon={Key01Icon} size={22} color={theme.colors.textSecondary} />
                            
                            <TextInput 
                                value={apiKey} 
                                onChangeText={setApiKey} 
                                style={[styles.textInput, { color: theme.colors.text }]} 
                                placeholder="Enter API Key" 
                                placeholderTextColor={theme.colors.textSecondary}
                                secureTextEntry={!showKey}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            
                            <TouchableOpacity onPress={() => setShowKey(!showKey)} style={styles.eyeBtn}>
                                <HugeiconsIcon icon={showKey ? ViewOffIcon : ViewIcon} size={20} color={theme.colors.icon} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Button 
                        title="Save API Key" 
                        onPress={handleSaveKey} 
                        isLoading={isSaving} 
                        style={{ marginTop: 12 }} 
                    />

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    infoBox: {
        marginBottom: 24, 
        padding: 16, 
        borderRadius: 16, 
        borderWidth: 1 
    },
    infoText: {
        fontSize: 14, 
        fontFamily: 'Nunito_500Medium', 
        lineHeight: 22 
    },
    linkRow: {
        flexDirection: 'row', 
        alignItems: 'center', 
        marginTop: 12 
    },
    linkText: {
        fontSize: 14, 
        fontFamily: 'Nunito_700Bold', 
        marginRight: 6 
    },
    label: { 
        fontSize: 11, 
        fontFamily: 'Nunito_500Medium', 
        textTransform: 'uppercase', 
        letterSpacing: 0.5, 
        marginBottom: 8, 
        marginLeft: 4 
    },
    inputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderRadius: 16, 
        borderWidth: 1, 
        height: 56, 
        paddingHorizontal: 16 
    },
    textInput: { 
        flex: 1, 
        marginLeft: 12, 
        padding: 0, 
        fontSize: 15, 
        fontFamily: 'Nunito_500Medium' 
    },
    eyeBtn: { 
        padding: 4 
    }
});