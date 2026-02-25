import Constants from 'expo-constants';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';

export default function AboutScreen() {
    const theme = useAppTheme();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const appName = Constants.expoConfig?.name || 'DART';
    const releaseDate = "February 2026"; 

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <Header title="About DART" />
            
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <View style={[styles.logoContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.colors.primary }]}>
                    <Image source={isDark ? require('../../assets/images/icon-transparent-white.png') : require('../../assets/images/icon-transparent.png')} style={styles.logo} resizeMode="contain" />
                </View>

                <Text style={[styles.appName, { color: theme.colors.text }]}>
                    {appName}
                </Text>
                
                <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                        Daily Accomplishment Report Tools
                    </Text>
                </View>

                <Text style={[styles.appDesc, { color: theme.colors.textSecondary }]}>
                    A streamlined, secure, and intuitive platform designed to help professionals track their hours and log daily accomplishments with ease.
                </Text>

                <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: "#000" }]}>
                    <View style={styles.infoBlock}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Current Version</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]}>v{appVersion}</Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                    <View style={styles.infoBlock}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Last Updated</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]}>{releaseDate}</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Image source={isDark ? require('../../assets/images/dart-logo-transparent-light.png') : require('../../assets/images/dart-logo-transparent-dark.png')} style={{ width: 100, height: 36, opacity: 0.6, marginBottom: 12 }} resizeMode="contain" />
                    <Text style={[styles.footerDev, { color: theme.colors.text }]}>
                        Crafted with precision by Project Vdb
                    </Text>
                    <Text style={[styles.footerCopy, { color: theme.colors.textSecondary }]}>
                        © {new Date().getFullYear()} All Rights Reserved.
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, alignItems: 'center', paddingBottom: 100 },
    logoContainer: {
        width: 110, height: 110, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
        marginBottom: 28, borderWidth: 1, marginTop: 20, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8
    },
    logo: { width: 64, height: 64 },
    appName: { fontSize: 32, fontFamily: 'Nunito_900Black', letterSpacing: 2, marginBottom: 12 },
    badge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginBottom: 24 },
    badgeText: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    appDesc: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', textAlign: 'center', marginBottom: 48, paddingHorizontal: 16, lineHeight: 24 },
    infoCard: { width: '100%', borderRadius: 24, paddingVertical: 24, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-evenly', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
    infoBlock: { alignItems: 'center', flex: 1 },
    infoLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    infoValue: { fontSize: 18, fontFamily: 'Nunito_700Bold' },
    divider: { width: 1, height: '100%', opacity: 0.6 },
    footer: { marginTop: 64, alignItems: 'center' },
    footerDev: { fontSize: 14, fontFamily: 'Nunito_700Bold', marginBottom: 6 },
    footerCopy: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', opacity: 0.6 }
});