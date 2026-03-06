import {
    Alert01Icon,
    Delete02Icon,
    Key01Icon,
    Link01Icon,
    SparklesIcon,
    TickDouble02Icon,
    ViewIcon,
    ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import {
    type AIProviderPreference,
    getAISettings,
    getStoredAIKeys,
    removeGeminiApiKey,
    removeOpenAIApiKey,
    setAIProviderPreference,
    setGeminiApiKey,
    setOpenAIApiKey,
} from '../../lib/ai';

const PROVIDER_OPTIONS: { id: AIProviderPreference; label: string; subLabel: string }[] = [
    { id: 'auto', label: 'Auto (Recommended)', subLabel: 'Use OpenAI first, then Gemini fallback' },
    { id: 'openai', label: 'OpenAI Only', subLabel: 'Use only OpenAI for AI Summary' },
    { id: 'gemini', label: 'Gemini Only', subLabel: 'Use only Gemini for AI Summary' },
];

export default function ApiKeySettingsScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    const [providerPreference, setProviderPreferenceState] = useState<AIProviderPreference>('auto');

    const [geminiApiKey, setGeminiApiKeyState] = useState('');
    const [openAIApiKey, setOpenAIApiKeyState] = useState('');

    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [showOpenAIKey, setShowOpenAIKey] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingGemini, setIsSavingGemini] = useState(false);
    const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
    const [isSavingProvider, setIsSavingProvider] = useState(false);

    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const hasGeminiKey = useMemo(() => geminiApiKey.trim().length > 0, [geminiApiKey]);
    const hasOpenAIKey = useMemo(() => openAIApiKey.trim().length > 0, [openAIApiKey]);
    const hasAnyKey = hasGeminiKey || hasOpenAIKey;

    const loadSettings = useCallback(async () => {
        try {
            const [settings, keys] = await Promise.all([getAISettings(), getStoredAIKeys()]);
            setProviderPreferenceState(settings.providerPreference);
            setGeminiApiKeyState(keys.geminiApiKey);
            setOpenAIApiKeyState(keys.openAIApiKey);
        } catch (error) {
            console.error('Failed to load AI settings:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Load Failed',
                message: 'Could not load your API key settings.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleProviderChange = async (nextProvider: AIProviderPreference) => {
        if (providerPreference === nextProvider || isSavingProvider) return;

        if (nextProvider === 'openai' && !hasOpenAIKey) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'OpenAI Key Required',
                message: 'Save an OpenAI API key first before selecting OpenAI-only mode.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
            return;
        }

        if (nextProvider === 'gemini' && !hasGeminiKey) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Gemini Key Required',
                message: 'Save a Gemini API key first before selecting Gemini-only mode.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
            return;
        }

        setIsSavingProvider(true);
        try {
            await setAIProviderPreference(nextProvider);
            setProviderPreferenceState(nextProvider);
        } catch (error) {
            console.error('Failed to save provider preference:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Save Failed',
                message: 'Could not save AI provider preference.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } finally {
            setIsSavingProvider(false);
        }
    };

    const validateKey = (value: string) => value.trim().length >= 10;

    const handleSaveGemini = async () => {
        if (!validateKey(geminiApiKey)) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Invalid Gemini Key',
                message: 'Please enter a valid Gemini API key before saving.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
            return;
        }

        setIsSavingGemini(true);
        try {
            await setGeminiApiKey(geminiApiKey);
            setGeminiApiKeyState(geminiApiKey.trim());
            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Gemini Key Saved',
                message: 'Gemini API key has been saved successfully.',
                confirmText: 'Great',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } catch (error) {
            console.error('Failed to save Gemini key:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Save Failed',
                message: 'Could not save Gemini API key.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } finally {
            setIsSavingGemini(false);
        }
    };

    const handleSaveOpenAI = async () => {
        if (!validateKey(openAIApiKey)) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Invalid OpenAI Key',
                message: 'Please enter a valid OpenAI API key before saving.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
            return;
        }

        setIsSavingOpenAI(true);
        try {
            await setOpenAIApiKey(openAIApiKey);
            setOpenAIApiKeyState(openAIApiKey.trim());
            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'OpenAI Key Saved',
                message: 'OpenAI API key has been saved successfully.',
                confirmText: 'Great',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } catch (error) {
            console.error('Failed to save OpenAI key:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Save Failed',
                message: 'Could not save OpenAI API key.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } finally {
            setIsSavingOpenAI(false);
        }
    };

    const confirmRemoveGemini = () => {
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: 'Remove Gemini Key',
            message: 'This will disable Gemini provider unless you add the key again.',
            confirmText: 'Remove',
            confirmType: 'destructive',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setIsSavingGemini(true);
                try {
                    await removeGeminiApiKey();
                    setGeminiApiKeyState('');
                    if (providerPreference === 'gemini') {
                        await setAIProviderPreference('auto');
                        setProviderPreferenceState('auto');
                    }
                } catch (error) {
                    console.error('Failed to remove Gemini key:', error);
                } finally {
                    setIsSavingGemini(false);
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        });
    };

    const confirmRemoveOpenAI = () => {
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: 'Remove OpenAI Key',
            message: 'This will disable OpenAI provider unless you add the key again.',
            confirmText: 'Remove',
            confirmType: 'destructive',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setIsSavingOpenAI(true);
                try {
                    await removeOpenAIApiKey();
                    setOpenAIApiKeyState('');
                    if (providerPreference === 'openai') {
                        await setAIProviderPreference('auto');
                        setProviderPreferenceState('auto');
                    }
                } catch (error) {
                    console.error('Failed to remove OpenAI key:', error);
                } finally {
                    setIsSavingOpenAI(false);
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        });
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
            <ModernAlert {...alertConfig} />

            <Header title="API Keys & AI Provider" />

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
                        <View
                            style={[
                                styles.statusBanner,
                                {
                                    backgroundColor: hasAnyKey
                                        ? theme.colors.success + '15'
                                        : (theme.colors.warning || '#f59e0b') + '12',
                                    borderColor: hasAnyKey
                                        ? theme.colors.success + '30'
                                        : (theme.colors.warning || '#f59e0b') + '35',
                                },
                            ]}
                        >
                            <HugeiconsIcon
                                icon={hasAnyKey ? TickDouble02Icon : Alert01Icon}
                                size={20}
                                color={hasAnyKey ? theme.colors.success : (theme.colors.warning || '#f59e0b')}
                            />
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={[
                                        styles.statusTitle,
                                        { color: hasAnyKey ? theme.colors.success : (theme.colors.warning || '#f59e0b') },
                                    ]}
                                >
                                    {hasAnyKey ? 'AI Summary is ready' : 'AI Summary needs setup'}
                                </Text>
                                <Text style={[styles.statusSub, { color: theme.colors.textSecondary }]}> 
                                    {hasAnyKey
                                        ? `Provider mode: ${providerPreference.toUpperCase()} (${hasOpenAIKey ? 'OpenAI' : ''}${hasOpenAIKey && hasGeminiKey ? ' + ' : ''}${hasGeminiKey ? 'Gemini' : ''} key configured)`
                                        : 'Add at least one API key to enable AI Summary.'}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                    <HugeiconsIcon icon={SparklesIcon} size={20} color={theme.colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>AI Provider Mode</Text>
                                    <Text style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}>Choose how AI Summary selects the model provider.</Text>
                                </View>
                            </View>

                            {PROVIDER_OPTIONS.map((option) => {
                                const isActive = providerPreference === option.id;
                                return (
                                    <TouchableOpacity
                                        key={option.id}
                                        activeOpacity={0.8}
                                        onPress={() => handleProviderChange(option.id)}
                                        disabled={isSavingProvider}
                                        style={[
                                            styles.optionRow,
                                            {
                                                borderColor: isActive ? theme.colors.primary : theme.colors.border,
                                                backgroundColor: isActive ? theme.colors.primary + '12' : theme.colors.background,
                                            },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.optionTitle, { color: theme.colors.text }]}>{option.label}</Text>
                                            <Text style={[styles.optionSub, { color: theme.colors.textSecondary }]}>{option.subLabel}</Text>
                                        </View>
                                        <View
                                            style={[
                                                styles.radioOuter,
                                                {
                                                    borderColor: isActive ? theme.colors.primary : theme.colors.border,
                                                },
                                            ]}
                                        >
                                            {isActive ? <View style={[styles.radioInner, { backgroundColor: theme.colors.primary }]} /> : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.providerHeader}>
                                <Text style={[styles.providerTitle, { color: theme.colors.text }]}>Google Gemini API Key</Text>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
                                    activeOpacity={0.7}
                                    style={[styles.getKeyBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                                >
                                    <Text style={[styles.getKeyText, { color: theme.colors.text }]}>Get Key</Text>
                                    <HugeiconsIcon icon={Link01Icon} size={14} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                                <HugeiconsIcon icon={Key01Icon} size={20} color={theme.colors.textSecondary} />
                                <TextInput
                                    value={geminiApiKey}
                                    onChangeText={setGeminiApiKeyState}
                                    style={[styles.input, { color: theme.colors.text }]}
                                    placeholder="Enter Gemini API key"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    secureTextEntry={!showGeminiKey}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <TouchableOpacity onPress={() => setShowGeminiKey((prev) => !prev)}>
                                    <HugeiconsIcon icon={showGeminiKey ? ViewOffIcon : ViewIcon} size={20} color={theme.colors.icon} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.actionRow}>
                                <Button
                                    title={hasGeminiKey ? 'Update Gemini Key' : 'Save Gemini Key'}
                                    onPress={handleSaveGemini}
                                    isLoading={isSavingGemini}
                                    style={{ flex: 1 }}
                                />
                                {hasGeminiKey ? (
                                    <TouchableOpacity
                                        onPress={confirmRemoveGemini}
                                        style={[styles.removeBtn, { borderColor: theme.colors.danger + '30', backgroundColor: theme.colors.danger + '10' }]}
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.providerHeader}>
                                <Text style={[styles.providerTitle, { color: theme.colors.text }]}>OpenAI API Key</Text>
                                <TouchableOpacity
                                    onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}
                                    activeOpacity={0.7}
                                    style={[styles.getKeyBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                                >
                                    <Text style={[styles.getKeyText, { color: theme.colors.text }]}>Get Key</Text>
                                    <HugeiconsIcon icon={Link01Icon} size={14} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.inputContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                                <HugeiconsIcon icon={Key01Icon} size={20} color={theme.colors.textSecondary} />
                                <TextInput
                                    value={openAIApiKey}
                                    onChangeText={setOpenAIApiKeyState}
                                    style={[styles.input, { color: theme.colors.text }]}
                                    placeholder="Enter OpenAI API key"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    secureTextEntry={!showOpenAIKey}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <TouchableOpacity onPress={() => setShowOpenAIKey((prev) => !prev)}>
                                    <HugeiconsIcon icon={showOpenAIKey ? ViewOffIcon : ViewIcon} size={20} color={theme.colors.icon} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.actionRow}>
                                <Button
                                    title={hasOpenAIKey ? 'Update OpenAI Key' : 'Save OpenAI Key'}
                                    onPress={handleSaveOpenAI}
                                    isLoading={isSavingOpenAI}
                                    style={{ flex: 1 }}
                                />
                                {hasOpenAIKey ? (
                                    <TouchableOpacity
                                        onPress={confirmRemoveOpenAI}
                                        style={[styles.removeBtn, { borderColor: theme.colors.danger + '30', backgroundColor: theme.colors.danger + '10' }]}
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </View>

                        <View style={{ marginTop: 8 }}>
                            <Button title="Done" variant="secondary" onPress={() => router.back()} />
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { padding: 24, paddingBottom: 120 },

    statusBanner: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20 },
    statusTitle: { fontSize: 14, fontFamily: 'Nunito_700Bold', marginBottom: 2 },
    statusSub: { fontSize: 12, fontFamily: 'Nunito_500Medium', lineHeight: 18 },

    card: { borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold' },
    cardSubtitle: { fontSize: 12, fontFamily: 'Nunito_500Medium', marginTop: 2 },

    optionRow: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    optionTitle: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
    optionSub: { fontSize: 12, fontFamily: 'Nunito_500Medium', marginTop: 2 },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    radioInner: { width: 10, height: 10, borderRadius: 5 },

    providerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    providerTitle: { fontSize: 15, fontFamily: 'Nunito_700Bold', flex: 1, marginRight: 8 },
    getKeyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    getKeyText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },

    inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 52 },
    input: { flex: 1, marginHorizontal: 10, fontSize: 14, fontFamily: 'Nunito_500Medium' },

    actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    removeBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
