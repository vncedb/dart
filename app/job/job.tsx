import {
    Briefcase01Icon,
    Building03Icon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    Delete02Icon,
    DollarCircleIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    WifiOffIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import LoadingScreen from '../../components/LoadingScreen';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { deleteJobLocal, queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

// --- TYPES ---
type JobPosition = {
    id: string;
    title: string;
    company: string;
    department?: string;
    employment_status: string;
    rate: number;
    rate_type: string;
    work_schedule: any;
    current_job_id?: string;
};

// --- HELPER COMPONENTS ---

const SectionTitle = ({ title, theme }: { title: string, theme: any }) => (
    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        {title}
    </Text>
);

const OfflineBanner = ({ theme }: { theme: any }) => (
    <Animated.View 
        entering={FadeInDown.duration(400)}
        style={[styles.offlineBanner, { backgroundColor: theme.colors.warning + '15', borderColor: theme.colors.warning + '40' }]}
    >
        <HugeiconsIcon icon={WifiOffIcon} size={16} color={theme.colors.warning} />
        <Text style={[styles.offlineText, { color: theme.colors.warning }]}>
            Offline Mode • Changes will sync when online
        </Text>
    </Animated.View>
);

const EmptyState = ({ onPress, theme }: { onPress: () => void, theme: any }) => (
    <View style={styles.emptyStateContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.card }]}>
            <HugeiconsIcon icon={Briefcase01Icon} size={40} color={theme.colors.textSecondary} />
        </View>
        <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No Jobs Added</Text>
        <Text style={[styles.emptyStateBody, { color: theme.colors.textSecondary }]}>
            Add a position to start tracking your work hours and earnings.
        </Text>
        <TouchableOpacity 
            onPress={onPress}
            activeOpacity={0.8}
            style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary }]}
        >
            <HugeiconsIcon icon={PlusSignIcon} size={20} color="#FFF" />
            <Text style={styles.emptyStateButtonText}>Add First Job</Text>
        </TouchableOpacity>
    </View>
);

// --- COMPONENT: ACTIVE JOB HERO CARD ---
const ActiveJobHero = ({ item, onEdit, theme }: { item: JobPosition, onEdit: (id: string) => void, theme: any }) => {
    const schedule = typeof item.work_schedule === 'string' ? JSON.parse(item.work_schedule) : (item.work_schedule || {});
    
    const formatTime = (t: string) => {
        if (!t) return '--:--';
        const [h, m] = t.split(':');
        const d = new Date(); d.setHours(Number(h), Number(m));
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    return (
        <Animated.View 
            layout={Layout.springify()} 
            entering={FadeInUp.delay(100).duration(500)}
            style={[styles.heroCard, { backgroundColor: theme.colors.card, shadowColor: theme.colors.primary }]}
        >
            {/* Background Tint */}
            <View style={[styles.heroTint, { backgroundColor: theme.colors.primary, opacity: 0.04 }]} />
            
            {/* Active Badge */}
            <View style={styles.heroHeader}>
                <View style={[styles.activeBadge, { backgroundColor: theme.colors.success + '20' }]}>
                    <View style={[styles.pulseDot, { backgroundColor: theme.colors.success }]} />
                    <Text style={[styles.activeBadgeText, { color: theme.colors.success }]}>CURRENTLY ACTIVE</Text>
                </View>
                <TouchableOpacity onPress={() => onEdit(item.id)} style={[styles.iconButton, { backgroundColor: theme.colors.background }]}>
                    <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            <View style={styles.heroContent}>
                <Text style={[styles.heroTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
                <View style={styles.heroCompanyRow}>
                    <HugeiconsIcon icon={Building03Icon} size={16} color={theme.colors.textSecondary} />
                    <Text style={[styles.heroCompany, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {item.company}
                    </Text>
                </View>
            </View>

            {/* Metrics Grid */}
            <View style={styles.heroGrid}>
                <View style={[styles.heroGridItem, { borderColor: theme.colors.border }]}>
                    <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>RATE</Text>
                    <View style={styles.heroValueRow}>
                        <HugeiconsIcon icon={DollarCircleIcon} size={16} color={theme.colors.success} />
                        <Text style={[styles.heroValue, { color: theme.colors.text }]}>
                            {item.rate.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                            <Text style={{ fontSize: 10, fontWeight: '500', color: theme.colors.textSecondary }}> / {item.rate_type}</Text>
                        </Text>
                    </View>
                </View>
                <View style={[styles.heroGridItem, { borderColor: theme.colors.border, borderRightWidth: 0 }]}>
                    <Text style={[styles.heroLabel, { color: theme.colors.textSecondary }]}>SCHEDULE</Text>
                    <View style={styles.heroValueRow}>
                        <HugeiconsIcon icon={Clock01Icon} size={16} color={theme.colors.primary} />
                        <Text style={[styles.heroValue, { color: theme.colors.text }]}>
                            {formatTime(schedule.start)} - {formatTime(schedule.end)}
                        </Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

// --- COMPONENT: INACTIVE JOB CARD ---
const InactiveJobItem = ({ item, onActivate, onEdit, onDelete, theme }: any) => {
    return (
        <Animated.View 
            layout={Layout.springify()}
            entering={FadeInDown.duration(400)}
            style={[styles.listCard, { backgroundColor: theme.colors.card }]}
        >
            <View style={styles.listCardContent}>
                <View style={[styles.listIconBox, { backgroundColor: theme.colors.background }]}>
                    <HugeiconsIcon icon={Briefcase01Icon} size={20} color={theme.colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.listTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.listSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>{item.company}</Text>
                </View>
            </View>

            <View style={[styles.listActions, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity 
                    onPress={() => onActivate(item.id)}
                    style={[styles.actionBtn, { flex: 1, borderRightWidth: 1, borderRightColor: theme.colors.border }]}
                >
                    <Text style={[styles.actionBtnText, { color: theme.colors.primary }]}>Set Active</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => onEdit(item.id)} style={[styles.actionIconBtn, { width: 50 }]}>
                    <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => onDelete(item.id)} style={[styles.actionIconBtn, { width: 50 }]}>
                    <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger || '#ef4444'} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};


// --- MAIN SCREEN ---
export default function MyJobsScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { triggerSync } = useSync();
    
    // State
    const [jobs, setJobs] = useState<JobPosition[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isOffline, setIsOffline] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // --- DATA FETCHING ---
    const fetchJobs = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) { setLoading(false); return; }
            const userId = String(session.user.id);

            const db = await getDB();
            const localJobs = await db.getAllAsync('SELECT * FROM job_positions WHERE user_id = ? ORDER BY created_at DESC', [userId]);
            const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [userId]);

            setActiveJobId(profile?.current_job_id || null);
            setJobs(localJobs as JobPosition[]);

            const netInfo = await NetInfo.fetch();
            setIsOffline(!netInfo.isConnected);
        } catch (error) {
            console.error('Fetch Jobs Error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { setLoading(true); fetchJobs(); }, [fetchJobs]));

    const handleRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await triggerSync();
        await fetchJobs();
        setRefreshing(false);
    };

    // --- COMPUTED DATA ---
    const activeJob = useMemo(() => jobs.find(j => j.id === activeJobId), [jobs, activeJobId]);
    const inactiveJobs = useMemo(() => jobs.filter(j => j.id !== activeJobId), [jobs, activeJobId]);

    // --- ACTIONS ---
    const handleSetActive = async (jobId: string) => {
        Haptics.selectionAsync();
        setLoadingMessage('Activating job...');
        setProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            const userId = String(session.user.id);
            const db = await getDB();
            
            // Optimistic Update
            await db.runAsync('UPDATE profiles SET current_job_id = ? WHERE id = ?', [jobId, userId]);
            // Fallback insert if profile missing locally
            await db.runAsync('INSERT OR IGNORE INTO profiles (id, current_job_id, updated_at) VALUES (?, ?, ?)', [userId, jobId, new Date().toISOString()]);
            
            await queueSyncItem('profiles', userId, 'UPDATE', { id: userId, current_job_id: jobId, updated_at: new Date().toISOString() });
            
            setActiveJobId(jobId);
            triggerSync();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error(e);
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to update.', onConfirm: () => setAlertConfig((p:any)=>({...p, visible: false})) });
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (jobId: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setAlertConfig({
            visible: true,
            type: 'warning',
            title: 'Delete Position?',
            message: 'This will remove the job from your list. Past records will be preserved.',
            confirmText: 'Delete',
            confirmType: 'destructive',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((p:any)=>({...p, visible: false}));
                setProcessing(true);
                try {
                    await deleteJobLocal(jobId);
                    if (activeJobId === jobId) {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.user?.id) {
                            const db = await getDB();
                            await db.runAsync('UPDATE profiles SET current_job_id = NULL WHERE id = ?', [session.user.id]);
                            await queueSyncItem('profiles', session.user.id, 'UPDATE', { current_job_id: null });
                            setActiveJobId(null);
                        }
                    }
                    fetchJobs();
                } catch(e) { /* handle error */ } finally { setProcessing(false); }
            },
            onCancel: () => setAlertConfig((p:any)=>({...p, visible: false}))
        });
    };

    // --- RENDER ---
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} onDismiss={() => setAlertConfig((p:any) => ({...p, visible: false}))} />
            <LoadingOverlay visible={processing} message={loadingMessage} />
            
            <Header 
                title="My Jobs" 
                rightElement={
                    <TouchableOpacity 
                        onPress={() => { Haptics.selectionAsync(); router.push('/job/form'); }} 
                        style={[styles.headerAddBtn, { backgroundColor: theme.colors.primaryLight }]}
                    >
                        <HugeiconsIcon icon={PlusSignIcon} size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                } 
            />
            
            {loading ? (
                <View style={{ flex: 1 }}><LoadingScreen message="" /></View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
                >
                    {isOffline && <OfflineBanner theme={theme} />}

                    {jobs.length === 0 ? (
                        <EmptyState theme={theme} onPress={() => router.push('/job/form')} />
                    ) : (
                        <>
                            {activeJob && (
                                <View style={{ marginBottom: 24 }}>
                                    <ActiveJobHero 
                                        item={activeJob} 
                                        onEdit={(id) => router.push({ pathname: '/job/form', params: { id } })} 
                                        theme={theme} 
                                    />
                                </View>
                            )}

                            {inactiveJobs.length > 0 && (
                                <View>
                                    <SectionTitle title="AVAILABLE POSITIONS" theme={theme} />
                                    <View style={{ gap: 12 }}>
                                        {inactiveJobs.map(job => (
                                            <InactiveJobItem 
                                                key={job.id} 
                                                item={job} 
                                                theme={theme}
                                                onActivate={handleSetActive}
                                                onEdit={(id: string) => router.push({ pathname: '/job/form', params: { id } })}
                                                onDelete={handleDelete}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                            
                            {/* If no active job but jobs exist */}
                            {!activeJob && inactiveJobs.length > 0 && (
                                <View style={[styles.selectPrompt, { backgroundColor: theme.colors.primary + '10' }]}>
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color={theme.colors.primary} />
                                    <Text style={[styles.selectPromptText, { color: theme.colors.primary }]}>
                                        Select a job above to set it as active.
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        padding: 24,
        paddingBottom: 100,
        flexGrow: 1
    },
    headerAddBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 12,
        marginLeft: 4,
    },
    // Offline
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        gap: 8,
    },
    offlineText: {
        fontSize: 11,
        fontWeight: '700',
    },
    // Hero Card
    heroCard: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'transparent', // Can enable if needed
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
        padding: 0,
    },
    heroTint: {
        ...StyleSheet.absoluteFillObject,
    },
    heroHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 0,
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 100,
        gap: 6,
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    activeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 6,
        letterSpacing: -0.5,
    },
    heroCompanyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    heroCompany: {
        fontSize: 15,
        fontWeight: '600',
    },
    heroGrid: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    heroGridItem: {
        flex: 1,
        padding: 16,
        borderRightWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroLabel: {
        fontSize: 9,
        fontWeight: '800',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    heroValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    heroValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    // List Items
    listCard: {
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    listCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
    },
    listIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    listSubtitle: {
        fontSize: 13,
        fontWeight: '500',
    },
    listActions: {
        flexDirection: 'row',
        borderTopWidth: 1,
    },
    actionBtn: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },
    actionIconBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Empty State
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
    },
    emptyStateBody: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
        paddingHorizontal: 40,
    },
    emptyStateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 100,
        gap: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    emptyStateButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    selectPrompt: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        marginTop: 24,
        gap: 8,
    },
    selectPromptText: {
        fontSize: 13,
        fontWeight: '600',
    }
});