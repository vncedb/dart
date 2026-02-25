import { File02Icon, Shield02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';

export default function PrivacyPolicyScreen() {
    const theme = useAppTheme();

    const Section = ({ title, content }: { title: string, content: string }) => (
        <View style={styles.section}>
            <Text style={[styles.heading, { color: theme.colors.text }]}>{title}</Text>
            <Text style={[styles.paragraph, { color: theme.colors.textSecondary }]}>{content}</Text>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="Privacy Policy" />
            
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={[styles.headerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={styles.iconCircle}>
                        <HugeiconsIcon icon={Shield02Icon} size={32} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.mainTitle, { color: theme.colors.text }]}>Data Privacy</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Last Updated: January 28, 2026
                    </Text>
                </View>

                <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Section title="1. Information Collection" content="We collect information you provide directly to us, such as your name, email address, job details, and work logs. We also automatically collect log information and device information to ensure app stability." />
                    <Section title="2. Use of Information" content="We use the information we collect to operate, maintain, and improve our services. This includes generating your daily reports, syncing data across your devices, and providing customer support." />
                    <Section title="3. Data Storage & Security" content="Your data is stored securely using Supabase. We implement industry-standard security measures to protect against unauthorized access, alteration, or destruction of data." />
                    <Section title="4. User Rights" content="You have the right to access, correct, or delete your personal data at any time. You can manage your data directly within the application settings or contact support for assistance." />
                    <Section title="5. Changes to Policy" content="We may update this privacy policy from time to time. If we make significant changes, we will notify you through the app or by email." />
                </View>

                <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 20 }}>
                    <HugeiconsIcon icon={File02Icon} size={24} color={theme.colors.textSecondary} />
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 8, fontFamily: 'Nunito_600SemiBold' }}>End of Document</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20, paddingBottom: 100 },
    headerCard: { padding: 24, borderRadius: 24, borderWidth: 1, alignItems: 'center', marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
    iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(99, 102, 241, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    mainTitle: { fontSize: 24, fontFamily: 'Nunito_700Bold', marginBottom: 4, letterSpacing: -0.3 },
    subtitle: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
    contentCard: { padding: 24, borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
    section: { marginBottom: 24 },
    heading: { fontSize: 16, fontFamily: 'Nunito_700Bold', marginBottom: 8, letterSpacing: -0.2 },
    paragraph: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', lineHeight: 24 },
});