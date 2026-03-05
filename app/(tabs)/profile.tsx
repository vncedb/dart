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
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
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

import ChangelogModal from '../../components/ChangelogModal';
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
import { supabase } from '../../lib/supabase';

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
    const [isClockedIn, setIsClockedIn] = useState(false);
    
    const [isUpdating, setIsUpdating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Updating...');
    const [modalVisible, setModalVisible] = useState(false);
    const [avatarModalVisible, setAvatarModalVisible] = useState(false);
    const [changelogModalVisible, setChangelogModalVisible] = useState(false);
    
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
            } catch (err) {
                console.log("Failed to load display config", err);
            }
        };
        loadDisplayConfig();
    }, []);

    const handleSaveDisplayConfig = async (newKeys: string[]) => {
        setVisibleDetailKeys(newKeys);
        try {
            await AsyncStorage.setItem('jobCardVisibleKeys', JSON.stringify(newKeys));
        } catch (err) {
            console.log("Failed to save display config", err);
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

                        // Check Attendance Status
                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                        const activeAtt: any = await db.getFirstAsync(
                            `SELECT status FROM attendance WHERE user_id = ? AND job_id = ? AND date = ? AND status IN ('active', 'break') ORDER BY clock_in DESC LIMIT 1`,
                            [userId, jobId, todayStr]
                        );
                        setIsClockedIn(!!activeAtt);
                    }
                }

                // Smart Caching: Re-download if avatar_url changed or is missing locally
                if (tempProfile.avatar_url && tempProfile.avatar_url !== 'removed') {
                    const state = await NetInfo.fetch();
                    try {
                        const rawFileName = tempProfile.avatar_url.split('/').pop() || 'avatar.jpg';
                        const cleanFileName = rawFileName.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_');
                        const expectedFileName = `${userId}_${cleanFileName}`;
                        
                        const rootDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
                        if (rootDir) {
                            const avatarDir = `${rootDir}avatars/`;
                            const dirInfo = await FileSystem.getInfoAsync(avatarDir);
                            if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });

                            const expectedLocalUri = `${avatarDir}${expectedFileName}`;
                            const fileInfo = await FileSystem.getInfoAsync(expectedLocalUri);
                            
                            // If the image for THIS specific URL is not downloaded yet
                            if (!fileInfo.exists && state.isConnected) {
                                await FileSystem.downloadAsync(tempProfile.avatar_url, expectedLocalUri);
                            }
                            
                            // If it exists now, ensure local_avatar_path is updated in DB
                            const finalFileInfo = await FileSystem.getInfoAsync(expectedLocalUri);
                            if (finalFileInfo.exists) {
                                if (tempProfile.local_avatar_path !== expectedLocalUri) {
                                    await db.runAsync('UPDATE profiles SET local_avatar_path = ? WHERE id = ?', [expectedLocalUri, userId]);
                                    tempProfile.local_avatar_path = expectedLocalUri;
                                }
                            } else {
                                tempProfile.local_avatar_path = null;
                            }
                        }
                    } catch (err) { console.log("Failed caching avatar:", err); }
                } else if (tempProfile.avatar_url === 'removed' && tempProfile.local_avatar_path) {
                    await db.runAsync('UPDATE profiles SET local_avatar_path = NULL WHERE id = ?', [userId]);
                    tempProfile.local_avatar_path = null;
                }
            }

            setViewData({ profile: tempProfile, job: tempJob });
        } catch (err) { 
            console.log("Error loading profile:", err); 
        } finally { 
            setRefreshing(false); 
            setIsLoading(false); 
        }
    }, [user]);

    useFocusEffect(useCallback(() => { loadData(false); }, [loadData]));

    const onRefresh = async () => { 
        setRefreshing(true); 
        try {
            if (user) {
                const state = await NetInfo.fetch();
                if (state.isConnected) {
                    // Trigger standard sync
                    await triggerSync(); 
                    
                    // Directly fetch latest avatar from Supabase to guarantee absolute freshness
                    const { data: remoteProfile } = await supabase
                        .from('profiles')
                        .select('avatar_url')
                        .eq('id', user.id)
                        .single();
                        
                    if (remoteProfile) {
                        const db = await getDB();
                        await db.runAsync('UPDATE profiles SET avatar_url = ? WHERE id = ?', [remoteProfile.avatar_url, user.id]);
                    }
                }
            }
        } catch (e) {
            console.log("Refresh sync error:", e);
        }
        await loadData(true); 
    };

    const deleteOldAvatar = async (oldUrl: string | null) => {
        if (!oldUrl || oldUrl === 'removed' || !oldUrl.includes('/avatars/')) return;
        try {
            const parts = oldUrl.split('/avatars/');
            if (parts.length > 1) {
                const oldPath = parts[1].split('?')[0]; 
                const { error } = await supabase.storage.from('avatars').remove([oldPath]);
                if (error) console.log("Failed to delete old avatar from storage:", error.message);
            }
        } catch {
            console.log("Could not delete old avatar");
        }
    };

    const handleUpdateProfile = async (updates: any) => {
        if (!viewData.profile || !user) return;
        setIsUpdating(true);
        setLoadingMessage('Saving Data...');
        try {
            const updatedProfile = { ...viewData.profile, ...updates, updated_at: new Date().toISOString() };
            setViewData(prev => ({ ...prev, profile: updatedProfile }));
            
            // 1. Save to local SQLite
            await saveProfileLocal(updatedProfile);

            // 2. Queue for Sync
            const syncUpdates = { ...updates };
            delete syncUpdates.local_avatar_path;
            
            if (Object.keys(syncUpdates).length > 0) {
                await queueSyncItem('profiles', user.id, 'UPDATE', syncUpdates);
                triggerSync();
            }

        } catch (e) { 
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to save changes.', confirmText: 'OK', onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) });
        } finally { 
            setIsUpdating(false); 
            setAvatarModalVisible(false);
        }
    };

    const pickAvatar = async () => {
        const state = await NetInfo.fetch();
        if (!state.isConnected) {
            setAlertConfig({ 
                visible: true, 
                type: 'warning', 
                title: 'No Internet Connection', 
                message: 'You need an active internet connection to change your profile picture. Please connect and try again.', 
                confirmText: 'Got it', 
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) 
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({ 
            mediaTypes: ['images'], 
            allowsEditing: true, 
            aspect: [1, 1], 
            quality: 0.7 
        });

        if (!result.canceled && result.assets[0] && user) {
            const pickerUri = result.assets[0].uri;
            setAvatarModalVisible(false);
            
            setIsUpdating(true);
            setLoadingMessage('Processing Image...');

            let progressInterval: ReturnType<typeof setInterval> | null = null;

            try {
                const rootDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
                const avatarDir = `${rootDir}avatars/`;
                const dirInfo = await FileSystem.getInfoAsync(avatarDir);
                if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });

                const fileExt = pickerUri.split('.').pop() || 'jpeg';
                const fileName = `${user.id}_${Date.now()}.${fileExt}`;
                const localDest = `${avatarDir}${fileName}`;

                await FileSystem.copyAsync({ from: pickerUri, to: localDest });

                setViewData(prev => ({
                    ...prev,
                    profile: { ...prev.profile, local_avatar_path: localDest }
                }));

                let currentProgress = 0;
                setLoadingMessage(`Uploading Photo... ${currentProgress}%`);
                progressInterval = setInterval(() => {
                    currentProgress += Math.floor(Math.random() * 15) + 5; 
                    if (currentProgress > 90) currentProgress = 90; 
                    setLoadingMessage(`Uploading Photo... ${currentProgress}%`);
                }, 300);

                await deleteOldAvatar(viewData.profile?.avatar_url);

                const response = await fetch(localDest);
                const arrayBuffer = await response.arrayBuffer(); 
                const storagePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(storagePath, arrayBuffer, { 
                        contentType: `image/${fileExt}`, 
                        upsert: true 
                    });

                if (progressInterval) clearInterval(progressInterval);

                if (uploadError) {
                    console.error('Supabase Error:', uploadError);
                    throw new Error(uploadError.message || 'Failed to upload avatar.');
                }

                setLoadingMessage(`Finalizing...`);
                const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
                const newAvatarUrl = publicUrlData.publicUrl;

                const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
                    .eq('id', user.id);
                
                if (profileUpdateError) console.error('Failed to update remote profile:', profileUpdateError);

                await supabase.auth.updateUser({ data: { avatar_url: newAvatarUrl } });

                await handleUpdateProfile({ 
                    avatar_url: newAvatarUrl, 
                    local_avatar_path: localDest 
                });

            } catch (error: any) {
                if (progressInterval) clearInterval(progressInterval);
                console.error("Upload error:", error);
                
                setViewData(prev => ({
                    ...prev,
                    profile: { ...prev.profile, local_avatar_path: viewData.profile?.local_avatar_path }
                }));

                setAlertConfig({ 
                    visible: true, 
                    type: 'error', 
                    title: 'Upload Failed', 
                    message: error.message || 'An error occurred during upload. Please try again.', 
                    confirmText: 'OK', 
                    onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) 
                });
                setIsUpdating(false);
            }
        }
    };

    const removeAvatar = async () => { 
        const state = await NetInfo.fetch();
        if (!state.isConnected) {
            setAlertConfig({ 
                visible: true, 
                type: 'warning', 
                title: 'No Internet Connection', 
                message: 'You need an active internet connection to remove your profile picture. Please connect and try again.', 
                confirmText: 'Got it', 
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) 
            });
            return;
        }

        setAvatarModalVisible(false);
        setIsUpdating(true);
        setLoadingMessage('Removing Photo...');
        
        try {
            await deleteOldAvatar(viewData.profile?.avatar_url);
            
            if (user) {
                await supabase.from('profiles').update({ avatar_url: 'removed', updated_at: new Date().toISOString() }).eq('id', user.id);
                await supabase.auth.updateUser({ data: { avatar_url: '' } });
            }
            
            await handleUpdateProfile({ avatar_url: 'removed', local_avatar_path: null }); 
        } catch (err) {
            console.error(err);
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to remove profile picture.', confirmText: 'OK', onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) });
        } finally {
            setIsUpdating(false);
        }
    };

    const { profile: userProfile, job: userJob } = viewData;

    const getAvatarSource = () => {
        if (userProfile?.local_avatar_path) return { uri: userProfile.local_avatar_path };
        if (userProfile?.avatar_url === 'removed') return null; 
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
                        <TouchableOpacity 
                            onPress={() => setChangelogModalVisible(true)} 
                            style={[styles.settingsButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                        >
                            <HugeiconsIcon icon={Note05Icon} size={22} color={theme.colors.text} />
                        </TouchableOpacity>

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
                        <TouchableOpacity onPress={() => setAvatarModalVisible(true)} activeOpacity={1}>
                            <View style={styles.avatarMainContainer}>
                                <View style={[
                                    styles.avatarOuterRing, 
                                    { borderColor: isClockedIn ? theme.colors.primary : theme.colors.border }
                                ]}>
                                    <View style={[styles.avatarWrapper, { backgroundColor: theme.colors.card }]}>
                                        {avatarSource && !imageError ? (
                                            <Image key={avatarSource.uri} source={avatarSource} style={styles.avatar} contentFit="cover" onError={() => setImageError(true)} />
                                        ) : (
                                            <View style={[StyleSheet.absoluteFill, styles.avatarPlaceholder, { backgroundColor: theme.colors.card }]}>
                                                <HugeiconsIcon icon={UserCircleIcon} size={64} color={theme.colors.textSecondary} />
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={[styles.editAvatarBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <HugeiconsIcon icon={Camera01Icon} size={14} color={theme.colors.text} />
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
    
    avatarOuterRing: {
        width: 128, 
        height: 128, 
        borderRadius: 64, 
        borderWidth: 2, 
        alignItems: 'center', 
        justifyContent: 'center'
    },
    avatarWrapper: { 
        width: 114, 
        height: 114, 
        borderRadius: 57, 
        overflow: 'hidden' 
    }, 
    avatar: { width: '100%', height: '100%' },
    avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    
    editAvatarBtn: { 
        position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2
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