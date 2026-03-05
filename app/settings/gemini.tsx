// filepath: app/settings/gemini.tsx
import {
    Delete02Icon,
    Key01Icon,
    Link01Icon,
    SparklesIcon,
    TickDouble02Icon,
    ViewIcon,
    ViewOffIcon
} from '@hugeicons/core-free-icons';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';

export default function GeminiSettingsScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    const [apiKey, setApiKey] = useState('');
    const [savedKeyExists, setSavedKeyExists] = useState(false);
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
                setSavedKeyExists(true);
            }
        } catch (err) {
            console.error('Failed to load API key', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveKey = async () => {
        if (apiKey.trim().length === 0) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Empty Key',
                message: 'Please enter a valid API key before saving.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
            });
            return;
        }

        setIsSaving(true);
        try {
            await AsyncStorage.setItem('gemini_api_key', apiKey.trim());
            setSavedKeyExists(true);
            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Key Saved',
                message: 'Your Gemini API Key has been applied successfully.',
                confirmText: 'Awesome',
                onConfirm: () => {
                    setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                    router.back();
                }
            });
        } catch (err) {
            console.error('Save API Key Error:', err);
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

    const handleRemoveKey = () => {
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: 'Remove Key',
            message: 'Are you sure you want to remove your API Key? AI features will be disabled.',
            confirmText: 'Remove',
            confirmType: 'destructive',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setIsSaving(true);
                try {
                    await AsyncStorage.removeItem('gemini_api_key');
                    setApiKey('');
                    setSavedKeyExists(false);
                    router.back();
                } catch (err) {
                    console.error('Remove API Key Error:', err);
                } finally {
                    setIsSaving(false);
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
        });
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
            
            <Header title="Gemini AI Integration" />

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 20}
                style={{ flex: 1 }}
            >
                <ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View entering={FadeInDown.duration(400)}>
                        {/* Status Banner */}
                        {savedKeyExists && (
                            <View style={[styles.statusBanner, { backgroundColor: theme.colors.success + '15', borderColor: theme.colors.success + '30' }]}>
                                <HugeiconsIcon icon={TickDouble02Icon} size={20} color={theme.colors.success} />
                                <Text style={[styles.statusText, { color: theme.colors.success }]}>API Key is active and connected.</Text>
                            </View>
                        )}

                        {/* Info Card */}
                        <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                <HugeiconsIcon icon={SparklesIcon} size={24} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.infoTitle, { color: theme.colors.text }]}>Power Up with AI</Text>
                            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                                DART uses Google&apos;s Gemini AI to generate smart summaries and performance insights. Connect your free API key to unlock these features.
                            </Text>
                            
                            <TouchableOpacity 
                                onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')} 
                                activeOpacity={0.7}
                                style={[styles.linkBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                            >
                                <Text style={[styles.linkText, { color: theme.colors.text }]}>Get your free API Key</Text>
                                <HugeiconsIcon icon={Link01Icon} size={16} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Input Area */}
                        <View style={{ marginBottom: 24, marginTop: 12 }}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                YOUR API KEY
                            </Text>
                            <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <HugeiconsIcon icon={Key01Icon} size={22} color={theme.colors.textSecondary} />
                                
                                <TextInput 
                                    value={apiKey} 
                                    onChangeText={setApiKey} 
                                    style={[styles.textInput, { color: theme.colors.text }]} 
                                    placeholder="Enter your Gemini API Key" 
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
                            title={savedKeyExists ? "Update API Key" : "Connect API Key"} 
                            onPress={handleSaveKey} 
                            isLoading={isSaving} 
                            style={{ marginBottom: 16 }} 
                        />

                        {savedKeyExists && (
                            <TouchableOpacity 
                                onPress={handleRemoveKey}
                                disabled={isSaving}
                                style={[styles.removeBtn, { backgroundColor: theme.colors.danger + '10', borderColor: theme.colors.danger + '30' }]}
                            >
                                <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                                <Text style={[styles.removeBtnText, { color: theme.colors.danger }]}>Remove API Key</Text>
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 120 },
    
    statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
    statusText: { fontSize: 14, fontFamily: 'Nunito_700Bold', flex: 1 },

    infoCard: { padding: 24, borderRadius: 24, borderWidth: 1, marginBottom: 32, alignItems: 'center' },
    iconBox: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    infoTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: -0.3 },
    infoText: { fontSize: 14, fontFamily: 'Nunito_500Medium', lineHeight: 22, textAlign: 'center', marginBottom: 20 },
    
    linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    linkText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },

    label: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 56, paddingHorizontal: 16 },
    textInput: { flex: 1, marginLeft: 12, padding: 0, fontSize: 15, fontFamily: 'Nunito_500Medium' },
    eyeBtn: { padding: 8, marginRight: -8 },

    removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 16, borderWidth: 1 },
    removeBtnText: { fontSize: 15, fontFamily: 'Nunito_700Bold' }
});