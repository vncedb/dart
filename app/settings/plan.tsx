// app/settings/plan.tsx
import {
    ArrowLeft02Icon,
    Cancel01Icon,
    CheckmarkBadge01Icon,
    CheckmarkCircle02Icon,
    Crown02Icon,
    SparklesIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import FloatingAlert from '../../components/FloatingAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

const PRO_FEATURES = [
    "Unlimited Daily Reports",
    "PDF & Excel Export Options",
    "Automatic Cloud Syncing",
    "Advanced Data Insights",
    "Priority Customer Support"
];

const FREE_FEATURES = [
    "Limited Daily Reports",
    "Standard Text Exports",
    "Manual Cloud Syncing",
    "Basic App Insights",
    "Community Support"
];

export default function PlanScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    const { user } = useAuth();
    const isSubscribed = user?.app_metadata?.plan === 'pro'; 

    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
    const [alertConfig, setAlertConfig] = useState({ visible: false, message: "", type: "info" });

    const yearlyOpacity = useSharedValue(0);
    const monthlyOpacity = useSharedValue(1);

    useEffect(() => {
        if (selectedPlan === 'yearly') {
            yearlyOpacity.value = withTiming(1, { duration: 500 });
            monthlyOpacity.value = withTiming(0, { duration: 500 });
        } else {
            yearlyOpacity.value = withTiming(0, { duration: 500 });
            monthlyOpacity.value = withTiming(1, { duration: 500 });
        }
    }, [selectedPlan, monthlyOpacity, yearlyOpacity]);

    const animatedYearlyBg = useAnimatedStyle(() => ({ opacity: yearlyOpacity.value }));
    const animatedMonthlyBg = useAnimatedStyle(() => ({ opacity: monthlyOpacity.value }));

    const handleUpgrade = () => {
        setAlertConfig({ visible: true, message: "Coming soon! Premium subscriptions are on the way.", type: "info" });
    };

    const handleCancelSubscription = () => {
        setAlertConfig({ visible: true, message: "Subscription management coming soon.", type: "warning" });
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            
            {/* Dynamic Animated Premium Backgrounds */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Animated.View style={[StyleSheet.absoluteFill, animatedYearlyBg]}>
                    <Svg height="100%" width="100%">
                        <Defs>
                            <LinearGradient id="gradYearly" x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0" stopColor="#EC4899" stopOpacity={isDark ? "0.15" : "0.08"} />
                                <Stop offset="0.5" stopColor="#F59E0B" stopOpacity={isDark ? "0.1" : "0.05"} />
                                <Stop offset="1" stopColor={theme.colors.background} stopOpacity="1" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#gradYearly)" />
                    </Svg>
                </Animated.View>
                
                <Animated.View style={[StyleSheet.absoluteFill, animatedMonthlyBg]}>
                    <Svg height="100%" width="100%">
                        <Defs>
                            <LinearGradient id="gradMonthly" x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0" stopColor="#8B5CF6" stopOpacity={isDark ? "0.15" : "0.08"} />
                                <Stop offset="0.5" stopColor="#3B82F6" stopOpacity={isDark ? "0.1" : "0.05"} />
                                <Stop offset="1" stopColor={theme.colors.background} stopOpacity="1" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#gradMonthly)" />
                    </Svg>
                </Animated.View>
            </View>

            <FloatingAlert 
                visible={alertConfig.visible} 
                message={alertConfig.message} 
                type={alertConfig.type as any} 
                position="top" 
                onHide={() => setAlertConfig({ ...alertConfig, visible: false })} 
            />

            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                        <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Subscription</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    <Animated.View entering={FadeInDown.duration(600)} style={styles.heroSection}>
                        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <HugeiconsIcon icon={Crown02Icon} size={40} color="#F59E0B" />
                        </View>
                        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Upgrade to DART Pro</Text>
                        <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
                            Unlock your full potential, maximize productivity, and manage your workspace without limits.
                        </Text>
                    </Animated.View>

                    <View style={styles.planContainer}>
                        {/* Monthly Plan */}
                        <Animated.View entering={FadeInUp.duration(500).delay(100)} layout={Layout.springify()}>
                            <TouchableOpacity 
                                activeOpacity={0.9} 
                                onPress={() => setSelectedPlan('monthly')}
                                style={[
                                    styles.planCard, 
                                    { 
                                        backgroundColor: theme.colors.card,
                                        borderColor: selectedPlan === 'monthly' ? '#8B5CF6' : theme.colors.border,
                                        borderWidth: selectedPlan === 'monthly' ? 2 : 1,
                                        marginBottom: 16
                                    }
                                ]}
                            >
                                <View style={styles.planHeader}>
                                    <View style={styles.planTitleWrapper}>
                                        <Text style={[styles.planName, { color: selectedPlan === 'monthly' ? '#8B5CF6' : theme.colors.text }]}>Monthly Plan</Text>
                                        <View style={[styles.discountBadge, { backgroundColor: '#8B5CF6' }]}>
                                            <HugeiconsIcon icon={SparklesIcon} size={10} color="#fff" />
                                            <Text style={styles.discountText}>16% OFF 1ST MO</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.radioOuter, { borderColor: selectedPlan === 'monthly' ? '#8B5CF6' : theme.colors.border }]}>
                                        {selectedPlan === 'monthly' && <View style={[styles.radioInner, { backgroundColor: '#8B5CF6' }]} />}
                                    </View>
                                </View>

                                <View style={[styles.trialBadge, { backgroundColor: '#8B5CF6' + '15', alignSelf: 'flex-start', marginBottom: 16 }]}>
                                    <Text style={[styles.trialText, { color: '#8B5CF6' }]}>7 DAYS FREE TRIAL</Text>
                                </View>
                                
                                <View style={styles.priceRow}>
                                    <Text style={[styles.priceOriginal, { color: theme.colors.textSecondary }]}>₱60</Text>
                                    <Text style={[styles.priceLarge, { color: theme.colors.text }]}>₱50</Text>
                                    <Text style={[styles.priceSuffix, { color: theme.colors.textSecondary }]}> / month</Text>
                                </View>
                                
                                <View style={styles.billingInfoBox}>
                                    <Text style={[styles.billingText, { color: theme.colors.textSecondary }]}>
                                        ₱50 for the first month, then ₱60/month
                                    </Text>
                                    <Text style={[styles.billingTextBold, { color: theme.colors.textSecondary }]}>
                                        Billed Monthly
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>

                        {/* Yearly Plan */}
                        <Animated.View entering={FadeInUp.duration(500).delay(200)} layout={Layout.springify()}>
                            <TouchableOpacity 
                                activeOpacity={0.9} 
                                onPress={() => setSelectedPlan('yearly')}
                                style={[
                                    styles.planCard, 
                                    { 
                                        backgroundColor: theme.colors.card,
                                        borderColor: selectedPlan === 'yearly' ? '#EC4899' : theme.colors.border,
                                        borderWidth: selectedPlan === 'yearly' ? 2 : 1,
                                    }
                                ]}
                            >
                                <View style={styles.planHeader}>
                                    <View style={styles.planTitleWrapper}>
                                        <Text style={[styles.planName, { color: selectedPlan === 'yearly' ? '#EC4899' : theme.colors.text }]}>Yearly Plan</Text>
                                        <View style={[styles.discountBadge, { backgroundColor: '#EC4899' }]}>
                                            <HugeiconsIcon icon={SparklesIcon} size={10} color="#fff" />
                                            <Text style={styles.discountText}>25% OFF</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.radioOuter, { borderColor: selectedPlan === 'yearly' ? '#EC4899' : theme.colors.border }]}>
                                        {selectedPlan === 'yearly' && <View style={[styles.radioInner, { backgroundColor: '#EC4899' }]} />}
                                    </View>
                                </View>

                                <View style={[styles.trialBadge, { backgroundColor: '#EC4899' + '15', alignSelf: 'flex-start', marginBottom: 16 }]}>
                                    <Text style={[styles.trialText, { color: '#EC4899' }]}>7 DAYS FREE TRIAL</Text>
                                </View>
                                
                                <View style={styles.priceRow}>
                                    <Text style={[styles.priceOriginal, { color: theme.colors.textSecondary }]}>₱720</Text>
                                    <Text style={[styles.priceLarge, { color: theme.colors.text }]}>₱540</Text>
                                    <Text style={[styles.priceSuffix, { color: theme.colors.textSecondary }]}> / year</Text>
                                </View>
                                
                                <View style={styles.billingInfoBox}>
                                    <Text style={[styles.billingText, { color: theme.colors.textSecondary }]}>
                                        ₱45 / month
                                    </Text>
                                    <Text style={[styles.billingTextBold, { color: theme.colors.textSecondary }]}>
                                        Billed Annually
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>

                    {/* Separate Comparison Cards */}
                    <View style={styles.comparisonContainer}>
                        {/* Pro Plan Card */}
                        <Animated.View entering={FadeInUp.duration(600).delay(300)} style={[styles.featureCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary, borderWidth: 2 }]}>
                            <View style={[styles.featureHeader, { borderBottomColor: theme.colors.border }]}>
                                <Text style={[styles.featureCardTitle, { color: theme.colors.primary }]}>DART Pro</Text>
                                <Text style={[styles.featureCardSubtitle, { color: theme.colors.textSecondary }]}>Everything you need</Text>
                            </View>
                            <View style={styles.featureList}>
                                {PRO_FEATURES.map((feat, i) => (
                                    <View key={i} style={styles.featureItem}>
                                        <HugeiconsIcon icon={CheckmarkBadge01Icon} size={20} color={theme.colors.primary} />
                                        <Text style={[styles.featureText, { color: theme.colors.text }]}>{feat}</Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>

                        {/* Free Plan Card */}
                        <Animated.View entering={FadeInUp.duration(600).delay(400)} style={[styles.featureCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1 }]}>
                            <View style={[styles.featureHeader, { borderBottomColor: theme.colors.border }]}>
                                <Text style={[styles.featureCardTitle, { color: theme.colors.text }]}>Free Plan</Text>
                                <Text style={[styles.featureCardSubtitle, { color: theme.colors.textSecondary }]}>Basic features</Text>
                            </View>
                            <View style={styles.featureList}>
                                {FREE_FEATURES.map((feat, i) => (
                                    <View key={i} style={styles.featureItem}>
                                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color={theme.colors.textSecondary} />
                                        <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>{feat}</Text>
                                    </View>
                                ))}
                            </View>
                        </Animated.View>
                    </View>

                    {/* Cancel Subscription */}
                    {isSubscribed && (
                        <Animated.View entering={FadeInUp.duration(500).delay(500)} style={{ marginTop: 24 }}>
                            <TouchableOpacity 
                                onPress={handleCancelSubscription}
                                activeOpacity={0.7}
                                style={[styles.cancelButton, { borderColor: theme.colors.danger + '50', backgroundColor: theme.colors.danger + '10' }]}
                            >
                                <HugeiconsIcon icon={Cancel01Icon} size={18} color={theme.colors.danger} />
                                <Text style={[styles.cancelText, { color: theme.colors.danger }]}>Cancel Subscription</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                </ScrollView>

                {/* Flat CTA Footer */}
                <Animated.View entering={FadeInDown.duration(500).delay(500)} style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
                    <TouchableOpacity 
                        style={[styles.ctaButton, { backgroundColor: theme.colors.primary }]} 
                        activeOpacity={0.85}
                        onPress={handleUpgrade}
                    >
                        <Text style={styles.ctaText}>Start 7-Day Free Trial</Text>
                    </TouchableOpacity>
                    <Text style={[styles.disclaimer, { color: theme.colors.textSecondary }]}>
                        Cancel anytime. Terms & Conditions apply.
                    </Text>
                </Animated.View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    backBtn: { padding: 8, width: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold' },
    
    scrollContent: { padding: 24, paddingBottom: 160 },
    
    heroSection: { alignItems: 'center', marginBottom: 40, marginTop: 12 },
    iconWrapper: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1 },
    heroTitle: { fontSize: 28, fontFamily: 'Nunito_900Black', marginBottom: 12, letterSpacing: -0.5 },
    heroSubtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 24, paddingHorizontal: 16 },
    
    planContainer: { marginBottom: 32 },
    planCard: { 
        padding: 24, 
        borderRadius: 24, 
    },
    
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    planTitleWrapper: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    planName: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },
    
    discountBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
    discountText: { color: '#fff', fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },

    trialBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    trialText: { fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.8 },
    
    radioOuter: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    radioInner: { width: 12, height: 12, borderRadius: 6 },
    
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
    priceOriginal: { fontSize: 20, fontFamily: 'Nunito_600SemiBold', textDecorationLine: 'line-through', opacity: 0.4, marginRight: 8 },
    priceLarge: { fontSize: 34, fontFamily: 'Nunito_900Black', letterSpacing: -1 },
    priceSuffix: { fontSize: 16, fontFamily: 'Nunito_600SemiBold' },
    
    billingInfoBox: { gap: 4 },
    billingText: { fontSize: 13, fontFamily: 'Nunito_500Medium', letterSpacing: 0.2 },
    billingTextBold: { fontSize: 13, fontFamily: 'Nunito_700Bold', letterSpacing: 0.2 },
    
    // Comparison Cards
    comparisonContainer: { gap: 16 },
    featureCard: { borderRadius: 24, padding: 24 },
    featureHeader: { marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1 },
    featureCardTitle: { fontSize: 22, fontFamily: 'Nunito_900Black', marginBottom: 4 },
    featureCardSubtitle: { fontSize: 14, fontFamily: 'Nunito_500Medium' },
    featureList: { gap: 16 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureText: { fontSize: 15, fontFamily: 'Nunito_600SemiBold' },

    cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
    cancelText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },

    footer: { position: 'absolute', bottom: 0, width, padding: 24, paddingTop: 16, borderTopWidth: 1 },
    ctaButton: { width: '100%', height: 56, borderRadius: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    ctaText: { color: '#fff', fontSize: 16, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    disclaimer: { fontSize: 12, fontFamily: 'Nunito_500Medium', textAlign: 'center', opacity: 0.6 }
});