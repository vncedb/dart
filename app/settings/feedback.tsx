import { Camera02Icon, Cancel01Icon, PencilEdit02Icon, SentIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
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

export default function FeedbackScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { user } = useAuth(); 

    const [feedback, setFeedback] = useState('');
    const [screenshots, setScreenshots] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.5,
            base64: true 
        });

        if (!result.canceled) {
            const newUris = result.assets.map(a => a.uri);
            setScreenshots(prev => [...prev, ...newUris].slice(0, 3));
        }
    };

    const removeScreenshot = (index: number) => {
        setScreenshots(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!feedback.trim()) {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Empty Field',
                message: 'Please enter your feedback or describe the bug before submitting.',
                onConfirm: () => setAlertConfig({ visible: false })
            });
            return;
        }

        Keyboard.dismiss();
        setIsSubmitting(true);

        try {
            // Triggering the updated Edge Function payload
            const { error } = await supabase.functions.invoke('send-email', {
                body: {
                    email: 'dart.vdb@gmail.com', 
                    type: 'FEEDBACK',
                    data: {
                        sender: user?.email || 'Unknown User',
                        message: feedback,
                    }
                }
            });

            if (error) throw error;

            setFeedback('');
            setScreenshots([]);
            
            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Sent!',
                message: 'Your feedback has been sent directly to our team. Thank you!',
                onConfirm: () => {
                    setAlertConfig({ visible: false });
                    router.back();
                }
            });

        } catch (error) {
            console.error("Direct Send Error:", error);
            
            // Offline/Fail safe: Push straight to Supabase database if the Edge function fails
            try {
                await supabase.from('app_feedback').insert({
                    user_id: user?.id,
                    email: user?.email,
                    message: feedback
                });
                
                setFeedback('');
                setScreenshots([]);
                setAlertConfig({
                    visible: true,
                    type: 'success',
                    title: 'Feedback Saved!',
                    message: 'We recorded your feedback. Thank you!',
                    onConfirm: () => {
                        setAlertConfig({ visible: false });
                        router.back();
                    }
                });
            } catch {
                setAlertConfig({
                    visible: true,
                    type: 'error',
                    title: 'Error',
                    message: 'Could not send feedback. Please check your internet connection.',
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
                <LoadingOverlay visible={isSubmitting} message="Sending Feedback..." />

                <Header title="Report / Feedback" />

                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.headerArea}>
                            <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                <HugeiconsIcon icon={PencilEdit02Icon} size={28} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.title, { color: theme.colors.text }]}>We value your thoughts!</Text>
                            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                                Found a bug or have a suggestion to improve DART? Let us know. Your feedback goes directly to our team without leaving the app.
                            </Text>
                        </View>

                        <View style={[
                            styles.inputContainer, 
                            { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
                        ]}>
                            <TextInput
                                value={feedback}
                                onChangeText={setFeedback}
                                placeholder="Type your feedback or report here..."
                                placeholderTextColor={theme.colors.textSecondary}
                                multiline
                                style={[styles.input, { color: theme.colors.text }]}
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.screenshotSection}>
                            <View style={styles.screenshotHeader}>
                                <Text style={[styles.screenshotTitle, { color: theme.colors.text }]}>Attachments (Optional)</Text>
                                <Text style={[styles.screenshotCount, { color: theme.colors.textSecondary }]}>
                                    {screenshots.length}/3
                                </Text>
                            </View>
                            
                            <View style={styles.screenshotGrid}>
                                {screenshots.map((uri, index) => (
                                    <View key={index} style={styles.imageWrapper}>
                                        <Image source={{ uri }} style={styles.imagePreview} />
                                        <TouchableOpacity 
                                            onPress={() => removeScreenshot(index)}
                                            style={styles.removeImageBtn}
                                        >
                                            <HugeiconsIcon icon={Cancel01Icon} size={16} color="#FFF" />
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {screenshots.length < 3 && (
                                    <TouchableOpacity 
                                        onPress={handlePickImage}
                                        style={[styles.addImageBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                    >
                                        <HugeiconsIcon icon={Camera02Icon} size={24} color={theme.colors.textSecondary} />
                                        <Text style={[styles.addImageText, { color: theme.colors.textSecondary }]}>Add Photo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* Fix: Passes exactly a valid ReactNode JSX element! */}
                <Footer>
                    <Button 
                        title="Submit Feedback" 
                        variant="primary" 
                        onPress={handleSubmit} 
                        icon={<HugeiconsIcon icon={SentIcon} size={20} color="#fff" />} 
                    />
                </Footer>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    scrollContent: { 
        padding: 24, 
        paddingBottom: 40 
    },
    headerArea: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 10,
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: { 
        fontSize: 22, 
        fontWeight: '800', 
        marginBottom: 8, 
        letterSpacing: -0.5,
        textAlign: 'center' 
    },
    subtitle: { 
        fontSize: 15, 
        lineHeight: 22, 
        textAlign: 'center',
        paddingHorizontal: 10
    },
    inputContainer: {
        borderWidth: 1,
        borderRadius: 20,
        minHeight: 180,
        padding: 16,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2
    },
    input: {
        flex: 1,
        fontSize: 16,
        lineHeight: 24,
    },
    screenshotSection: {
        marginBottom: 10
    },
    screenshotHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    screenshotTitle: {
        fontSize: 14,
        fontWeight: '700'
    },
    screenshotCount: {
        fontSize: 12,
        fontWeight: '600'
    },
    screenshotGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    imageWrapper: {
        width: 80,
        height: 80,
        borderRadius: 12,
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    removeImageBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#ef4444',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF'
    },
    addImageBtn: {
        width: 80,
        height: 80,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
    },
    addImageText: {
        fontSize: 10,
        fontWeight: '700'
    }
});