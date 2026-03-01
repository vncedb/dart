// filepath: app/settings/manage-subscriptions.tsx
import {
    ArrowLeft02Icon,
    ArrowRight01Icon,
    Cancel01Icon,
    CreditCardIcon,
    Crown02Icon,
    Download01Icon,
    InformationCircleIcon,
    SparklesIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import FloatingAlert from '../../components/FloatingAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function ManageSubscriptionsScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    
    // Realistic subscription check
    const { user } = useAuth();
    const isPro = user?.app_metadata?.plan === 'pro'; 
    
    // Realistic empty state for invoices until backend billing is fully integrated
    const invoices: any[] = []; 
    
    const [alertConfig, setAlertConfig] = useState({ visible: false, message: "", type: "info" });

    const activeColor = '#8B5CF6'; // Matching the monthly purple from plan.tsx

    const handleCancelSubscription = () => {
        setAlertConfig({ visible: true, message: "Subscription management coming soon.", type: "warning" });
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            
            <FloatingAlert 
                visible={alertConfig.visible} 
                message={alertConfig.message} 
                type={alertConfig.type as any} 
                position="top" 
                onHide={() => setAlertConfig({ ...alertConfig, visible: false })} 
            />

            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header matching plan.tsx */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
                        <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Manage Subscriptions</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    
                    <Animated.View entering={FadeInDown.duration(600)} style={styles.heroSection}>
                        <View style={[styles.iconWrapper, { backgroundColor: isPro ? activeColor + '15' : theme.colors.card, borderColor: isPro ? activeColor : theme.colors.border }]}>
                            <HugeiconsIcon icon={isPro ? Crown02Icon : SparklesIcon} size={36} color={isPro ? activeColor : theme.colors.textSecondary} />
                        </View>
                        <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Your Subscription</Text>
                        <Text style={[styles.heroSubtitle, { color: theme.colors.textSecondary }]}>
                            Manage your billing details, view past invoices, and update your current plan.
                        </Text>
                    </Animated.View>

                    {/* ACTIVE PLAN CARD */}
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ACTIVE PLAN</Text>
                    <Animated.View entering={FadeInUp.duration(500).delay(100)} layout={Layout.springify()}>
                        <View style={[
                            styles.planCard, 
                            isPro ? styles.proPlanCardElevated : {},
                            { 
                                backgroundColor: theme.colors.card,
                                borderColor: isPro ? activeColor : theme.colors.border,
                                borderWidth: isPro ? 2 : 1,
                                overflow: 'hidden'
                            }
                        ]}>
                            {/* Background SVG ONLY for Pro Plan */}
                            {isPro && (
                                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                                    <Svg height="100%" width="100%">
                                        <Defs>
                                            <LinearGradient id="gradActive" x1="0" y1="0" x2="1" y2="1">
                                                <Stop offset="0" stopColor={activeColor} stopOpacity={isDark ? "0.15" : "0.08"} />
                                                <Stop offset="1" stopColor={theme.colors.card} stopOpacity="1" />
                                            </LinearGradient>
                                        </Defs>
                                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#gradActive)" />
                                    </Svg>
                                </View>
                            )}

                            <View style={styles.planHeader}>
                                <View style={styles.planTitleWrapper}>
                                    <Text style={[styles.planName, { color: isPro ? activeColor : theme.colors.text }]}>
                                        {isPro ? 'DART Pro' : 'DART Free Plan'}
                                    </Text>
                                    <View style={[styles.statusBadge, { backgroundColor: isPro ? activeColor : theme.colors.textSecondary }]}>
                                        <Text style={styles.statusText}>ACTIVE</Text>
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.billingCycleText, { color: theme.colors.textSecondary, marginBottom: 16 }]}>
                                {isPro ? 'Your subscription is active and auto-renews.' : 'You are currently on the basic free tier.'}
                            </Text>
                            
                            {isPro && (
                                <View style={styles.priceRow}>
                                    <Text style={[styles.priceLarge, { color: theme.colors.text }]}>₱60</Text>
                                    <Text style={[styles.priceSuffix, { color: theme.colors.textSecondary }]}> / month</Text>
                                </View>
                            )}

                            {/* View Plans Button */}
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => router.push('/settings/plan')}
                                style={[styles.viewPlansBtn, { backgroundColor: isPro ? theme.colors.background : activeColor, borderColor: isPro ? theme.colors.border : activeColor }]}
                            >
                                <Text style={[styles.viewPlansBtnText, { color: isPro ? theme.colors.text : '#fff' }]}>
                                    {isPro ? 'Change Plan' : 'View Plans & Upgrade'}
                                </Text>
                                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={isPro ? theme.colors.text : '#fff'} />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {/* PAYMENT METHOD & BILLING HISTORY (Only visible if Pro) */}
                    {isPro && (
                        <>
                            <Animated.View entering={FadeInUp.duration(500).delay(200)}>
                                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 32 }]}>PAYMENT METHOD</Text>
                                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <View style={styles.paymentRow}>
                                        <View style={[styles.paymentIconContainer, { backgroundColor: theme.colors.background }]}>
                                            <HugeiconsIcon icon={CreditCardIcon} size={22} color={theme.colors.text} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 16 }}>
                                            <Text style={[styles.paymentCardNumber, { color: theme.colors.text }]}>•••• •••• •••• 4242</Text>
                                            <Text style={[styles.paymentCardExpiry, { color: theme.colors.textSecondary }]}>Expires 12/28</Text>
                                        </View>
                                        <TouchableOpacity activeOpacity={0.7} style={{ padding: 8 }}>
                                            <Text style={[styles.editText, { color: activeColor }]}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Animated.View>

                            <Animated.View entering={FadeInUp.duration(500).delay(300)}>
                                <Text style={[styles.sectionTitle, { marginTop: 32, color: theme.colors.textSecondary }]}>BILLING HISTORY</Text>
                                
                                {invoices.length > 0 ? (
                                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, paddingHorizontal: 0, paddingVertical: 8 }]}>
                                        {invoices.map((invoice, index) => (
                                            <View key={invoice.id}>
                                                <TouchableOpacity activeOpacity={0.7} style={styles.invoiceItem}>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.invoiceAmount, { color: theme.colors.text }]}>{invoice.amount} - {invoice.plan}</Text>
                                                        <Text style={[styles.invoiceDate, { color: theme.colors.textSecondary }]}>{invoice.date} • {invoice.id}</Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                                        <View style={[styles.paidBadge, { backgroundColor: '#dcfce7' }]}>
                                                            <Text style={[styles.paidBadgeText, { color: '#166534' }]}>{invoice.status}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <HugeiconsIcon icon={Download01Icon} size={14} color={theme.colors.textSecondary} />
                                                            <Text style={[styles.downloadText, { color: theme.colors.textSecondary }]}>PDF</Text>
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                                {index !== invoices.length - 1 && (
                                                    <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 32, alignItems: 'center' }]}>
                                        <HugeiconsIcon icon={InformationCircleIcon} size={28} color={theme.colors.textSecondary} />
                                        <Text style={{ marginTop: 12, fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: theme.colors.textSecondary }}>No billing history available.</Text>
                                    </View>
                                )}
                            </Animated.View>

                            <Animated.View entering={FadeInUp.duration(500).delay(400)} style={{ marginTop: 32 }}>
                                <TouchableOpacity 
                                    onPress={handleCancelSubscription}
                                    activeOpacity={0.7}
                                    style={[styles.cancelButton, { borderColor: theme.colors.danger + '40', backgroundColor: theme.colors.danger + '08' }]}
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={18} color={theme.colors.danger} />
                                    <Text style={[styles.cancelText, { color: theme.colors.danger }]}>Cancel Subscription</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </>
                    )}

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    backBtn: { padding: 8, width: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold' },
    
    scrollContent: { padding: 24, paddingBottom: 100 },
    
    heroSection: { alignItems: 'center', marginBottom: 32, marginTop: 12 },
    iconWrapper: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1 },
    heroTitle: { fontSize: 24, fontFamily: 'Nunito_900Black', marginBottom: 8, letterSpacing: -0.5 },
    heroSubtitle: { fontSize: 14, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },

    sectionTitle: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4 },
    
    planCard: { padding: 24, borderRadius: 24 },
    proPlanCardElevated: {
        elevation: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    planTitleWrapper: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    planName: { fontSize: 22, fontFamily: 'Nunito_900Black', letterSpacing: -0.5 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { color: '#fff', fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    billingCycleText: { fontSize: 14, fontFamily: 'Nunito_500Medium' },

    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
    priceLarge: { fontSize: 32, fontFamily: 'Nunito_900Black', letterSpacing: -1, marginRight: 6 },
    priceSuffix: { fontSize: 16, fontFamily: 'Nunito_600SemiBold' },

    viewPlansBtn: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
        paddingVertical: 14, borderRadius: 16, gap: 8, borderWidth: 1, marginTop: 4 
    },
    viewPlansBtnText: { fontSize: 15, fontFamily: 'Nunito_700Bold' },

    card: { borderRadius: 24, borderWidth: 1, padding: 20 },
    
    paymentRow: { flexDirection: 'row', alignItems: 'center' },
    paymentIconContainer: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    paymentCardNumber: { fontSize: 16, fontFamily: 'Nunito_700Bold', marginBottom: 2 },
    paymentCardExpiry: { fontSize: 13, fontFamily: 'Nunito_500Medium' },
    editText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },

    invoiceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
    invoiceAmount: { fontSize: 15, fontFamily: 'Nunito_700Bold', marginBottom: 4 },
    invoiceDate: { fontSize: 13, fontFamily: 'Nunito_500Medium' },
    paidBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    paidBadgeText: { fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5, textTransform: 'uppercase' },
    downloadText: { fontSize: 12, fontFamily: 'Nunito_600SemiBold' },
    separator: { height: 1, opacity: 0.5, marginHorizontal: 20 },

    cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1, gap: 8 },
    cancelText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
});