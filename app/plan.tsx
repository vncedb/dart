import {
    Cancel01Icon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    Diamond01Icon,
    StarCircleIcon,
    Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import LoadingOverlay from '../components/LoadingOverlay';
import { ModernAlert } from '../components/ModernUI';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

// --- STATIC DATA (NO REVENUECAT) ---
const PLANS = {
    free: {
        id: 'free',
        title: 'Starter',
        price: 'Free',
        period: 'forever',
        features: ["Basic Clock In/Out", "7 Days History", "Standard Support"],
        badge: null,
        color: '#94a3b8'
    },
    monthly: {
        id: 'monthly',
        title: 'Monthly Pro',
        price: '₱49',
        period: 'mo',
        trial: '7 Days Free',
        // Specific features for Monthly
        features: ["Unlimited History", "Salary Calculator", "No Ads", "Standard Support"],
        badge: null,
        color: '#3b82f6'
    },
    annual: {
        id: 'annual',
        title: 'Annual Pro',
        price: '₱499',
        originalPrice: '₱588', // 49 * 12
        period: 'yr',
        trial: '1 Month Free',
        // Enhanced features for Annual
        features: ["Everything in Monthly", "VIP Priority Support", "Early Access to Features", "Cloud Backup"],
        badge: 'BEST VALUE',
        isHighlight: true,
        color: '#8b5cf6'
    }
};

// --- CARD COMPONENT ---
const PlanCard = ({ planKey, plan, isCurrent, isFree, onSelect, index }: any) => {
    // Styling Logic
    let borderColor = 'rgba(255,255,255,0.1)';
    let bgColor = 'rgba(255,255,255,0.03)';
    
    if (isCurrent) {
        borderColor = '#22c55e'; // Green for active
        bgColor = 'rgba(34, 197, 94, 0.05)';
    } else if (plan.isHighlight) {
        borderColor = 'rgba(139, 92, 246, 0.5)'; // Purple for Annual
        bgColor = 'rgba(139, 92, 246, 0.08)';
    }

    // Button Logic
    let btnBg = '#334155';
    let btnText = 'Choose Plan';
    let btnTextColor = '#cbd5e1';

    if (isCurrent) {
        btnBg = 'rgba(34, 197, 94, 0.15)';
        btnText = 'Current Plan';
        btnTextColor = '#22c55e';
    } else if (plan.isHighlight) {
        btnBg = '#8b5cf6';
        btnText = 'Upgrade & Save';
        btnTextColor = '#fff';
    } else if (!isFree) {
        btnBg = '#3b82f6';
        btnText = 'Subscribe';
        btnTextColor = '#fff';
    } else {
        btnBg = 'transparent';
        btnText = 'Downgrade';
        btnTextColor = '#94a3b8';
    }

    return (
        <Animated.View 
            entering={FadeInDown.delay(index * 150).springify()}
            style={[styles.cardBase, { borderColor, backgroundColor: bgColor }]}
        >
            {/* Badge */}
            {plan.badge && !isCurrent && (
                <View style={[styles.badge, plan.isHighlight ? styles.badgeHighlight : styles.badgeRegular]}>
                    {plan.isHighlight && <HugeiconsIcon icon={StarCircleIcon} size={10} color="#fff" variant="solid" style={{marginRight:4}} />}
                    <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
            )}

            {/* Active Indicator */}
            {isCurrent && (
                <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    <HugeiconsIcon icon={Tick02Icon} size={12} color="#fff" variant="solid" />
                </View>
            )}

            <View style={styles.cardContent}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={[styles.planTitle, isCurrent && { color: '#22c55e' }]}>{plan.title}</Text>
                        {'trial' in plan && !isCurrent && (
                            <View style={styles.trialTag}>
                                <HugeiconsIcon icon={Clock01Icon} size={12} color="#FBBF24" />
                                <Text style={styles.trialText}>{plan.trial}</Text>
                            </View>
                        )}
                        {isFree && <Text style={styles.freeSub}>Forever free</Text>}
                    </View>
                    
                    {!isFree ? (
                         <View style={{ alignItems: 'flex-end' }}>
                            {plan.originalPrice && <Text style={styles.strikePrice}>{plan.originalPrice}</Text>}
                            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={styles.finalPrice}>{plan.price}</Text>
                                <Text style={styles.period}>/{plan.period}</Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.finalPrice}>₱0</Text>
                    )}
                </View>

                <View style={styles.divider} />

                <View style={styles.features}>
                    {plan.features.map((f: string, i: number) => (
                        <View key={i} style={styles.featureRow}>
                            <View style={[styles.checkCircle, isFree && !isCurrent && styles.checkFree]}>
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={10} color={isFree && !isCurrent ? "#94a3b8" : "#fff"} variant="solid" />
                            </View>
                            <Text style={[styles.featureText, isFree && !isCurrent && styles.textFree]}>{f}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity 
                    onPress={() => onSelect(planKey)}
                    disabled={isCurrent}
                    activeOpacity={0.8}
                    style={[
                        styles.actionBtn, 
                        { backgroundColor: btnBg },
                        isFree && !isCurrent && { borderWidth: 1, borderColor: '#475569' },
                        isCurrent && { opacity: 0.8 }
                    ]}
                >
                    <Text style={[styles.actionBtnText, { color: btnTextColor }]}>
                        {btnText}
                    </Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

export default function PlanScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const showCloseButton = params.from === 'profile';

    const [isLoading, setIsLoading] = useState(false);
    const [currentPlan, setCurrentPlan] = useState<'free' | 'monthly' | 'annual'>('free');
    
    // Alert State
    const [alertConfig, setAlertConfig] = useState<{ 
        visible: boolean; 
        type: 'success' | 'error' | 'warning' | 'info'; 
        title: string; 
        message: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm?: () => void;
        onDismiss?: () => void;
    }>({
        visible: false, type: 'success', title: '', message: ''
    });

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single();
                const tier = data?.subscription_tier || 'free';
                setCurrentPlan(tier as any);
            }
        } catch (e) { console.log(e); }
    };

    const handleSelectPlan = async (planId: 'free' | 'monthly' | 'annual') => {
        // Case 1: Cancel/Downgrade Logic
        if (planId === 'free') {
             setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Switch to Free?',
                message: "You will lose access to Pro features immediately. Are you sure?",
                confirmText: 'Confirm Downgrade',
                cancelText: 'Stay Pro',
                onConfirm: () => {
                     setAlertConfig(prev => ({ ...prev, visible: false }));
                     processSubscription('free');
                },
                onDismiss: () => setAlertConfig(prev => ({ ...prev, visible: false }))
            });
            return;
        }

        // Case 2: Upgrade Logic (Simulated)
        processSubscription(planId);
    };

    const processSubscription = async (planId: 'free' | 'monthly' | 'annual') => {
        setIsLoading(true);
        
        // SIMULATION DELAY
        setTimeout(async () => {
            try {
                await syncWithSupabase(planId);
                setCurrentPlan(planId);
                
                if (planId !== 'free') {
                    setAlertConfig({
                        visible: true, type: 'success', title: 'Welcome to Pro!',
                        message: `Your ${PLANS[planId].title} subscription is now active (Simulated).`,
                        confirmText: 'Continue',
                        onConfirm: () => {
                            setAlertConfig(prev => ({ ...prev, visible: false }));
                            if (!showCloseButton) router.replace('/(tabs)/home');
                        },
                        onDismiss: () => {
                            setAlertConfig(prev => ({ ...prev, visible: false }));
                            if (!showCloseButton) router.replace('/(tabs)/home');
                        }
                    });
                } else {
                    // Downgrade success
                    if (!showCloseButton) router.replace('/(tabs)/home');
                    else router.back();
                }
            } catch (e: any) {
                setAlertConfig({
                    visible: true, type: 'error', title: 'Error', message: e.message,
                    onDismiss: () => setAlertConfig(prev => ({ ...prev, visible: false }))
                });
            } finally {
                setIsLoading(false);
            }
        }, 1500);
    };

    const syncWithSupabase = async (tier: 'free' | 'monthly' | 'annual') => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('profiles').update({
                subscription_tier: tier,
                subscription_status: tier === 'free' ? 'free' : 'active',
                updated_at: new Date()
            }).eq('id', user.id);
            await AsyncStorage.setItem('userPlan', tier);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            {/* Background Image Overlay */}
            <Image 
                source={{ uri: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop" }} 
                style={StyleSheet.absoluteFillObject} 
                resizeMode="cover" 
                blurRadius={60} 
            />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(15, 23, 42, 0.94)' }]} />

            <SafeAreaView style={{ flex: 1 }}>
                <LoadingOverlay visible={isLoading} message="Processing Request..." />
                
                <ModernAlert 
                    visible={alertConfig.visible} 
                    type={alertConfig.type} 
                    title={alertConfig.title} 
                    message={alertConfig.message} 
                    confirmText={alertConfig.confirmText}
                    cancelText={alertConfig.cancelText}
                    onConfirm={alertConfig.onConfirm}
                    onDismiss={alertConfig.onDismiss ?? (() => {})} 
                />

                {/* Header */}
                <View style={styles.navHeader}>
                    {showCloseButton && (
                        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                            <HugeiconsIcon icon={Cancel01Icon} size={24} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
                    {/* Hero Section */}
                    <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
                        <View style={styles.iconGlow}>
                            <HugeiconsIcon icon={Diamond01Icon} size={40} color="#A78BFA" variant="solid" />
                        </View>
                        <Text style={styles.title}>Unlock DART Pro</Text>
                        <Text style={styles.subtitle}>Choose the plan that fits your career.</Text>
                    </Animated.View>

                    {/* Plans List */}
                    <PlanCard 
                        planKey="annual" 
                        plan={PLANS.annual} 
                        isCurrent={currentPlan === 'annual'} 
                        onSelect={handleSelectPlan} 
                        index={1} 
                    />
                    
                    <PlanCard 
                        planKey="monthly" 
                        plan={PLANS.monthly} 
                        isCurrent={currentPlan === 'monthly'} 
                        onSelect={handleSelectPlan} 
                        index={2} 
                    />
                    
                    <PlanCard 
                        planKey="free" 
                        plan={PLANS.free} 
                        isCurrent={currentPlan === 'free'} 
                        isFree 
                        onSelect={handleSelectPlan} 
                        index={3} 
                    />

                    <Text style={styles.disclaimer}>
                        This is a simulation. No real payments will be charged.
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    navHeader: { paddingHorizontal: 20, paddingTop: 10, height: 50, justifyContent: 'center', alignItems: 'flex-end', zIndex: 10 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    
    hero: { alignItems: 'center', marginBottom: 30 },
    iconGlow: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(139, 92, 246, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' },
    title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
    subtitle: { fontSize: 16, color: '#94a3b8' },

    // CARD STYLES
    cardBase: { borderRadius: 24, marginBottom: 16, overflow: 'hidden', position: 'relative', borderWidth: 1 },
    
    // BADGES
    badge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: 12, zIndex: 10, flexDirection: 'row', alignItems: 'center' },
    badgeHighlight: { backgroundColor: '#8b5cf6' },
    badgeRegular: { backgroundColor: '#F59E0B' },
    badgeText: { fontSize: 11, fontWeight: 'bold', color: '#fff' },

    activeBadge: { position: 'absolute', top: 0, left: 0, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderBottomRightRadius: 12, zIndex: 10 },
    activeBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },

    cardContent: { padding: 20, paddingTop: 26 }, // Extra padding top for badges
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    planTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
    trialTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
    trialText: { color: '#fbbf24', fontSize: 11, fontWeight: '700' },
    freeSub: { color: '#94a3b8', marginTop: 4, fontSize: 13 },

    strikePrice: { fontSize: 13, color: '#94a3b8', textDecorationLine: 'line-through' },
    finalPrice: { fontSize: 24, fontWeight: '800', color: '#fff' },
    period: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },

    features: { gap: 10, marginBottom: 20 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' },
    checkFree: { backgroundColor: 'rgba(255,255,255,0.1)' },
    featureText: { fontSize: 14, color: '#e2e8f0', fontWeight: '500' },
    textFree: { color: '#cbd5e1' },

    // BUTTON STYLES
    actionBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    actionBtnText: { fontSize: 15, fontWeight: '700' },
    
    disclaimer: { textAlign: 'center', color: '#64748b', fontSize: 11, marginTop: 10 }
});