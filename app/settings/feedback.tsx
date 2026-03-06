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
import { SafeAreaView } from 'react-native-safe-area-context';

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
    const { user } = useAuth(); 

    const scrollViewRef = useRef<ScrollView>(null);
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

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

    const getWordCount = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
    const wordCount = getWordCount(feedback);

    const handleFeedbackChange = (text: string) => {
        if (getWordCount(text) <= MAX_WORDS || text.length < feedback.length) {
            setFeedback(text);
        }
    };

    const handleSubmit = async () => {
        if (!feedback.trim()) {
            setAlertConfig({ 
                visible: true, type: 'error', title: 'Missing Details', 
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
                    data: { sender: user?.email || 'Unknown User', category: category, message: feedback } 
                } 
            });
            if (error) throw error;
            
            setFeedback('');
            setCategory(CATEGORIES[0]);
            setAlertConfig({ 
                visible: true, type: 'success', title: 'Sent Successfully!', 
                message: 'Your feedback was sent directly to our team. Thank you for helping improve DART.', 
                onConfirm: () => { setAlertConfig({ visible: false }); router.back(); } 
            });
        } catch {
            try {
                await supabase.from('app_feedback').insert({ user_id: user?.id, email: user?.email, message: `[${category}] ${feedback}` });
                setFeedback('');
                setCategory(CATEGORIES[0]);
                setAlertConfig({ 
                    visible: true, type: 'success', title: 'Feedback Saved!', 
                    message: 'Your feedback has been securely logged.', 
                    onConfirm: () => { setAlertConfig({ visible: false }); router.back(); } 
                });
            } catch {
                setAlertConfig({ 
                    visible: true, type: 'error', title: 'Submission Failed', 
                    message: 'Could not send feedback. Please verify your internet connection.', 
                    onConfirm: () => setAlertConfig({ visible: false }) 
                });
            }
        } finally { 
            setIsSubmitting(false); 
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={isSubmitting} message="Submitting..." />
            
            <Header title="Report / Feedback" />

            {/* KeyboardAvoidingView setup properly with behavior and offset */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <ScrollView 
                    ref={scrollViewRef} 
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false} 
                    keyboardShouldPersistTaps="handled"
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View>
                            
                            <View style={styles.headerArea}>
                                <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                    <HugeiconsIcon icon={ChatFeedback01Icon} size={36} color={theme.colors.primary} />
                                </View>
                                <Text style={[styles.title, { color: theme.colors.text }]}>Help us improve</Text>
                                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                    {`We're constantly evolving. Let us know about any bugs or features you'd like to see in DART.`}
                                </Text>
                            </View>

                            <View style={styles.categoryContainer}>
                                <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Feedback Type</Text>
                                <View style={styles.chipRow}>
                                    {CATEGORIES.map(cat => {
                                        const isSelected = category === cat;
                                        return (
                                            <TouchableOpacity 
                                                key={cat} 
                                                activeOpacity={0.7} 
                                                onPress={() => { Keyboard.dismiss(); setCategory(cat); }} 
                                                style={[
                                                    styles.chip, 
                                                    { 
                                                        backgroundColor: isSelected ? theme.colors.primary : theme.colors.card, 
                                                        borderColor: isSelected ? theme.colors.primary : theme.colors.border 
                                                    }
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.chipText, 
                                                    { 
                                                        color: isSelected ? '#ffffff' : theme.colors.text, 
                                                        fontFamily: isSelected ? 'Nunito_800ExtraBold' : 'Nunito_600SemiBold' 
                                                    }
                                                ]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Details</Text>
                                <View style={[
                                    styles.inputContainer, 
                                    { 
                                        backgroundColor: theme.colors.card, 
                                        borderColor: isFocused ? theme.colors.primary : theme.colors.border, 
                                        shadowOpacity: isFocused ? 0.08 : 0.02 
                                    }
                                ]}>
                                    <TextInput 
                                        value={feedback} 
                                        onChangeText={handleFeedbackChange} 
                                        onFocus={() => { 
                                            setIsFocused(true); 
                                            // Scroll to end automatically when typing
                                            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150); 
                                        }} 
                                        onBlur={() => setIsFocused(false)} 
                                        placeholder="Describe your experience or feature idea..." 
                                        placeholderTextColor={theme.colors.textSecondary} 
                                        multiline 
                                        style={[styles.input, { color: theme.colors.text }]} 
                                        textAlignVertical="top" 
                                    />
                                    <View style={styles.wordCountContainer}>
                                        <Text style={[styles.wordCountText, { color: wordCount >= MAX_WORDS ? theme.colors.danger : theme.colors.textSecondary }]}>
                                            {wordCount} / {MAX_WORDS}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Spacer to push content up when keyboard is open */}
                            <View style={{ height: isKeyboardVisible ? 120 : 100 }} />

                        </View>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Custom Footer Component */}
            {!isKeyboardVisible && (
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
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
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 24, flexGrow: 1 },
    headerArea: { alignItems: 'center', marginBottom: 36, marginTop: 12 },
    iconBox: { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', marginBottom: 10, letterSpacing: -0.5, textAlign: 'center' },
    subtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', lineHeight: 24, textAlign: 'center', paddingHorizontal: 12, opacity: 0.8 },
    sectionLabel: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, marginLeft: 4 },
    categoryContainer: { marginBottom: 32 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1 },
    chipText: { fontSize: 14 },
    inputSection: { marginBottom: 20 },
    inputContainer: { borderWidth: 1, borderRadius: 24, minHeight: 220, padding: 20, paddingBottom: 45, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 2 },
    input: { flex: 1, fontSize: 16, fontFamily: 'Nunito_500Medium', lineHeight: 26 },
    wordCountContainer: { position: 'absolute', bottom: 16, right: 20, backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    wordCountText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
});