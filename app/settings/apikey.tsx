import {
    Alert01Icon,
    ChatGptIcon,
    Delete02Icon,
    GoogleGeminiIcon,
    Link01Icon,
    Task01Icon,
    TickDouble02Icon,
    ViewIcon,
    ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Clipboard,
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
import LoadingScreen from '../../components/LoadingScreen';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import {
    type AIProvider,
    getAISettings,
    getStoredAIKeys,
    removeGeminiApiKey,
    removeOpenAIApiKey,
    setAIProviderPreference,
    setGeminiApiKey,
    setOpenAIApiKey,
} from '../../lib/ai';

const PROVIDERS: {
    id: AIProvider;
    label: string;
    subtitle: string;
    helpUrl: string;
    accent: string;
    caption: string;
}[] = [
    {
        id: 'openai',
        label: 'OpenAI',
        subtitle: 'Balanced for summaries, rewrites, and multimodal work-photo descriptions.',
        helpUrl: 'https://platform.openai.com/api-keys',
        accent: '#10b981',
        caption: 'Balanced writing and image-aware prompts',
    },
    {
        id: 'gemini',
        label: 'Gemini',
        subtitle: 'Fast for drafting, summarizing, and image-assisted task descriptions.',
        helpUrl: 'https://aistudio.google.com/app/apikey',
        accent: '#f59e0b',
        caption: 'Fast drafting and photo-assisted descriptions',
    },
];

const renderProviderIcon = (provider: AIProvider, size: number, color: string) => (
    <HugeiconsIcon icon={provider === 'openai' ? ChatGptIcon : GoogleGeminiIcon} size={size} color={color} />
);

export default function ApiKeySettingsScreen() {
    const theme = useAppTheme();

    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
    const [apiKey, setApiKey] = useState('');
    const [storedProvider, setStoredProvider] = useState<AIProvider | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const selectedConfig = useMemo(
        () => PROVIDERS.find((provider) => provider.id === selectedProvider) || PROVIDERS[0],
        [selectedProvider],
    );

    const isSelectedProviderStored = storedProvider === selectedProvider && apiKey.trim().length > 0;
    const hasAnyStoredKey = storedProvider !== null;

    const loadSettings = useCallback(async () => {
        try {
            const [settings, keys] = await Promise.all([getAISettings(), getStoredAIKeys()]);

            const normalizedProvider: AIProvider =
                settings.providerPreference === 'gemini'
                    ? 'gemini'
                    : settings.providerPreference === 'openai'
                        ? 'openai'
                        : keys.openAIApiKey.trim()
                            ? 'openai'
                            : keys.geminiApiKey.trim()
                                ? 'gemini'
                                : 'openai';

            setSelectedProvider(normalizedProvider);
            setStoredProvider(keys.openAIApiKey.trim() || keys.geminiApiKey.trim() ? normalizedProvider : null);
            setApiKey(normalizedProvider === 'openai' ? keys.openAIApiKey : keys.geminiApiKey);
        } catch (error) {
            console.error('Failed to load AI settings:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Load Failed',
                message: 'Could not load your AI provider settings.',
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

    const handleProviderSelect = async (provider: AIProvider) => {
        setSelectedProvider(provider);
        setShowKey(false);

        if (storedProvider === provider) {
            const keys = await getStoredAIKeys();
            setApiKey(provider === 'openai' ? keys.openAIApiKey : keys.geminiApiKey);
            return;
        }

        setApiKey('');
    };

    const handlePaste = async () => {
        try {
            const value = await Clipboard.getString();
            if (!value?.trim()) {
                setAlertConfig({
                    visible: true,
                    type: 'info',
                    title: 'Nothing To Paste',
                    message: 'Your clipboard is empty or does not contain an API key yet.',
                    confirmText: 'Okay',
                    onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
                });
                return;
            }

            setApiKey(value.trim());
        } catch (error) {
            console.error('Clipboard read failed:', error);
        }
    };

    const handleSave = async () => {
        if (apiKey.trim().length < 10) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: `Invalid ${selectedConfig.label} Key`,
                message: `Please enter a valid ${selectedConfig.label} API key before saving.`,
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
            return;
        }

        setIsSaving(true);
        try {
            const trimmedKey = apiKey.trim();

            if (selectedProvider === 'openai') {
                await setOpenAIApiKey(trimmedKey);
                await removeGeminiApiKey();
            } else {
                await setGeminiApiKey(trimmedKey);
                await removeOpenAIApiKey();
            }

            await setAIProviderPreference(selectedProvider);
            setStoredProvider(selectedProvider);
            setApiKey(trimmedKey);

            setAlertConfig({
                visible: true,
                type: 'success',
                title: `${selectedConfig.label} Connected`,
                message: `${selectedConfig.label} is now your active AI provider. The other provider key was replaced.`,
                confirmText: 'Great',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } catch (error) {
            console.error('Failed to save AI key:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Save Failed',
                message: `Could not save your ${selectedConfig.label} API key.`,
                confirmText: 'OK',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = () => {
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: `Remove ${selectedConfig.label} Key`,
            message: `This will disable AI until you save a new ${selectedConfig.label} key or switch providers.`,
            confirmText: 'Remove',
            confirmType: 'destructive',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setIsSaving(true);
                try {
                    if (selectedProvider === 'openai') {
                        await removeOpenAIApiKey();
                    } else {
                        await removeGeminiApiKey();
                    }

                    setApiKey('');
                    setStoredProvider(null);
                    setShowKey(false);
                } catch (error) {
                    console.error('Failed to remove AI key:', error);
                } finally {
                    setIsSaving(false);
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        });
    };

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
                <Header title="API Keys & AI Provider" />
                <LoadingScreen message="Loading AI provider settings..." />
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
                style={styles.flex}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <Animated.View entering={FadeInDown.duration(380)}>
                        <LinearGradient
                            colors={theme.dark ? ['#0d1b2e', '#0f2547', '#132f5c'] : ['#0b1f45', '#1040a0', '#1a56d6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroCard}
                        >
                            <View style={styles.heroOrb1} />
                            <View style={styles.heroOrb2} />

                            <View style={styles.heroTopRow}>
                                <View style={styles.heroEyebrowWrap}>
                                    <View style={styles.heroEyebrowDot} />
                                    <Text style={styles.heroEyebrow}>AI SETUP</Text>
                                </View>
                                <View
                                    style={[
                                        styles.heroBadge,
                                        { backgroundColor: hasAnyStoredKey ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.1)' },
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.heroBadgeDot,
                                            { backgroundColor: hasAnyStoredKey ? '#10b981' : 'rgba(255,255,255,0.4)' },
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            styles.heroBadgeText,
                                            { color: hasAnyStoredKey ? '#6ee7b7' : 'rgba(255,255,255,0.7)' },
                                        ]}
                                    >
                                        {hasAnyStoredKey ? 'Connected' : 'Not Connected'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.heroTitle}>
                                Connect your{'\n'}AI provider
                            </Text>
                            <Text style={styles.heroSubtitle}>
                                One key powers all AI features - summaries, rewrites, and smart descriptions throughout the app.
                            </Text>

                            <View style={styles.heroChips}>
                                <View style={styles.heroChip}>
                                    {renderProviderIcon(selectedProvider, 14, 'rgba(255,255,255,0.85)')}
                                    <Text style={styles.heroChipText} numberOfLines={1}>
                                        {hasAnyStoredKey ? `${storedProvider === 'openai' ? 'OpenAI' : 'Gemini'} active` : 'No active provider'}
                                    </Text>
                                </View>
                                <View style={styles.heroChip}>
                                    <HugeiconsIcon icon={TickDouble02Icon} size={14} color="rgba(255,255,255,0.8)" />
                                    <Text style={styles.heroChipText}>1 key at a time</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </Animated.View>

                    <Animated.View
                        entering={FadeInDown.duration(380).delay(60)}
                        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    >
                        <View style={styles.cardHeader}>
                            <Text style={[styles.cardEyebrow, { color: theme.colors.textSecondary }]}>PROVIDER</Text>
                            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                            Choose AI Provider
                            </Text>
                            <Text style={[styles.cardBody, { color: theme.colors.textSecondary }]}>
                                Select the provider for all online AI features in the app.
                            </Text>
                        </View>

                        <View style={styles.providerGrid}>
                            {PROVIDERS.map((provider) => {
                                const isSelected = provider.id === selectedProvider;
                                const isActive = provider.id === storedProvider && apiKey.trim().length > 0;

                                return (
                                    <TouchableOpacity
                                        key={provider.id}
                                        activeOpacity={0.86}
                                        onPress={() => handleProviderSelect(provider.id)}
                                        style={[
                                            styles.providerCard,
                                            {
                                                backgroundColor: isSelected ? provider.accent + '12' : theme.colors.background,
                                                borderColor: isSelected ? provider.accent + '40' : theme.colors.border,
                                            },
                                        ]}
                                    >
                                        {isSelected ? <View style={[styles.providerAccentBar, { backgroundColor: provider.accent }]} /> : null}

                                        <View style={styles.providerCardInner}>
                                            <View style={[styles.providerIconBox, { backgroundColor: provider.accent + '16' }]}>
                                                {renderProviderIcon(provider.id, 24, provider.accent)}
                                            </View>

                                            <View style={styles.providerInfo}>
                                                <View style={styles.providerNameRow}>
                                                    <Text style={[styles.providerName, { color: theme.colors.text }]}>{provider.label}</Text>
                                                    {isActive ? (
                                                        <View style={[styles.activeBadge, { backgroundColor: theme.colors.success + '18' }]}>
                                                            <Text style={[styles.activeBadgeText, { color: theme.colors.success }]}>ACTIVE</Text>
                                                        </View>
                                                    ) : null}
                                                </View>
                                                <Text style={[styles.providerCaption, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                                                    {provider.caption}
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.radioRing,
                                                    {
                                                        borderColor: isSelected ? provider.accent : theme.colors.border,
                                                        backgroundColor: isSelected ? provider.accent : 'transparent',
                                                    },
                                                ]}
                                            >
                                                {isSelected ? <View style={styles.radioDot} /> : null}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={[styles.providerDesc, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                            <View style={[styles.providerDescBar, { backgroundColor: selectedConfig.accent }]} />
                            <View style={styles.providerDescContent}>
                                <Text style={[styles.providerDescLabel, { color: selectedConfig.accent }]}>About {selectedConfig.label}</Text>
                                <Text style={[styles.providerDescText, { color: theme.colors.textSecondary }]}>
                                    {selectedConfig.subtitle}
                                </Text>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View
                        entering={FadeInDown.duration(380).delay(120)}
                        style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    >
                        <View style={styles.keyHeaderRow}>
                            <View style={styles.keyHeaderLeft}>
                                <Text style={[styles.cardEyebrow, { color: theme.colors.textSecondary }]}>API KEY</Text>
                                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                                    {selectedConfig.label} API Key
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => Linking.openURL(selectedConfig.helpUrl)}
                                activeOpacity={0.8}
                                style={[styles.getKeyButton, { backgroundColor: selectedConfig.accent + '14', borderColor: selectedConfig.accent + '30' }]}
                            >
                                <HugeiconsIcon icon={Link01Icon} size={15} color={selectedConfig.accent} />
                                <Text style={[styles.getKeyText, { color: selectedConfig.accent }]}>Get Key</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.cardBody, { color: theme.colors.textSecondary, marginTop: 6 }]}>
                            Saving here activates this provider and removes the previous key.
                        </Text>

                        <View
                            style={[
                                styles.statusRow,
                                {
                                    backgroundColor: isSelectedProviderStored ? theme.colors.success + '0e' : selectedConfig.accent + '0e',
                                    borderColor: isSelectedProviderStored ? theme.colors.success + '30' : selectedConfig.accent + '28',
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusIconWrap,
                                    {
                                        backgroundColor: isSelectedProviderStored ? theme.colors.success + '20' : selectedConfig.accent + '18',
                                    },
                                ]}
                            >
                                <HugeiconsIcon
                                    icon={isSelectedProviderStored ? TickDouble02Icon : Alert01Icon}
                                    size={15}
                                    color={isSelectedProviderStored ? theme.colors.success : selectedConfig.accent}
                                />
                            </View>
                            <View style={styles.statusText}>
                                <Text style={[styles.statusTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                    {isSelectedProviderStored ? `${selectedConfig.label} is ready` : `${selectedConfig.label} key not saved`}
                                </Text>
                                <Text style={[styles.statusSub, { color: theme.colors.textSecondary }]}>
                                    {isSelectedProviderStored
                                        ? 'This provider is powering all AI features.'
                                        : hasAnyStoredKey
                                            ? `Saving will replace your ${storedProvider === 'openai' ? 'OpenAI' : 'Gemini'} key.`
                                            : 'Your key is stored locally on this device.'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.inputSection}>
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Key Input</Text>
                            <View style={[styles.inputShell, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                <View style={[styles.inputLeadIcon, { backgroundColor: selectedConfig.accent + '14' }]}>
                                    {renderProviderIcon(selectedProvider, 18, selectedConfig.accent)}
                                </View>

                                <TextInput
                                    value={apiKey}
                                    onChangeText={setApiKey}
                                    style={[styles.inputField, { color: theme.colors.text }]}
                                    placeholder={`Paste ${selectedConfig.label} API key...`}
                                    placeholderTextColor={theme.colors.textSecondary}
                                    secureTextEntry={!showKey}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />

                                {apiKey.trim().length === 0 ? (
                                    <TouchableOpacity
                                        onPress={handlePaste}
                                        activeOpacity={0.8}
                                        style={[styles.inputTrailingBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    >
                                        <HugeiconsIcon icon={Task01Icon} size={17} color={selectedConfig.accent} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => setShowKey((prev) => !prev)}
                                        activeOpacity={0.8}
                                        style={[styles.inputTrailingBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    >
                                        <HugeiconsIcon icon={showKey ? ViewOffIcon : ViewIcon} size={17} color={theme.colors.icon} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
                                Only one provider key can be active at a time.
                            </Text>
                        </View>

                        <View style={styles.actionStack}>
                            <Button
                                title={isSelectedProviderStored ? `Update ${selectedConfig.label} Key` : `Save ${selectedConfig.label} Key`}
                                onPress={handleSave}
                                isLoading={isSaving}
                                style={styles.fullWidthBtn}
                            />

                            {isSelectedProviderStored ? (
                                <Button
                                    title={`Remove ${selectedConfig.label} Key`}
                                    variant="outline"
                                    onPress={handleRemove}
                                    style={[styles.fullWidthBtn, { borderColor: theme.colors.danger + '2e' }]}
                                    textStyle={{ color: theme.colors.danger }}
                                    icon={<HugeiconsIcon icon={Delete02Icon} size={17} color={theme.colors.danger} />}
                                />
                            ) : null}
                        </View>
                    </Animated.View>

                    <Animated.View
                        entering={FadeInDown.duration(380).delay(180)}
                        style={[styles.footerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                    >
                        <View style={styles.footerDivider}>
                            <View style={[styles.footerDividerLine, { backgroundColor: theme.colors.border }]} />
                            <Text style={[styles.footerDividerLabel, { color: theme.colors.textSecondary, backgroundColor: theme.colors.card }]}>
                                HOW IT WORKS
                            </Text>
                            <View style={[styles.footerDividerLine, { backgroundColor: theme.colors.border }]} />
                        </View>
                        <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                            Your selected provider becomes the app-wide AI source for summaries, entry descriptions, and rewrite modes. Switching providers later will automatically replace the old key with the new one.
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: {
        padding: 20,
        paddingBottom: 120,
        gap: 16,
    },

    heroCard: {
        borderRadius: 26,
        padding: 24,
        overflow: 'hidden',
    },
    heroOrb1: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(99,179,237,0.07)',
        top: -50,
        right: -40,
    },
    heroOrb2: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(168,85,247,0.06)',
        bottom: -30,
        left: 20,
    },
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    heroEyebrowWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    heroEyebrowDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(147,197,253,0.7)',
    },
    heroEyebrow: {
        color: 'rgba(186,220,255,0.75)',
        fontSize: 10,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: 1.4,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
    },
    heroBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    heroBadgeText: {
        fontSize: 11,
        fontFamily: 'Nunito_700Bold',
    },
    heroTitle: {
        color: '#ffffff',
        fontSize: 28,
        lineHeight: 34,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: -0.6,
    },
    heroSubtitle: {
        marginTop: 10,
        color: 'rgba(255,255,255,0.72)',
        fontSize: 13,
        lineHeight: 21,
        fontFamily: 'Nunito_600SemiBold',
    },
    heroChips: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 10,
    },
    heroChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    heroChipText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        fontFamily: 'Nunito_700Bold',
    },

    card: {
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        gap: 0,
    },
    cardHeader: {
        marginBottom: 16,
    },
    cardEyebrow: {
        fontSize: 10,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 19,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: -0.4,
    },
    cardBody: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Nunito_600SemiBold',
        marginTop: 5,
    },

    providerGrid: {
        gap: 10,
        marginBottom: 14,
    },
    providerCard: {
        borderWidth: 1,
        borderRadius: 22,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    providerAccentBar: {
        width: 3,
        borderRadius: 2,
        marginVertical: 12,
        marginLeft: 12,
    },
    providerCardInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        paddingLeft: 12,
        gap: 12,
    },
    providerIconBox: {
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    providerInfo: {
        flex: 1,
        gap: 3,
    },
    providerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    providerName: {
        fontSize: 16,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: -0.2,
    },
    activeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    activeBadgeText: {
        fontSize: 9,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: 0.9,
    },
    providerCaption: {
        fontSize: 12,
        lineHeight: 17,
        fontFamily: 'Nunito_600SemiBold',
    },
    radioRing: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ffffff',
    },

    providerDesc: {
        borderWidth: 1,
        borderRadius: 16,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    providerDescBar: {
        width: 3,
    },
    providerDescContent: {
        flex: 1,
        padding: 14,
        paddingLeft: 13,
        gap: 4,
    },
    providerDescLabel: {
        fontSize: 11,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: 0.4,
    },
    providerDescText: {
        fontSize: 12,
        lineHeight: 18,
        fontFamily: 'Nunito_600SemiBold',
    },

    keyHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    keyHeaderLeft: {
        flex: 1,
    },
    getKeyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 4,
    },
    getKeyText: {
        fontSize: 12,
        fontFamily: 'Nunito_700Bold',
    },

    statusRow: {
        marginTop: 16,
        borderWidth: 1,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
    },
    statusIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    statusText: {
        flex: 1,
        gap: 3,
    },
    statusTitle: {
        fontSize: 14,
        fontFamily: 'Nunito_800ExtraBold',
    },
    statusSub: {
        fontSize: 12,
        lineHeight: 17,
        fontFamily: 'Nunito_600SemiBold',
    },

    inputSection: {
        marginTop: 16,
        gap: 0,
    },
    inputLabel: {
        fontSize: 10,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: 1.2,
        marginBottom: 8,
    },
    inputShell: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 12,
        minHeight: 56,
        gap: 10,
    },
    inputLeadIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputField: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Nunito_600SemiBold',
        paddingVertical: 14,
    },
    inputTrailingBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputHint: {
        marginTop: 8,
        fontSize: 11,
        lineHeight: 16,
        fontFamily: 'Nunito_600SemiBold',
    },
    actionStack: {
        marginTop: 16,
        gap: 10,
    },
    fullWidthBtn: {
        width: '100%',
    },

    footerCard: {
        borderWidth: 1,
        borderRadius: 20,
        padding: 18,
    },
    footerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    footerDividerLine: {
        flex: 1,
        height: 1,
    },
    footerDividerLabel: {
        fontSize: 9,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: 1.2,
        paddingHorizontal: 4,
    },
    footerText: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Nunito_600SemiBold',
    },
});
