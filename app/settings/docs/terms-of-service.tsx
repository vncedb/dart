import { File02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../../components/Header';
import { useAppTheme } from '../../../constants/theme';

export default function TermsOfServiceScreen() {
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
            <Header title="Terms of Service" />
            
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <View style={styles.headerArea}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                        <HugeiconsIcon icon={File02Icon} size={36} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.mainTitle, { color: theme.colors.text }]}>Terms & Conditions</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Effective Date: February 2026
                    </Text>
                </View>

                <Section 
                    number="1"
                    title="Acceptance of Terms" 
                    content="By creating an account and using DART, you agree to comply with and be bound by these Terms of Service. If you do not agree, please do not use the application." 
                />
                <Section 
                    number="2"
                    title="User Responsibilities" 
                    content="You are responsible for maintaining the confidentiality of your login credentials. You agree to provide accurate, current, and complete information during the registration process." 
                />
                <Section 
                    number="3"
                    title="Acceptable Use" 
                    content="DART is designed for attendance and work logging. You agree not to use the app for any unlawful purposes, to submit false attendance logs, or to attempt to breach the app's security." 
                />
                <Section 
                    number="4"
                    title="Intellectual Property" 
                    content="All content, features, and functionality of DART, including but not limited to designs, logos, and code, are the exclusive property of DART developers and are protected by copyright laws." 
                />
                <Section 
                    number="5"
                    title="Account Termination" 
                    content="We reserve the right to suspend or terminate your account at any time, without prior notice, for conduct that we believe violates these Terms of Service or is harmful to our business." 
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