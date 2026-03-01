// filepath: app/(tabs)/profile.tsx
import {
    Briefcase01Icon,
    Camera01Icon,
    Layers01Icon,
    Mail01Icon,
    Note05Icon,
    PencilEdit02Icon,
    Settings02Icon,
    SparklesIcon,
    UserCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
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
import Animated, {
    FadeIn,
    SlideInDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChangelogModal from '../../components/ChangelogModal'; // <-- IMPORTED CHANGELOG MODAL
import EditAvatarModal from '../../components/EditAvatarModal';
import EditDisplayModal from '../../components/EditDisplayModal';
import JobCard from '../../components/JobCard';
import LoadingOverlay from '../../components/LoadingOverlay';
import LoadingScreen from '../../components/LoadingScreen';
import ModernAlert from '../../components/ModernAlert';
import TabHeader from '../../components/TabHeader';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { queueSyncItem, saveProfileLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';

const shadowStyle = Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 }
});

const EmptyJobCard = ({ theme, hasJobs }: any) => (
    <Animated.View 
        entering={FadeIn.duration(600).delay(100)} 
        style={[
            styles.emptyCard, 
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border }
        ]}
    >
        <View style={[styles.emptyBgAccent, { backgroundColor: theme.colors.primary, opacity: 0.03 }]} />

        <View style={styles.emptyContent}>
            <Animated.View entering={SlideInDown.duration(500).delay(200)} style={[styles.emptyIconContainer, { backgroundColor: theme.dark ? '#1F2937' : '#F3F4F6' }]}>
                <HugeiconsIcon icon={Briefcase01Icon} size={36} color={theme.colors.textSecondary} />
            </Animated.View>
            
            <Animated.View entering={SlideInDown.duration(500).delay(300)} style={styles.emptyTextContainer}>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                    {hasJobs ? "No Active Workspace" : "No Jobs Added"}
                </Text>
                <Text style={[styles.emptyDesc, { color: theme.colors.textSecondary }]}>
                    {hasJobs 
                        ? "You have saved jobs but none are set as active. Select an active job from the list to continue." 
                        : "Set up your job profile to configure your work schedule, track your period targets, and calculate your logged hours."}
                </Text>
            </Animated.View>
        </View>
    </Animated.View>
);

const DEFAULT_VISIBLE_KEYS = ['employment_status', 'shift', 'rate', 'period_target'];

export default function ProfileScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { triggerSync } = useSync();
    const { user } = useAuth(); 

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
    const [changelogModalVisible, setChangelogModalVisible] = useState(false); // <-- CHANGELOG STATE
    
    const [visibleDetailKeys, setVisibleDetailKeys] = useState<string[]>(DEFAULT_VISIBLE_KEYS);
    
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const pulseScale = useSharedValue(1);

    useEffect(() => {
        if (!hasJobs && !isLoading) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1, true
            );
        } else {
            pulseScale.value = withTiming(1, { duration: 300 });
        }
    }, [hasJobs, isLoading, pulseScale]);

    const animatedManageJobsStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }]
    }));

    useEffect(() => {
        const loadDisplayConfig = async () => {
            try {
                const savedConfig = await AsyncStorage.getItem('jobCardVisibleKeys');
                if (savedConfig) {
                    setVisibleDetailKeys(JSON.parse(savedConfig));
                }
            } catch (e) {
                console.log("Failed to load display config", e);
            }
        };
        loadDisplayConfig();
    }, []);

    const handleSaveDisplayConfig = async (newKeys: string[]) => {
        setVisibleDetailKeys(newKeys);
        try {
            await AsyncStorage.setItem('jobCardVisibleKeys', JSON.stringify(newKeys));
        } catch (e) {
            console.log("Failed to save display config", e);
        }
    };

    useEffect(() => {
        if (viewData.profile?.avatar_url || viewData.profile?.local_avatar_path) {
            setImageError(false);
        }
    }, [viewData.profile?.avatar_url, viewData.profile?.local_avatar_path]);

    const loadData = useCallback(async (isRefresh = false) => {
        try {
            if (!user) { setIsLoading(false); return; }
            const userId = user.id;
            setEmail(user.email || '');

            const db = await getDB();
            const jobsData = await db.getAllAsync('SELECT * FROM job_positions WHERE user_id = ?', [userId]);
            setHasJobs(jobsData && (jobsData as any[]).length > 0);

            const localProfile: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
            
            let tempProfile = localProfile || null;
            let tempJob = null;

            if (tempProfile) {
                const jobId = (tempProfile as any).current_job_id;
                if (jobId && jobsData) {
                    const localJob = (jobsData as any[]).find(j => j.id === jobId);
                    if (localJob) {
                        const lj: any = localJob;
                        try {
                            lj.work_schedule = typeof lj.work_schedule === 'string' ? JSON.parse(lj.work_schedule) : lj.work_schedule;
                            lj.break_schedule = typeof lj.break_schedule === 'string' ? JSON.parse(lj.break_schedule) : lj.break_schedule;
                        } catch { /* ignore */ }
                        tempJob = lj;
                    }
                }

                if (tempProfile.avatar_url && !tempProfile.local_avatar_path) {
                    const state = await NetInfo.fetch();
                    if (state.isConnected) {
                        try {
                            const rawFileName = tempProfile.avatar_url.split('/').pop() || 'avatar.jpg';
                            const cleanFileName = rawFileName.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_');
                            const fileName = `${userId}_${cleanFileName}`;
                            
                            const rootDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
                            if (rootDir) {
                                const avatarDir = `${rootDir}avatars/`;
                                const dirInfo = await FileSystem.getInfoAsync(avatarDir);
                                if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });

                                const localUri = `${avatarDir}${fileName}`;
                                const fileInfo = await FileSystem.getInfoAsync(localUri);
                                
                                if (!fileInfo.exists) await FileSystem.downloadAsync(tempProfile.avatar_url, localUri);
                                
                                await db.runAsync('UPDATE profiles SET local_avatar_path = ? WHERE id = ?', [localUri, userId]);
                                tempProfile.local_avatar_path = localUri;
                            }
                        } catch (e) { console.log("Failed caching avatar:", e); }
                    }
                }
            }

            setViewData({ profile: tempProfile, job: tempJob });
        } catch (e) { 
            console.log("Error loading profile:", e); 
        } finally { 
            setRefreshing(false); 
            setIsLoading(false); 
        }
    }, [user]);

    useFocusEffect(useCallback(() => { loadData(false); }, [loadData]));

    const onRefresh = async () => { 
        setRefreshing(true); 
        if (user) await triggerSync(); 
        await loadData(true); 
    };

    const handleUpdateProfile = async (updates: any) => {
        if (!viewData.profile || !user) return;
        setIsUpdating(true);
        setLoadingMessage('Saving Data...');
        try {
            const updatedProfile = { ...viewData.profile, ...updates };
            setViewData(prev => ({ ...prev, profile: updatedProfile }));
            await saveProfileLocal(updatedProfile);
            await queueSyncItem('profiles', user.id, 'UPDATE', updates);
            triggerSync();
        } catch (e) { 
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to save changes.', confirmText: 'OK', onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) });
        } finally { 
            setIsUpdating(false); 
            setAvatarModalVisible(false);
        }
    };

    const pickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
        if (!result.canceled) handleUpdateProfile({ local_avatar_path: result.assets[0].uri });
    };

    const removeAvatar = () => { handleUpdateProfile({ avatar_url: null, local_avatar_path: null }); };

    const { profile: userProfile, job: userJob } = viewData;

    const getAvatarSource = () => {
        if (userProfile?.local_avatar_path) return { uri: userProfile.local_avatar_path };
        if (userProfile?.avatar_url) return { uri: userProfile.avatar_url };
        if (user?.user_metadata) {
            const meta = user.user_metadata;
            const metaAvatar = meta.avatar_url || meta.picture || meta.avatar;
            if (metaAvatar) return { uri: metaAvatar };
        }
        return null;
    };
    
    const avatarSource = getAvatarSource();

    const displayName = (() => {
        if(userProfile) {
            const titlePart = userProfile.title ? `${userProfile.title.trim()} ` : '';
            const middleInitial = userProfile.middle_name && userProfile.middle_name.trim().length > 0 ? ` ${userProfile.middle_name.trim().charAt(0).toUpperCase()}.` : '';
            const namePart = `${userProfile.first_name || ''}${middleInitial} ${userProfile.last_name || ''}`.trim() || userProfile.full_name;
            if (namePart) return `${titlePart}${namePart}${userProfile.professional_suffix ? `, ${userProfile.professional_suffix.trim()}` : ''}`;
        }
        const meta = user?.user_metadata;
        if (meta) {
            if (meta.full_name) return meta.full_name;
            if (meta.name) return meta.name;
            if (meta.given_name) return `${meta.given_name} ${meta.family_name || ''}`.trim();
        }
        return 'User';
    })();

    const userPlan = "Free Plan"; 

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={isUpdating} message={loadingMessage} />
            
            <EditDisplayModal visible={modalVisible} onClose={() => setModalVisible(false)} selectedKeys={visibleDetailKeys} onSave={handleSaveDisplayConfig} />
            <EditAvatarModal visible={avatarModalVisible} onClose={() => setAvatarModalVisible(false)} onPickImage={pickAvatar} onRemoveImage={removeAvatar} />
            <ChangelogModal visible={changelogModalVisible} onClose={() => setChangelogModalVisible(false)} />
            
            <TabHeader 
                title="Profile"
                rightElement={
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        {/* CHANGELOG BUTTON */}
                        <TouchableOpacity 
                            onPress={() => setChangelogModalVisible(true)} 
                            style={[styles.settingsButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                        >
                            <HugeiconsIcon icon={Note05Icon} size={22} color={theme.colors.text} />
                        </TouchableOpacity>

                        {/* SETTINGS BUTTON */}
                        <TouchableOpacity 
                            onPress={() => router.push('/settings')} 
                            style={[styles.settingsButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                        >
                            <HugeiconsIcon icon={Settings02Icon} size={22} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                }
            />

            {isLoading ? (
                <LoadingScreen message="Loading Profile..." />
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
                            
                            <TouchableOpacity 
                                activeOpacity={0.7} 
                                onPress={() => router.push('/settings/plan')}
                                style={[styles.planBadge, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}
                            >
                                <HugeiconsIcon icon={SparklesIcon} size={14} color={theme.colors.primary} />
                                <Text style={[styles.planBadgeText, { color: theme.colors.primary }]}>{userPlan}</Text>
                            </TouchableOpacity>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, opacity: 0.6 }}>
                                <HugeiconsIcon icon={Mail01Icon} size={14} color={theme.colors.text} />
                                <Text style={{ marginLeft: 6, fontSize: 13, color: theme.colors.text, fontFamily: 'Nunito_500Medium' }}>{email}</Text>
                            </View>
                        </View>

                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity onPress={() => router.push('/edit-profile')} style={[styles.actionButtonWrapper, styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                                <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Edit Info</Text>
                            </TouchableOpacity>
                            
                            <Animated.View style={[styles.actionButtonWrapper, animatedManageJobsStyle]}>
                                <TouchableOpacity onPress={() => router.push('/job/job')} style={[styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, width: '100%' }]}>
                                    <HugeiconsIcon icon={Layers01Icon} size={16} color={theme.colors.primary} />
                                    <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>Manage Jobs</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        </View>
                    </View>

                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>CURRENT JOB</Text>
                        {userJob ? (
                            <JobCard 
                                currentJob={userJob} 
                                visibleKeys={visibleDetailKeys} 
                                theme={theme} 
                                onEdit={() => setModalVisible(true)} 
                                router={router}
                            />
                        ) : (
                            <EmptyJobCard theme={theme} hasJobs={hasJobs} />
                        )}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    settingsButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingBottom: 120 },
    
    profileSection: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
    avatarMainContainer: { position: 'relative' },
    avatarWrapper: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, overflow: 'hidden' }, 
    avatar: { width: '100%', height: '100%' },
    avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    
    editAvatarBtn: { 
        position: 'absolute', bottom: 0, right: 0, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2,
        ...shadowStyle
    },
    
    nameText: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center', letterSpacing: -0.5 },
    
    planBadge: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
    planBadgeText: { fontSize: 12, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    
    actionButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
    actionButtonWrapper: { flex: 1 },
    actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1, justifyContent: 'center', ...shadowStyle },
    actionButtonText: { marginLeft: 8, fontFamily: 'Nunito_600SemiBold', fontSize: 14 },
    
    sectionContainer: { paddingHorizontal: 24, marginBottom: 20 },
    sectionTitle: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, marginBottom: 12, opacity: 0.7 },
    
    emptyCard: { borderWidth: 1, borderRadius: 28, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2, position: 'relative' },
    emptyBgAccent: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75 },
    emptyContent: { padding: 32, alignItems: 'center' },
    emptyIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTextContainer: { alignItems: 'center', marginBottom: 8 },
    emptyTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
    emptyDesc: { fontFamily: 'Nunito_500Medium', fontSize: 15, lineHeight: 24, textAlign: 'center', opacity: 0.9, paddingHorizontal: 8 },
});