import {
    Briefcase01Icon,
    Briefcase02Icon,
    Calendar03Icon,
    Camera01Icon,
    Clock01Icon // Fixed missing import
    ,
    Delete02Icon,
    DollarCircleIcon,
    Layers01Icon,
    PencilEdit02Icon,
    Settings02Icon,
    UserCircleIcon,
    UserGroupIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EditDisplayModal, { AVAILABLE_JOB_FIELDS } from '../../components/EditDisplayModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { queueSyncItem, saveJobLocal, saveProfileLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

const DetailRow = ({ label, value, icon, theme }: any) => (
    <View style={styles.detailRow}>
        <View style={styles.detailIconContainer}><HugeiconsIcon icon={icon} size={18} color={theme.colors.textSecondary} /></View>
        <View style={{ flex: 1 }}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{value}</Text>
        </View>
    </View>
);

const JobCard = ({ currentJob, visibleKeys, theme, onEdit }: any) => {
    if (!currentJob) return null;
    const formatPay = (val: number | string) => { const num = Number(val); return isNaN(num) ? val : `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
    const getCutoffLabel = (val: string) => { if (!val) return 'Not Set'; switch(val) { case 'semi-monthly': return '15th / 30th'; case 'weekly': return 'Weekly'; case 'monthly': return 'End of Month'; default: return val; } };
    const getDetailValue = (key: string) => { switch(key) { case 'employment_status': return currentJob.employment_status || 'Regular'; case 'rate': return formatPay(currentJob.rate || currentJob.salary); case 'rate_type': return currentJob.rate_type ? currentJob.rate_type.charAt(0).toUpperCase() + currentJob.rate_type.slice(1) : 'Hourly'; case 'shift': return currentJob.work_schedule ? `${currentJob.work_schedule.start} - ${currentJob.work_schedule.end}` : 'N/A'; case 'payroll': return getCutoffLabel(currentJob.cutoff_config?.type); case 'breaks': return currentJob.break_schedule ? `${currentJob.break_schedule.length} Break(s)` : '0'; default: return 'N/A'; } };
    const getIcon = (key: string) => { switch(key) { case 'rate': return DollarCircleIcon; case 'shift': return Clock01Icon; case 'payroll': return Calendar03Icon; case 'employment_status': return Briefcase02Icon; default: return UserGroupIcon; } };
    const getDetailLabel = (key: string) => AVAILABLE_JOB_FIELDS.find(f => f.key === key)?.label || key;

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.cardHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.jobTitle, { color: theme.colors.text }]} numberOfLines={1}>{currentJob.title}</Text>
                    <Text style={[styles.companyName, { color: theme.colors.textSecondary }]} numberOfLines={1}>{currentJob.company || currentJob.company_name || 'No Company'}</Text>
                </View>
                <TouchableOpacity onPress={onEdit} style={[styles.iconButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}><HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.text} /></TouchableOpacity>
            </View>
            <View style={styles.cardContent}>
                {visibleKeys.length === 0 ? (<Text style={{ textAlign: 'center', color: theme.colors.textSecondary, fontStyle: 'italic', padding: 12 }}>No details visible. Tap edit to customize.</Text>) : (<View style={styles.gridContainer}>{visibleKeys.map((key: string) => (<View key={key} style={styles.gridItem}><DetailRow label={getDetailLabel(key)} value={getDetailValue(key)} icon={getIcon(key)} theme={theme} /></View>))}</View>)}
            </View>
        </View>
    );
};

const EmptyJobCard = ({ theme, router }: any) => (
    <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.primary + '15' }]}><HugeiconsIcon icon={Briefcase01Icon} size={32} color={theme.colors.primary} /></View>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Active Job</Text>
        <Text style={[styles.emptyDesc, { color: theme.colors.textSecondary }]}>Set up your job profile to start tracking your attendance and earnings.</Text>
        <TouchableOpacity onPress={() => router.push('/job/form')} style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.primaryButtonText}>Set Up Job</Text>
        </TouchableOpacity>
    </View>
);

const JobLoadingCard = ({ theme }: any) => (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, height: 180, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={{ marginTop: 12, color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Loading job details...</Text>
    </View>
);

export default function ProfileScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { triggerSync } = useSync();

    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [viewData, setViewData] = useState<{ profile: any; job: any }>({ profile: null, job: null });
    const [email, setEmail] = useState('');
    const [imageError, setImageError] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [avatarModalVisible, setAvatarModalVisible] = useState(false);
    const [visibleDetailKeys, setVisibleDetailKeys] = useState<string[]>(['employment_status', 'shift', 'rate', 'rate_type', 'payroll', 'breaks']);

    const loadData = useCallback(async (isRefresh = false) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setIsLoading(false); return; }
            const userId = session.user.id;
            setEmail(session.user.email || '');
            const db = await getDB();

            const localProfile = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
            let tempProfile = localProfile;
            let tempJob = null;

            if (localProfile) {
                const jobId = (localProfile as any).current_job_id;
                if (jobId) {
                    const localJob = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [jobId]);
                    if (localJob) {
                        const lj: any = localJob;
                        try {
                            lj.work_schedule = typeof lj.work_schedule === 'string' ? JSON.parse(lj.work_schedule) : lj.work_schedule;
                            lj.break_schedule = typeof lj.break_schedule === 'string' ? JSON.parse(lj.break_schedule) : lj.break_schedule;
                        } catch (e) {}
                        tempJob = lj;
                    }
                }
            }

            if (tempProfile) setViewData({ profile: tempProfile, job: tempJob });
            if (!isRefresh && localProfile) { setIsLoading(false); return; }

            const { data: remoteProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (remoteProfile) {
                await saveProfileLocal(remoteProfile);
                let remoteJob = null;
                if (remoteProfile.current_job_id) {
                    const { data: jobRes } = await supabase.from('job_positions').select('*').eq('id', remoteProfile.current_job_id).single();
                    remoteJob = jobRes;
                    if (remoteJob) await saveJobLocal(remoteJob);
                }
                setViewData({ profile: remoteProfile, job: remoteJob });
            }
        } catch (e) { console.log("Error loading profile:", e); } 
        finally { setRefreshing(false); setTimeout(() => setIsLoading(false), 100); }
    }, []);

    useFocusEffect(useCallback(() => { loadData(false); }, [loadData]));

    const onRefresh = async () => { setRefreshing(true); await triggerSync(); await loadData(true); };

    const handleUpdateProfile = async (updates: any) => {
        if (!viewData.profile) return;
        const updatedProfile = { ...viewData.profile, ...updates };
        setViewData(prev => ({ ...prev, profile: updatedProfile }));
        setIsUpdating(true); 
        try {
            const { data: { user } } = await supabase.auth.getSession();
            if (!user) return;
            await saveProfileLocal(updatedProfile);
            await queueSyncItem('profiles', user.id, 'UPDATE', updates);
            triggerSync();
        } catch (e) { console.log(e); } finally { setIsUpdating(false); }
    };

    const pickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
        if (!result.canceled) { setAvatarModalVisible(false); handleUpdateProfile({ avatar_url: result.assets[0].uri }); }
    };

    const { profile: userProfile, job: userJob } = viewData;
    const formatDisplayName = () => {
        if(!userProfile) return 'User';
        const titlePart = userProfile.title ? `${userProfile.title.trim()} ` : '';
        const middleInitial = userProfile.middle_name && userProfile.middle_name.trim().length > 0 ? ` ${userProfile.middle_name.trim().charAt(0).toUpperCase()}.` : '';
        const namePart = `${userProfile.first_name || ''}${middleInitial} ${userProfile.last_name || ''}`.trim() || userProfile.full_name || 'User';
        return `${titlePart}${namePart}${userProfile.professional_suffix ? `, ${userProfile.professional_suffix.trim()}` : ''}`;
    }
    const displayName = formatDisplayName();
    const displayJobTitle = userProfile?.job_title ? userProfile.job_title : null; 
    const hasAssignedJobId = !!userProfile?.current_job_id;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <EditDisplayModal visible={modalVisible} onClose={() => setModalVisible(false)} selectedKeys={visibleDetailKeys} onSave={(newKeys) => setVisibleDetailKeys(newKeys)} />
            <LoadingOverlay visible={isUpdating} message="Updating..." />
            <Modal visible={avatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
                <Pressable onPress={() => setAvatarModalVisible(false)} style={styles.modalOverlay}>
                    <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 20, borderRadius: 2 }} />
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Profile Picture</Text>
                        <TouchableOpacity onPress={pickAvatar} style={[styles.optionButton, { borderColor: theme.colors.border }]}><HugeiconsIcon icon={Camera01Icon} size={24} color={theme.colors.primary} /><Text style={[styles.optionText, { color: theme.colors.text }]}>Upload New Photo</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { setAvatarModalVisible(false); handleUpdateProfile({ avatar_url: null }); }} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}><HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} /><Text style={{ color: theme.colors.danger, fontWeight: '700', marginLeft: 12 }}>Remove Current Photo</Text></TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
                <TouchableOpacity onPress={() => router.push('/settings')} style={[styles.settingsButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}><HugeiconsIcon icon={Settings02Icon} size={22} color={theme.colors.text} /></TouchableOpacity>
            </View>
            {isLoading && !userProfile ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View> : (
                <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} showsVerticalScrollIndicator={false}>
                    <View style={styles.profileSection}>
                        <TouchableOpacity onPress={() => setAvatarModalVisible(true)} activeOpacity={0.8} style={{ marginBottom: 16 }}>
                            <View style={[styles.avatarWrapper, { borderColor: theme.colors.primary }]}>{userProfile?.avatar_url && !imageError ? <Image key={userProfile.avatar_url} source={{ uri: userProfile.avatar_url }} style={styles.avatar} resizeMode="cover" onError={() => setImageError(true)} /> : <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.iconBg }]}><HugeiconsIcon icon={UserCircleIcon} size={80} color={theme.colors.textSecondary} /></View>}<View style={[styles.editAvatarBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}><HugeiconsIcon icon={Camera01Icon} size={14} color={theme.colors.text} /></View></View>
                        </TouchableOpacity>
                        <Text style={[styles.nameText, { color: theme.colors.text }]}>{displayName}</Text>
                        {displayJobTitle ? <Text style={[styles.titleText, { color: theme.colors.primary }]}>{displayJobTitle}</Text> : null}
                        <Text style={[styles.emailText, { color: theme.colors.textSecondary }]}>{email}</Text>
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity onPress={() => router.push('/edit-profile')} style={[styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}><HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} /><Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Edit Info</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/job/job')} style={[styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}><HugeiconsIcon icon={Layers01Icon} size={16} color={theme.colors.primary} /><Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>Manage Jobs</Text></TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>CURRENT JOB</Text>
                        {userJob ? <JobCard currentJob={userJob} visibleKeys={visibleDetailKeys} theme={theme} onEdit={() => setModalVisible(true)} /> : hasAssignedJobId && !userJob ? <JobLoadingCard theme={theme} /> : <EmptyJobCard theme={theme} router={router} />}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
    headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    settingsButton: { padding: 10, borderRadius: 99, borderWidth: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 120 },
    profileSection: { alignItems: 'center', paddingVertical: 32 },
    avatarWrapper: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, padding: 3 },
    avatar: { width: '100%', height: '100%', borderRadius: 60 },
    avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
    editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    nameText: { fontSize: 24, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
    titleText: { fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
    emailText: { fontSize: 14, fontWeight: '500', opacity: 0.6, marginBottom: 24 },
    actionButtonsRow: { flexDirection: 'row', gap: 12, width: '80%' },
    actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: 'center' },
    actionButtonText: { marginLeft: 8, fontWeight: '700', fontSize: 14 },
    sectionContainer: { paddingHorizontal: 24, marginBottom: 20 },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, opacity: 0.7 },
    card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
    cardHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
    jobTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    companyName: { fontSize: 14, fontWeight: '500' },
    iconButton: { padding: 8, borderRadius: 12, borderWidth: 1 },
    cardContent: { padding: 20 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
    gridItem: { width: '50%', paddingHorizontal: 8, marginBottom: 16 },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
    detailIconContainer: { marginTop: 2, marginRight: 10 },
    detailLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2, opacity: 0.7 },
    detailValue: { fontSize: 14, fontWeight: '700' },
    emptyCard: { padding: 32, alignItems: 'center', borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },
    emptyIconContainer: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
    emptyDesc: { textAlign: 'center', fontSize: 14, marginBottom: 24, opacity: 0.7 },
    primaryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100 },
    primaryButtonText: { color: '#fff', fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 24 },
    optionButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
    optionText: { marginLeft: 16, fontSize: 16, fontWeight: '600' },
});