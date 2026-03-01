// filepath: app/settings/changelog.tsx
import {
    ArrowUpRight01Icon,
    Bug02Icon,
    Megaphone01Icon,
    PlusSignIcon,
    RefreshIcon,
    SparklesIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import { AppChangelog, ChangelogCategory } from '../../constants/ChangelogData';
import { useAppTheme } from '../../constants/theme';

const getCategoryConfig = (type: ChangelogCategory, theme: any) => {
    switch (type) {
        case 'Highlights':
            return { icon: SparklesIcon, color: '#8B5CF6', bg: '#8B5CF615' }; // Purple
        case "What's New":
            return { icon: Megaphone01Icon, color: theme.colors.primary, bg: theme.colors.primary + '15' };
        case 'Improvements':
            return { icon: ArrowUpRight01Icon, color: '#3B82F6', bg: '#3B82F615' }; // Blue
        case 'Fixes':
            return { icon: Bug02Icon, color: theme.colors.danger, bg: theme.colors.danger + '15' }; // Red
        case 'Added':
            return { icon: PlusSignIcon, color: theme.colors.success, bg: theme.colors.success + '15' }; // Green
        case 'Changed':
            return { icon: RefreshIcon, color: '#F59E0B', bg: '#F59E0B15' }; // Orange
        default:
            return { icon: SparklesIcon, color: theme.colors.textSecondary, bg: theme.colors.border };
    }
};

export default function ChangelogScreen() {
    const theme = useAppTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            
            {/* UPDATED TITLE HERE */}
            <Header title="Changelog" onBack={() => router.back()} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {AppChangelog.map((release, index) => (
                    <View key={release.version} style={styles.releaseContainer}>
                        
                        {/* Release Header */}
                        <View style={styles.releaseHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Text style={[styles.versionText, { color: theme.colors.text }]}>
                                    Version {release.version}
                                </Text>
                                {index === 0 && (
                                    <View style={[styles.latestBadge, { backgroundColor: theme.colors.primary }]}>
                                        <Text style={styles.latestBadgeText}>LATEST</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>
                                {release.date}
                            </Text>
                        </View>

                        {/* Release Categories */}
                        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            {release.categories.map((category, catIndex) => {
                                const config = getCategoryConfig(category.type, theme);
                                
                                return (
                                    <View key={category.type} style={[styles.categoryBlock, catIndex > 0 && { marginTop: 24 }]}>
                                        
                                        {/* Category Title Pill */}
                                        <View style={[styles.categoryTitleContainer, { backgroundColor: config.bg }]}>
                                            <HugeiconsIcon icon={config.icon} size={16} color={config.color} />
                                            <Text style={[styles.categoryTitle, { color: config.color }]}>
                                                {category.type}
                                            </Text>
                                        </View>

                                        {/* Items List */}
                                        <View style={styles.itemsList}>
                                            {category.items.map((item, itemIndex) => (
                                                <View key={itemIndex} style={styles.listItem}>
                                                    <View style={[styles.bullet, { backgroundColor: theme.colors.textSecondary, opacity: 0.5 }]} />
                                                    <Text style={[styles.itemText, { color: theme.colors.text }]}>
                                                        {item}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>

                                    </View>
                                );
                            })}
                        </View>

                    </View>
                ))}

                <View style={styles.footer}>
                    <HugeiconsIcon icon={SparklesIcon} size={24} color={theme.colors.textSecondary} />
                    <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                        You&apos;re all caught up!
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        padding: 20,
        paddingBottom: 60,
    },
    releaseContainer: {
        marginBottom: 32,
    },
    releaseHeader: {
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    versionText: {
        fontSize: 24,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: -0.5,
    },
    latestBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    latestBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: 0.5,
    },
    dateText: {
        fontSize: 14,
        fontFamily: 'Nunito_600SemiBold',
        marginTop: 4,
    },
    card: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
    },
    categoryBlock: {
        width: '100%',
    },
    categoryTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 8,
        marginBottom: 12,
    },
    categoryTitle: {
        fontSize: 13,
        fontFamily: 'Nunito_800ExtraBold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    itemsList: {
        gap: 10,
        paddingLeft: 4,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    bullet: {
        width: 5,
        height: 5,
        borderRadius: 3,
        marginTop: 8,
        marginRight: 12,
    },
    itemText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Nunito_500Medium',
        lineHeight: 22,
    },
    footer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 40,
        gap: 8,
        opacity: 0.5,
    },
    footerText: {
        fontSize: 14,
        fontFamily: 'Nunito_600SemiBold',
    }
});