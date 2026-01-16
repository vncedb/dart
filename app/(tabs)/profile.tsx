import {
    Briefcase01Icon,
    Briefcase02Icon,
    Calendar03Icon,
    Camera01Icon,
    Clock01Icon,
    DollarCircleIcon,
    Layers01Icon,
    Mail01Icon,
    PencilEdit02Icon,
    Settings02Icon,
    UserCircleIcon,
    UserGroupIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import { downloadAsync, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EditAvatarModal from '../../components/EditAvatarModal';
import EditDisplayModal, { AVAILABLE_JOB_FIELDS } from '../../components/EditDisplayModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { queueSyncItem, saveJobLocal, saveProfileLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

const { height } = Dimensions.get('window');

// --- Shared Shadow Style ---
const shadowStyle = Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    android: { elevation: 2 }
});

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
    
    // FIXED: Updated to read 'payout_type' instead of 'cutoff_config'
    const getCutoffLabel = (val: string) => { 
        if (!val) return 'Not Set'; 
        switch(val) { 
            case 'Semi-Monthly': return '15th / 30th'; 
            case 'Weekly': return 'Every Friday'; 
            case 'Monthly': return 'End of Month'; 
            case 'Bi-Weekly': return 'Every 2 Weeks';
            default: return val; 
        } 
    };
    
    const getDetailValue = (key: string) => { 
        switch(key) { 
            case 'employment_status': return currentJob.employment_status || 'Regular'; 
            case 'rate': return formatPay(currentJob.rate || currentJob.salary); 
            case 'rate_type': return currentJob.rate_type ? currentJob.rate_type.charAt(0).toUpperCase() + currentJob.rate_type.slice(1) : 'Hourly'; 
            case 'shift': return currentJob.work_schedule ? `${currentJob.work_schedule.start} - ${currentJob.work_schedule.end}` : 'N/A'; 
            
            // FIXED: Using payout_type
            case 'payroll': return getCutoffLabel(currentJob.payout_type || currentJob.cutoff_config?.type); 
            
            case 'breaks': return currentJob.break_schedule ? `${currentJob.break_schedule.length} Break(s)` : '0'; 
            default: return 'N/A'; 
        } 
    };

    const getIcon = (key: string) => { 
        switch(key) { 
            case 'rate': return DollarCircleIcon; 
            case 'shift': return Clock01Icon; 
            case 'payroll': return Calendar03Icon; 
            case 'employment_status': return Briefcase02Icon; 
            default: return UserGroupIcon; 
        } 
    };
    const getDetailLabel = (key: string) => AVAILABLE_JOB_FIELDS.find(f => f.key === key)?.label || key;

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.cardHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.jobTitle, { color: theme.colors.text }]} numberOfLines={1}>{currentJob.title}</Text>
                    <Text style={[styles.companyName, { color: theme.colors.textSecondary }]} numberOfLines={1}>{currentJob.company || currentJob.company_name || 'No Company'}</Text>
                </View>
                <TouchableOpacity onPress={onEdit} style={[styles.iconButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
            </View>
            <View style={styles.cardContent}>
                {visibleKeys.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, fontStyle: 'italic', padding: 12 }}>No details visible. Tap edit to customize.</Text>
                ) : (
                    <View style={styles.gridContainer}>
                        {visibleKeys.map((key: string) => (
                            <View key={key} style={styles.gridItem}>
                                <DetailRow label={getDetailLabel(key)} value={getDetailValue(key)} icon={getIcon(key)} theme={theme} />
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
};

const EmptyJobCard = ({ theme, router, hasJobs }: any) => (
    <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <HugeiconsIcon icon={Briefcase01Icon} size={32} color={theme.colors.primary} />
        </View>
        
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            {hasJobs ? "No Active Job" : "No Jobs Added"}
        </Text>
        
        <Text style={[styles.emptyDesc, { color: theme.colors.textSecondary }]}>
            {hasJobs 
                ? "You have saved jobs but none are set as active." 
                : "Set up your job profile to start tracking your attendance."}
        </Text>
        
        <TouchableOpacity 
            onPress={() => router.push('/job/job')} 
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        >
            <Text style={styles.primaryButtonText}>
                {hasJobs ? "Select Active Job" : "Manage Jobs"}
            </Text>
        </TouchableOpacity>
    </View>
);

export default function ProfileScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { triggerSync } = useSync();

    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [viewData, setViewData] = useState<{ profile: any; job: any }>({ profile: null, job: null });
    const [hasJobs, setHasJobs] = useState(false);
    const [email, setEmail] = useState('');
    const [imageError, setImageError] = useState(false);
    
    const [isUpdating, setIsUpdating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Updating...');
    const [modalVisible, setModalVisible] = useState(false);
    const [avatarModalVisible, setAvatarModalVisible] = useState(false);
    const [visibleDetailKeys, setVisibleDetailKeys] = useState<string[]>(['employment_status', 'shift', 'rate', 'rate_type', 'payroll', 'breaks']);

    useEffect(() => {
        if (viewData.profile?.avatar_url || viewData.profile?.local_avatar_path) {
            setImageError(false);
        }
    }, [viewData.profile?.avatar_url, viewData.profile?.local_avatar_path]);

    const loadData = useCallback(async (isRefresh = false) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { setIsLoading(false); return; }
            const userId = session.user.id;
            setEmail(session.user.email || '');
            const db = await getDB();

            const jobsData = await db.getAllAsync('SELECT * FROM job_positions WHERE user_id = ?', [userId]);
            setHasJobs(jobsData && (jobsData as any[]).length > 0);

            const localProfile = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
            
            let tempProfile = localProfile;
            let tempJob = null;

            if (localProfile) {
                const jobId = (localProfile as any).current_job_id;
                if (jobId && jobsData) {
                    const localJob = (jobsData as any[]).find(j => j.id === jobId);
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

            if (tempProfile) {
                setViewData({ profile: tempProfile, job: tempJob });
            } else {
                setIsLoading(true); 
            }

            const state = await NetInfo.fetch();
            if (state.isConnected) {
                const { data: remoteProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (remoteProfile) {
                    if (remoteProfile.avatar_url) {
                        try {
                            const rawFileName = remoteProfile.avatar_url.split('/').pop();
                            const cleanFileName = rawFileName ? rawFileName.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_') : 'avatar.jpg';
                            const fileName = `${userId}_${cleanFileName}`;
                            const rootDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
                            
                            if (rootDir) {
                                const avatarDir = `${rootDir}avatars/`;
                                const dirInfo = await getInfoAsync(avatarDir);
                                if (!dirInfo.exists) await makeDirectoryAsync(avatarDir, { intermediates: true });

                                const localUri = `${avatarDir}${fileName}`;
                                const fileInfo = await getInfoAsync(localUri);
                                
                                if (!fileInfo.exists) await downloadAsync(remoteProfile.avatar_url, localUri);
                                remoteProfile.local_avatar_path = localUri;
                            }
                        } catch (err) {
                            if (tempProfile && (tempProfile as any).local_avatar_path) {
                                 remoteProfile.local_avatar_path = (tempProfile as any).local_avatar_path;
                            }
                        }
                    }
                    await saveProfileLocal(remoteProfile);
                    
                    let remoteJob = null;
                    if (remoteProfile.current_job_id) {
                        const { data: jobRes } = await supabase.from('job_positions').select('*').eq('id', remoteProfile.current_job_id).single();
                        remoteJob = jobRes;
                        if (remoteJob) await saveJobLocal(remoteJob);
                    }
                    setViewData({ profile: remoteProfile, job: remoteJob || tempJob });
                }
            }
        } catch (e) { console.log("Error loading profile:", e); } 
        finally { 
            setRefreshing(false); 
            setIsLoading(false); 
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(false); }, [loadData]));

    const onRefresh = async () => { setRefreshing(true); await triggerSync(); await loadData(true); };

    const deleteOldAvatar = async (url: string) => {
        if (!url) return;
        try {
            const pathParts = url.split('/avatars/');
            if (pathParts.length > 1) {
                const path = pathParts[1].split('?')[0]; 
                await supabase.storage.from('avatars').remove([path]);
            }
        } catch (e) { console.log("Failed to delete old avatar:", e); }
    };

    const uploadAvatar = async (uri: string, userId: string) => {
        const state = await NetInfo.fetch();
        if (!state.isConnected) throw new Error("Offline");

        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        const ext = uri.substring(uri.lastIndexOf('.') + 1);
        const fileName = `${userId}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from('avatars').upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: true });
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        return `${publicUrl}?t=${new Date().getTime()}`;
    };

    const handleUpdateProfile = async (updates: any) => {
        if (!viewData.profile) return;
        const oldAvatarUrl = viewData.profile.avatar_url;

        setIsUpdating(true);
        setLoadingMessage('Saving Profile...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let finalUpdates = { ...updates };
            
            if (updates.avatar_url && updates.avatar_url.startsWith('file://')) {
                 setLoadingMessage('Uploading Image...');
                 try {
                     const publicUrl = await uploadAvatar(updates.avatar_url, user.id);
                     finalUpdates.avatar_url = publicUrl;
                     finalUpdates.local_avatar_path = updates.avatar_url; 
                     if (oldAvatarUrl && oldAvatarUrl !== publicUrl) deleteOldAvatar(oldAvatarUrl);
                 } catch (e: any) {
                     setIsUpdating(false);
                     Alert.alert("Upload Failed", e.message === 'Offline' ? "You are offline." : "Could not upload image.");
                     return; 
                 }
            } else if (updates.avatar_url === null) {
                finalUpdates.avatar_url = null;
                finalUpdates.local_avatar_path = null;
                if (oldAvatarUrl) deleteOldAvatar(oldAvatarUrl);
            }

            setLoadingMessage('Saving Data...');
            const updatedProfile = { ...viewData.profile, ...finalUpdates };
            setViewData(prev => ({ ...prev, profile: updatedProfile }));
            
            await saveProfileLocal(updatedProfile);
            const { local_avatar_path, ...syncData } = finalUpdates;
            await queueSyncItem('profiles', user.id, 'UPDATE', syncData);
            
            triggerSync();
        } catch (e: any) { 
            console.log("Update Error:", e);
            Alert.alert("Error", "Failed to save changes.");
        } finally { 
            setIsUpdating(false); 
            setAvatarModalVisible(false);
        }
    };

    const pickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
        if (!result.canceled) { handleUpdateProfile({ avatar_url: result.assets[0].uri }); }
    };

    const removeAvatar = () => { handleUpdateProfile({ avatar_url: null }); };

    const { profile: userProfile, job: userJob } = viewData;
    const avatarSource = userProfile?.local_avatar_path ? { uri: userProfile.local_avatar_path } : (userProfile?.avatar_url ? { uri: userProfile.avatar_url } : null);

    const displayName = (() => {
        if(!userProfile) return 'User';
        const titlePart = userProfile.title ? `${userProfile.title.trim()} ` : '';
        const middleInitial = userProfile.middle_name && userProfile.middle_name.trim().length > 0 ? ` ${userProfile.middle_name.trim().charAt(0).toUpperCase()}.` : '';
        const namePart = `${userProfile.first_name || ''}${middleInitial} ${userProfile.last_name || ''}`.trim() || userProfile.full_name || 'User';
        return `${titlePart}${namePart}${userProfile.professional_suffix ? `, ${userProfile.professional_suffix.trim()}` : ''}`;
    })();

    const displayJobTitle = userJob ? userJob.title : 'No Job Selected';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            
            <EditDisplayModal visible={modalVisible} onClose={() => setModalVisible(false)} selectedKeys={visibleDetailKeys} onSave={(newKeys) => setVisibleDetailKeys(newKeys)} />
            <EditAvatarModal visible={avatarModalVisible} onClose={() => setAvatarModalVisible(false)} onPickImage={pickAvatar} onRemoveImage={removeAvatar} />
            <LoadingOverlay visible={isUpdating} message={loadingMessage} />
            
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
                <TouchableOpacity onPress={() => router.push('/settings')} style={[styles.settingsButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <HugeiconsIcon icon={Settings02Icon} size={22} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {isLoading && !userProfile ? (
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} showsVerticalScrollIndicator={false}>
                    <View style={styles.profileSection}>
                        <TouchableOpacity onPress={() => setAvatarModalVisible(true)} activeOpacity={0.8}>
                            <View style={styles.avatarMainContainer}>
                                <View style={[styles.avatarWrapper, { borderColor: theme.colors.primary, backgroundColor: theme.colors.card }]}>
                                    {avatarSource && !imageError ? (
                                        <Image key={avatarSource.uri} source={avatarSource} style={styles.avatar} resizeMode="cover" onError={() => setImageError(true)} />
                                    ) : (
                                        <View style={[StyleSheet.absoluteFill, styles.avatarPlaceholder, { backgroundColor: theme.colors.card }]}>
                                            <HugeiconsIcon icon={UserCircleIcon} size={64} color={theme.colors.textSecondary} />
                                        </View>
                                    )}
                                </View>
                                <View style={[styles.editAvatarBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <HugeiconsIcon icon={Camera01Icon} size={16} color={theme.colors.text} />
                                </View>
                            </View>
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center', marginTop: 16 }}>
                            <Text style={[styles.nameText, { color: theme.colors.text }]}>{displayName}</Text>
                            <View style={[styles.badgeContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{displayJobTitle}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, opacity: 0.6 }}>
                                <HugeiconsIcon icon={Mail01Icon} size={14} color={theme.colors.text} />
                                <Text style={{ marginLeft: 6, fontSize: 13, color: theme.colors.text, fontWeight: '500' }}>{email}</Text>
                            </View>
                        </View>

                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity onPress={() => router.push('/edit-profile')} style={[styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                                <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Edit Info</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/job/job')} style={[styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <HugeiconsIcon icon={Layers01Icon} size={16} color={theme.colors.primary} />
                                <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>Manage Jobs</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>CURRENT JOB</Text>
                        {userJob ? <JobCard currentJob={userJob} visibleKeys={visibleDetailKeys} theme={theme} onEdit={() => setModalVisible(true)} /> : <EmptyJobCard theme={theme} router={router} hasJobs={hasJobs} />}
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
    
    profileSection: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
    avatarMainContainer: { position: 'relative' },
    avatarWrapper: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, overflow: 'hidden' }, 
    avatar: { width: '100%', height: '100%' },
    avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    
    editAvatarBtn: { 
        position: 'absolute', bottom: 0, right: 0, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
        ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 }, android: { elevation: 4 } })
    },
    
    nameText: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
    badgeContainer: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100 },
    badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    
    actionButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
    actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1, flex: 1, justifyContent: 'center', ...shadowStyle },
    actionButtonText: { marginLeft: 8, fontWeight: '700', fontSize: 14 },
    
    sectionContainer: { paddingHorizontal: 24, marginBottom: 20 },
    sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12, opacity: 0.7 },
    
    card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', ...shadowStyle },
    cardHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
    jobTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    companyName: { fontSize: 14, fontWeight: '500' },
    iconButton: { padding: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
    cardContent: { padding: 20 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
    gridItem: { width: '50%', paddingHorizontal: 8, marginBottom: 16 },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
    detailIconContainer: { marginTop: 2, marginRight: 10 },
    detailLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2, opacity: 0.7 },
    detailValue: { fontSize: 14, fontWeight: '700' },
    
    emptyCard: { padding: 32, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', ...shadowStyle },
    emptyIconContainer: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
    emptyDesc: { textAlign: 'center', fontSize: 14, marginBottom: 24, opacity: 0.7 },
    primaryButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100 },
    primaryButtonText: { color: '#fff', fontWeight: '700' },
});