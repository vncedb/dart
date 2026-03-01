// filepath: app/job/job.tsx
import {
    Briefcase01Icon,
    Building03Icon,
    Delete02Icon,
    MoreVerticalIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    Tick01Icon,
    WifiOff01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    BackHandler,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../../components/ActionMenu';
import BannerAdComponent from '../../components/BannerAdComponent'; // <-- ADDED AD COMPONENT
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import LoadingScreen from '../../components/LoadingScreen';
import ModernAlert from '../../components/ModernAlert';
import ScaleButton from '../../components/ScaleButton';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { deleteJobLocal, queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';

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

const SectionTitle = ({ title, theme }: { title: string, theme: any }) => (
    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
        {title}
    </Text>
);

const OfflineIndicator = ({ isOffline, theme }: { isOffline: boolean; theme: any }) => {
    if (!isOffline) return null;
    return (
        <Animated.View 
            entering={FadeInDown.duration(400)}
            style={[styles.offlineStatus, { backgroundColor: theme.colors.danger + "10", borderColor: theme.colors.danger + "20" }]}
        >
            <HugeiconsIcon icon={WifiOff01Icon} size={14} color={theme.colors.danger} />
            <Text style={{ fontSize: 11, fontFamily: "Nunito_500Medium", color: theme.colors.danger, marginLeft: 6 }}>
                You are offline. Data may be unsynced.
            </Text>
        </Animated.View>
    );
};

const EmptyState = ({ onPress, theme }: { onPress: () => void, theme: any }) => (
    <View style={styles.emptyStateContainer}>
        <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.card }]}>
            <HugeiconsIcon icon={Briefcase01Icon} size={48} color={theme.colors.textSecondary} />
        </View>
        <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No Jobs Added</Text>
        <Text style={[styles.emptyStateBody, { color: theme.colors.textSecondary }]}>
            Add a position to start tracking your work hours and earnings.
        </Text>
        
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
            <ScaleButton onPress={onPress}>
                <View style={[
                    styles.emptyStateButton, 
                    { 
                        backgroundColor: theme.colors.primary, 
                        shadowColor: theme.colors.primary 
                    }
                ]}>
                    <HugeiconsIcon icon={PlusSignIcon} size={20} color="#ffffff" />
                    <Text style={styles.emptyStateButtonText}>Add New Job</Text>
                </View>
            </ScaleButton>
        </View>
    </View>
);

const StatusPill = ({ status, theme }: { status: string, theme: any }) => (
    <View style={[styles.statusPill, { backgroundColor: theme.colors.primary + '15' }]}>
        <Text style={[styles.statusPillText, { color: theme.colors.primary }]}>{status}</Text>
    </View>
);

const ActiveJobHero = ({ item, isEditMode, onEdit, theme }: { item: JobPosition, isEditMode: boolean, onEdit: (id: string) => void, theme: any }) => {
    return (
        <Animated.View 
            entering={FadeIn.duration(400)}
            style={[styles.heroCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary, borderWidth: 1.5 }]}
        >
            <View style={[styles.heroTint, { backgroundColor: theme.colors.primary, opacity: 0.03 }]} />
            
            <View style={styles.heroHeader}>
                <View style={[styles.activeBadge, { backgroundColor: theme.colors.primary }]}>
                    <View style={[styles.pulseDot, { backgroundColor: '#FFF' }]} />
                    <Text style={[styles.activeBadgeText, { color: '#FFF' }]}>ACTIVE POSITION</Text>
                </View>
                
                <View style={styles.heroEditZone}>
                    {isEditMode && (
                        <TouchableOpacity 
                            onPress={() => onEdit(item.id)} 
                            style={[styles.iconBtn, { backgroundColor: theme.colors.primary + '15' }]}
                        >
                            <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.heroContent}>
                <Text style={[styles.heroTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
                
                <View style={{ gap: 8, marginBottom: 16 }}>
                    <View style={styles.heroCompanyRow}>
                        <HugeiconsIcon icon={Building03Icon} size={16} color={theme.colors.textSecondary} />
                        <Text style={[styles.heroCompany, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            {item.company}
                        </Text>
                    </View>

                    {item.department ? (
                        <View style={styles.heroCompanyRow}>
                            <HugeiconsIcon icon={Briefcase01Icon} size={16} color={theme.colors.textSecondary} />
                            <Text style={[styles.heroCompany, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                                {item.department}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <StatusPill status={item.employment_status || 'Status N/A'} theme={theme} />
            </View>
        </Animated.View>
    );
};

const InactiveJobItem = ({ item, onActivate, onEdit, onDelete, isEditMode, theme }: any) => {
    return (
        <Animated.View 
            entering={FadeIn.duration(400)}
            style={[styles.listCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
            <View style={styles.listCardContent}>
                <View style={styles.listTextContainer}>
                    <Text style={[styles.listTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.listSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {item.company} {item.department ? ` • ${item.department}` : ''}
                    </Text>
                    <View style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                        <StatusPill status={item.employment_status || 'Status N/A'} theme={theme} />
                    </View>
                </View>

                <View style={styles.actionArea}>
                    {isEditMode ? (
                        <View style={styles.editActions}>
                            <TouchableOpacity onPress={() => onEdit(item.id)} style={[styles.iconBtn, { backgroundColor: theme.colors.primary + '15' }]}>
                                <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => onDelete(item.id)} style={[styles.iconBtn, { backgroundColor: theme.colors.danger + '15' || '#ef444415' }]}>
                                <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger || '#ef4444'} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={() => onActivate(item.id)}
                            style={[styles.activateBtn, { backgroundColor: theme.colors.primary + '10' }]}
                        >
                            <Text style={[styles.activateBtnText, { color: theme.colors.primary }]}>Select</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animated.View>
    );
};

export default function MyJobsScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { triggerSync } = useSync();
    const { user } = useAuth();
    
    const [jobs, setJobs] = useState<JobPosition[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [isOffline, setIsOffline] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });
    const [isEditMode, setIsEditMode] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/(tabs)/profile');
                }
                return true; 
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [router])
    );

    const fetchJobs = useCallback(async () => {
        if (!user) { setLoading(false); return; }
        try {
            const db = await getDB();
            const localJobs = await db.getAllAsync('SELECT * FROM job_positions WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
            const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);

            setActiveJobId(profile?.current_job_id || null);
            setJobs(localJobs as JobPosition[]);

            const netInfo = await NetInfo.fetch();
            setIsOffline(!netInfo.isConnected);
        } catch (error) {
            console.error('Fetch Jobs Error:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { setLoading(true); fetchJobs(); }, [fetchJobs]));

    const handleRefresh = async () => {
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await triggerSync();
        await fetchJobs();
        setRefreshing(false);
    };

    const activeJob = useMemo(() => jobs.find(j => j.id === activeJobId), [jobs, activeJobId]);
    const inactiveJobs = useMemo(() => jobs.filter(j => j.id !== activeJobId), [jobs, activeJobId]);

    const handleMoreOptions = (e: any) => {
        Haptics.selectionAsync();
        const x = e.nativeEvent.pageX || Dimensions.get('window').width - 24;
        const y = e.nativeEvent.pageY || 80;
        setMenuAnchor({ x, y: y + 20 });
        setMenuVisible(true);
    };

    const handleToggleEditMode = () => {
        Haptics.selectionAsync();
        setIsEditMode(false);
    };

    const handleSetActive = async (jobId: string) => {
        if (!user) return;
        setLoadingMessage('Configuring Active Job...');
        setProcessing(true);
        try {
            const db = await getDB();
            
            await db.runAsync('UPDATE profiles SET current_job_id = ? WHERE id = ?', [jobId, user.id]);
            await db.runAsync('INSERT OR IGNORE INTO profiles (id, current_job_id, updated_at) VALUES (?, ?, ?)', [user.id, jobId, new Date().toISOString()]);
            await queueSyncItem('profiles', user.id, 'UPDATE', { id: user.id, current_job_id: jobId, updated_at: new Date().toISOString() });
            
            setActiveJobId(jobId);
            await triggerSync();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error(e);
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to activate job.', onConfirm: () => setAlertConfig((p:any)=>({...p, visible: false})) });
        } finally {
            setProcessing(false);
        }
    };

    const confirmSetActive = (jobId: string) => {
        Haptics.selectionAsync();
        setAlertConfig({
            visible: true,
            type: 'info',
            title: 'Set Active Position',
            message: 'Are you sure you want to switch your active job to this position? This will load its data as your primary focus.',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            onConfirm: () => {
                setAlertConfig((p:any)=>({...p, visible: false}));
                handleSetActive(jobId);
            },
            onCancel: () => setAlertConfig((p:any)=>({...p, visible: false}))
        });
    };

    const handleDelete = async (jobId: string) => {
        if (!user) return;
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
                setLoadingMessage('Deleting Position...');
                setProcessing(true);
                try {
                    await deleteJobLocal(jobId);
                    if (activeJobId === jobId) {
                        const db = await getDB();
                        await db.runAsync('UPDATE profiles SET current_job_id = NULL WHERE id = ?', [user.id]);
                        await queueSyncItem('profiles', user.id, 'UPDATE', { current_job_id: null });
                        setActiveJobId(null);
                    }
                    fetchJobs();
                } catch(e) { /* handle error */ } finally { setProcessing(false); }
            },
            onCancel: () => setAlertConfig((p:any)=>({...p, visible: false}))
        });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} onDismiss={() => setAlertConfig((p:any) => ({...p, visible: false}))} />
            <LoadingOverlay visible={processing} message={loadingMessage} />
            
            <Header 
                title="My Jobs" 
                rightElement={
                    jobs.length > 0 ? (
                        <TouchableOpacity 
                            onPress={isEditMode ? handleToggleEditMode : handleMoreOptions} 
                            style={[styles.headerAddBtn, { backgroundColor: 'transparent' }]}
                        >
                            <HugeiconsIcon 
                                icon={isEditMode ? Tick01Icon : MoreVerticalIcon} 
                                size={24} 
                                color={theme.colors.primary} 
                            />
                        </TouchableOpacity>
                    ) : undefined
                } 
            />

            <OfflineIndicator isOffline={isOffline} theme={theme} />
            
            {loading ? (
                <View style={{ flex: 1 }}><LoadingScreen message="" /></View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />}
                >
                    {jobs.length === 0 ? (
                        <EmptyState theme={theme} onPress={() => router.push('/job/form')} />
                    ) : (
                        <>
                            {activeJob && (
                                <View style={{ marginBottom: 24 }}>
                                    <ActiveJobHero 
                                        item={activeJob} 
                                        theme={theme} 
                                        isEditMode={isEditMode}
                                        onEdit={(id) => router.push({ pathname: '/job/form', params: { id } })}
                                    />
                                </View>
                            )}

                            {inactiveJobs.length > 0 && (
                                <View>
                                    <SectionTitle title={activeJob ? "OTHER POSITIONS" : "AVAILABLE POSITIONS"} theme={theme} />
                                    <View style={{ gap: 12 }}>
                                        {inactiveJobs.map(job => (
                                            <InactiveJobItem 
                                                key={job.id} 
                                                item={job} 
                                                theme={theme}
                                                isEditMode={isEditMode}
                                                onActivate={confirmSetActive}
                                                onEdit={(id: string) => router.push({ pathname: '/job/form', params: { id } })}
                                                onDelete={handleDelete}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                            
                            {!activeJob && inactiveJobs.length > 0 && (
                                <View style={[styles.selectPrompt, { backgroundColor: theme.colors.primary + '10' }]}>
                                    <HugeiconsIcon icon={Tick01Icon} size={20} color={theme.colors.primary} />
                                    <Text style={[styles.selectPromptText, { color: theme.colors.primary }]}>
                                        Select a job above to set it as active.
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            )}

            <ActionMenu 
                visible={menuVisible} 
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                actions={[
                    {
                        label: 'Add New Job',
                        icon: PlusSignIcon,
                        onPress: () => router.push('/job/form')
                    },
                    {
                        label: 'Manage Jobs',
                        icon: PencilEdit02Icon,
                        onPress: () => setIsEditMode(true)
                    }
                ]} 
            />

            {/* ADDED AD COMPONENT AT THE BOTTOM */}
            <BannerAdComponent />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 24, paddingBottom: 24, flexGrow: 1 },
    headerAddBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 11, fontFamily: 'Nunito_500Medium', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    offlineStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderBottomWidth: 1 },
    statusPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
    statusPillText: { fontSize: 10, fontFamily: 'Nunito_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
    heroCard: { borderRadius: 24, overflow: 'hidden', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6, padding: 0 },
    heroTint: { ...StyleSheet.absoluteFillObject },
    heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 0 },
    activeBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 100, gap: 6 },
    pulseDot: { width: 6, height: 6, borderRadius: 3 },
    activeBadgeText: { fontSize: 10, fontFamily: 'Nunito_500Medium', letterSpacing: 0.5 },
    heroEditZone: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    heroContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
    heroTitle: { fontSize: 24, fontFamily: 'Nunito_500Medium', marginBottom: 12, letterSpacing: -0.5 },
    heroCompanyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroCompany: { fontSize: 14, fontFamily: 'Nunito_500Medium' },
    listCard: { borderRadius: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    listCardContent: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    listTextContainer: { flex: 1, justifyContent: 'center' },
    listTitle: { fontSize: 17, fontFamily: 'Nunito_500Medium', marginBottom: 4, letterSpacing: -0.3 },
    listSubtitle: { fontSize: 13, fontFamily: 'Nunito_400Regular' },
    actionArea: { width: 85, alignItems: 'flex-end', justifyContent: 'center' },
    activateBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 100 },
    activateBtnText: { fontSize: 13, fontFamily: 'Nunito_500Medium' },
    editActions: { flexDirection: 'row', gap: 8 },
    iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    
    // Modern Empty State Styles
    emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: '30%' },
    emptyIconContainer: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    emptyStateTitle: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', marginBottom: 10, letterSpacing: -0.3 },
    emptyStateBody: { fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 32, paddingHorizontal: 40, opacity: 0.9 },
    emptyStateButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingVertical: 16, 
        borderRadius: 20, 
        width: '100%', 
        gap: 10, 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.25, 
        shadowRadius: 12, 
        elevation: 6 
    },
    emptyStateButtonText: { fontFamily: 'Nunito_700Bold', color: '#ffffff', fontSize: 16, letterSpacing: 0.3 },
    selectPrompt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginTop: 24, gap: 8 },
    selectPromptText: { fontSize: 13, fontFamily: 'Nunito_500Medium' }
});