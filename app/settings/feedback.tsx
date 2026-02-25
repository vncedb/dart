import { ChatFeedback01Icon, SentIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const CATEGORIES = ['Bug Report', 'Feature Suggestion', 'Performance Issue', 'Other'];
const MAX_WORDS = 1000;

export default function FeedbackScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth(); 

    const scrollViewRef = useRef<ScrollView>(null);

    const [category, setCategory] = useState(CATEGORIES[0]);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Track keyboard state
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
        
        return () => { 
            showSub.remove(); 
            hideSub.remove(); 
        };
    }, []);

    // Calculate current word count
    const getWordCount = (text: string) => {
        if (!text.trim()) return 0;
        return text.trim().split(/\s+/).length;
    };

    const wordCount = getWordCount(feedback);

    const handleFeedbackChange = (text: string) => {
        if (getWordCount(text) <= MAX_WORDS || text.length < feedback.length) {
            setFeedback(text);
        }
    };

    const handleSubmit = async () => {
        if (!feedback.trim()) {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Missing Details',
                message: 'Please describe your feedback or issue before submitting.',
                onConfirm: () => setAlertConfig({ visible: false })
            });
            return;
        }

        Keyboard.dismiss();
        setIsSubmitting(true);

        try {
            const { error } = await supabase.functions.invoke('send-email', {
                body: {
                    email: 'dart.vdb@gmail.com', 
                    type: 'FEEDBACK',
                    data: {
                        sender: user?.email || 'Unknown User',
                        category: category,
                        message: feedback,
                    }
                }
            });

            if (error) throw error;

            setFeedback('');
            setCategory(CATEGORIES[0]);
            
            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Sent Successfully!',
                message: 'Your feedback was sent directly to our team. Thank you for helping improve DART.',
                onConfirm: () => {
                    setAlertConfig({ visible: false });
                    router.back();
                }
            });

        } catch (error) {
            console.error("Direct Send Error:", error);
            try {
                await supabase.from('app_feedback').insert({
                    user_id: user?.id,
                    email: user?.email,
                    message: `[${category}] ${feedback}`
                });
                
                setFeedback('');
                setCategory(CATEGORIES[0]);
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Feedback Saved!',
                    message: 'Your feedback has been securely logged.',
                    onConfirm: () => {
                        setAlertConfig({ visible: false });
                        router.back();
                    }
                });
            } catch {
                setAlertConfig({
                    visible: true,
                    type: 'error',
                    title: 'Submission Failed',
                    message: 'Could not send feedback. Please verify your internet connection.',
                    onConfirm: () => setAlertConfig({ visible: false })
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
                <ModernAlert {...alertConfig} />
                <LoadingOverlay visible={isSubmitting} message="Submitting..." />

                <Header title="Report / Feedback" />

                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={{ flex: 1 }}
                >
                    <ScrollView 
                        ref={scrollViewRef}
                        contentContainerStyle={[
                            styles.scrollContent, 
                            // Ensure bottom padding accounts for the absolute footer when keyboard is closed
                            { paddingBottom: isKeyboardVisible ? 20 : 120 } 
                        ]} 
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Redesigned Header Area */}
                        <View style={styles.headerArea}>
                            <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                <HugeiconsIcon icon={ChatFeedback01Icon} size={32} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.title, { color: theme.colors.text }]}>Help us improve</Text>
                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                We&apos;re constantly evolving. Let us know about any bugs or features you&apos;d like to see in DART.
                            </Text>
                        </View>

                        {/* Redesigned Category Selection */}
                        <View style={styles.categoryContainer}>
                            <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Feedback Type</Text>
                            <View style={styles.chipRow}>
                                {CATEGORIES.map(cat => {
                                    const isSelected = category === cat;
                                    return (
                                        <TouchableOpacity
                                            key={cat}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setCategory(cat);
                                            }}
                                            style={[
                                                styles.chip,
                                                { 
                                                    backgroundColor: isSelected ? theme.colors.primary : 'transparent', 
                                                    borderColor: isSelected ? theme.colors.primary : theme.colors.border 
                                                }
                                            ]}
                                        >
                                            <Text style={[
                                                styles.chipText, 
                                                { 
                                                    color: isSelected ? '#fff' : theme.colors.text,
                                                    fontWeight: isSelected ? '700' : '500' 
                                                }
                                            ]}>
                                                {cat}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Redesigned Input Area */}
                        <Text style={[styles.sectionLabel, { color: theme.colors.text }]}>Details</Text>
                        <View style={[
                            styles.inputContainer, 
                            { 
                                backgroundColor: theme.colors.card, 
                                borderColor: isFocused ? theme.colors.primary : theme.colors.border,
                                // Subtle elevation when focused
                                shadowOpacity: isFocused ? 0.1 : 0.02,
                            }
                        ]}>
                            <TextInput
                                value={feedback}
                                onChangeText={handleFeedbackChange}
                                onFocus={() => {
                                    setIsFocused(true);
                                    // Robust scroll logic: wait for keyboard to fully deploy, then push to bottom
                                    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
                                }}
                                onBlur={() => setIsFocused(false)}
                                placeholder="Describe your experience or feature idea..."
                                placeholderTextColor={theme.colors.textSecondary}
                                multiline
                                style={[styles.input, { color: theme.colors.text }]}
                                textAlignVertical="top"
                            />
                            
                            <View style={styles.wordCountContainer}>
                                <Text style={[
                                    styles.wordCountText, 
                                    { color: wordCount >= MAX_WORDS ? theme.colors.danger : theme.colors.textSecondary }
                                ]}>
                                    {wordCount} / {MAX_WORDS}
                                </Text>
                            </View>
                        </View>

                        {/* Dynamic Spacer: Expands heavily when typing so the input is forcefully pushed above the keyboard */}
                        <View style={{ height: isFocused ? 200 : 20 }} />
                        
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Footer stays anchored to the absolute bottom and hides safely when keyboard appears */}
                {!isKeyboardVisible && (
                    <View style={[styles.absoluteFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <Footer>
                            <Button 
                                title="Submit Feedback" 
                                variant="primary" 
                                onPress={handleSubmit} 
                                icon={<HugeiconsIcon icon={SentIcon} size={20} color="#fff" />} 
                            />
                        </Footer>
                    </View>
                )}
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    scrollContent: { 
        padding: 24, 
        flexGrow: 1, 
    },
    headerArea: {
        alignItems: 'center', // Center aligned for a modern intro look
        marginBottom: 36,
        marginTop: 12,
    },
    iconBox: {
        width: 72,
        height: 72,
        borderRadius: 24, // Squircle shape
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: { 
        fontSize: 24, 
        fontWeight: '800', 
        marginBottom: 10, 
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    subtitle: { 
        fontSize: 15, 
        lineHeight: 24, 
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        opacity: 0.6,
        marginLeft: 4,
    },
    categoryContainer: {
        marginBottom: 32,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 16,
        borderWidth: 1.5,
    },
    chipText: {
        fontSize: 14,
    },
    inputContainer: {
        borderWidth: 1.5,
        borderRadius: 20, // Modern large border radius
        minHeight: 200,
        padding: 18,
        paddingBottom: 45, // Reserved space for the word counter
        marginBottom: 10,
        // Modern shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 2,
    },
    input: {
        flex: 1,
        fontSize: 16,
        lineHeight: 26,
    },
    wordCountContainer: {
        position: 'absolute',
        bottom: 16,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.04)', // Subtle badge background
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    wordCountText: {
        fontSize: 12,
        fontWeight: '700',
    },
    absoluteFooter: {
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        backgroundColor: 'transparent'
    }
});