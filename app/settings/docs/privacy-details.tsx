// filepath: app/settings/docs/privacy-details.tsx
import { Shield02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../../components/Header';
import { useAppTheme } from '../../../constants/theme';

export default function PrivacyDetailsScreen() {
    const theme = useAppTheme();

    const Section = ({ number, title, content }: { number: string, title: string, content: string }) => (
        <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeader}>
                <View style={[styles.numberBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.numberText, { color: theme.colors.primary }]}>{number}</Text>
                </View>
                <Text style={[styles.heading, { color: theme.colors.text }]}>{title}</Text>
            </View>
            <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{content}</Text>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="Privacy Policy" />
            
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.headerArea}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                        <HugeiconsIcon icon={Shield02Icon} size={36} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.mainTitle, { color: theme.colors.text }]}>Data Privacy</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Effective Date: March 2026
                    </Text>
                </View>

                <Section 
                    number="1"
                    title="Information We Collect" 
                    content="We collect personal data that you provide directly to us, including your name, email address, job title, and daily work logs. For DART Pro users, we also collect billing history and subscription status. We do not store biometric data on our servers; this remains securely on your local device." 
                />
                <Section 
                    number="2"
                    title="Subscription & Payment Data" 
                    content="When you upgrade to DART Pro, payment information is processed securely by our trusted third-party payment gateways (e.g., Apple, Google, or Stripe). DART does not store your raw credit card numbers. We only store your active plan tier, billing cycle dates, and invoice history to provide premium features seamlessly." 
                />
                <Section 
                    number="3"
                    title="How We Use Your Data" 
                    content="Your data is used strictly to provide, maintain, and improve the DART service. This includes generating automated daily reports, authenticating your login, unlocking premium subscription features, and syncing your history across your authorized devices." 
                />
                <Section 
                    number="4"
                    title="Data Sharing & Disclosure" 
                    content="We respect your privacy. We do not sell, trade, or rent your personal information to third parties. Data is only shared with trusted service providers under strict confidentiality agreements, including payment processors required to manage DART Pro subscriptions." 
                />
                <Section 
                    number="5"
                    title="Data Security" 
                    content="We implement enterprise-grade security measures, including end-to-end encryption and secure database policies (RLS), to protect your personal information and subscription details against unauthorized access or alteration." 
                />
                <Section 
                    number="6"
                    title="Your Rights" 
                    content="You retain full ownership of your data. You have the right to access, modify, export, or permanently delete your account and all associated data at any time via the Settings menu." 
                />
                
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    headerArea: { alignItems: 'center', marginBottom: 32, marginTop: 12 },
    iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    mainTitle: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', marginBottom: 6, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
    sectionCard: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    numberBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    numberText: { fontSize: 13, fontFamily: 'Nunito_800ExtraBold' },
    heading: { flex: 1, fontSize: 17, fontFamily: 'Nunito_700Bold', letterSpacing: -0.2 },
    paragraph: { fontSize: 15, fontFamily: 'Nunito_500Medium', lineHeight: 24, opacity: 0.9 },
});