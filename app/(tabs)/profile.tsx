import {
    Briefcase01Icon,
    Briefcase02Icon,
    Calendar03Icon,
    Camera01Icon,
    Cancel01Icon,
    Clock01Icon,
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
import LoadingOverlay from '../../components/LoadingOverlay'; // Ensure this is imported
import { useAppTheme } from '../../constants/theme';
import { queueSyncItem, saveProfileLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

// --- COMPONENTS ---

const DetailRow = ({ label, value, icon, theme }: any) => (
    <View style={styles.detailRow}>
        <View style={styles.detailIconContainer}>
            <HugeiconsIcon icon={icon} size={18} color={theme.colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]}>{value}</Text>
        </View>
    </View>
);

const JobCard = ({ currentJob, visibleKeys, theme, onEdit }: any) => {
    if (!currentJob) return null;

    const formatPay = (val: number | string) => { 
        const num = Number(val); 
        return isNaN(num) ? val : `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; 
    };

    const getCutoffLabel = (val: string) => { 
        if (!val) return 'Not Set'; 
        switch(val) { case 'semi-monthly': return '15th / 30th'; case 'weekly': return 'Weekly'; case 'monthly': return 'End of Month'; default: return val; } 
    };

    const getDetailValue = (key: string) => {
        switch(key) {
            case 'employment_status': return currentJob.employment_status || 'Regular';
            case 'rate': return formatPay(currentJob.rate || currentJob.salary);
            case 'rate_type': return currentJob.rate_type ? currentJob.rate_type.charAt(0).toUpperCase() + currentJob.rate_type.slice(1) : 'Hourly';
            case 'shift': return currentJob.work_schedule ? `${currentJob.work_schedule.start} - ${currentJob.work_schedule.end}` : 'N/A';
            case 'payroll': return getCutoffLabel(currentJob.cutoff_config?.type);
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
                    <Text style={[styles.companyName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        {currentJob.company || currentJob.company_name || 'No Company'}
                    </Text>
                </View>
                <TouchableOpacity onPress={onEdit} style={[styles.iconButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.cardContent}>
                {visibleKeys.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, fontStyle: 'italic', padding: 12 }}>
                        No details visible. Tap edit to customize.
                    </Text>
                ) : (
                    <View style={styles.gridContainer}>
                        {visibleKeys.map((key: string) => (
                            <View key={key} style={styles.gridItem}>
                                <DetailRow 
                                    label={getDetailLabel(key)} 
                                    value={getDetailValue(key)} 
                                    icon={getIcon(key)} 
                                    theme={theme} 
                                />
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
};

const EmptyJobCard = ({ theme, router }: any) => (
    <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <HugeiconsIcon icon={Briefcase01Icon} size={32} color={theme.colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Active Job</Text>
        <Text style={[styles.emptyDesc, { color: theme.colors.textSecondary }]}>
            Set up your job profile to start tracking your attendance and earnings.
        </Text>
        <TouchableOpacity 
            onPress={() => router.push('/job/form')}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        >
            <Text style={styles.primaryButtonText}>Set Up Job</Text>
        </TouchableOpacity>
    </View>
);

// --- MAIN SCREEN ---
export default function ProfileScreen() {
    const router = useRouter();
    const theme = useAppTheme();

    const [refreshing, setRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [currentJob, setCurrentJob] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [imageError, setImageError] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false); // NEW state for overlay
    
    // UI State
    const [modalVisible, setModalVisible] = useState(false);
    const [avatarModalVisible, setAvatarModalVisible] = useState(false);
    const [visibleDetailKeys, setVisibleDetailKeys] = useState<string[]>([
        'employment_status', 'shift', 'rate', 'rate_type', 'payroll', 'breaks'
    ]);

    useFocusEffect(useCallback(() => { 
        loadData(false);
    }, []));

    const loadData = async (forceRefresh = false) => {
        if (!forceRefresh && !profile) setIsLoading(true);
        try {
            const db = await getDB();
            
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            if (!userId) {
                const localProfile = await db.getFirstAsync('SELECT * FROM profiles LIMIT 1');
                if (localProfile) setProfile(localProfile);
                setIsLoading(false);
                return;
            }

            setEmail(session.user.email || '');

            let profileData: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
            
            if (profileData && typeof profileData.avatar_history === 'string') {
                try { profileData.avatar_history = JSON.parse(profileData.avatar_history); } catch (e) { profileData.avatar_history = []; }
            }

            const shouldFetchRemote = forceRefresh || !profileData;
            if (shouldFetchRemote) {
                const { data: remoteProfile } = await supabase.from('profiles').select('*').eq('id', userId).single();
                if (remoteProfile) {
                    await saveProfileLocal(remoteProfile);
                    profileData = remoteProfile;
                }
            }

            if (profileData) {
                setProfile(profileData);
                setImageError(false);

                let jobData: any = null;
                if (profileData.current_job_id) {
                    jobData = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [profileData.current_job_id]);
                    if (!jobData && shouldFetchRemote) {
                        const { data } = await supabase.from('job_positions').select('*').eq('id', profileData.current_job_id).single();
                        jobData = data;
                    }
                } else {
                    const { data } = await supabase.from('job_positions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
                    jobData = data;
                }
                setCurrentJob(jobData);
            }

        } catch (e) { 
            console.log("Profile Load Error:", e); 
        } finally { 
            setRefreshing(false); 
            setIsLoading(false);
        }
    };

    const handleUpdateProfile = async (updates: any) => {
        if (!profile) return;
        setIsUpdating(true); // Show overlay for heavier updates like avatar
        try {
            // Optimistic
            const updatedProfile = { ...profile, ...updates };
            setProfile(updatedProfile); 
            
            // Local Save
            await saveProfileLocal(updatedProfile);
            
            // Queue Sync
            const { data: { user } } = await supabase.auth.getSession();
            if (user) {
                await queueSyncItem('profiles', user.id, 'UPDATE', updates);
                // Try Push
                supabase.from('profiles').update(updates).eq('id', user.id).then(({error}) => {
                    if(error) console.log("Sync queued.");
                });
            }
        } catch (e) {
            console.log(e);
        } finally {
            setIsUpdating(false);
        }
    };

    const pickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setAvatarModalVisible(false);
            handleUpdateProfile({ avatar_url: result.assets[0].uri });
        }
    };

    const removeFromHistory = async (urlToRemove: string) => {
        if (!profile) return;
        let currentHistory = Array.isArray(profile.avatar_history) ? profile.avatar_history : [];
        const newHistory = currentHistory.filter((url: string) => url !== urlToRemove);
        handleUpdateProfile({ avatar_history: newHistory });
    };

    const formatDisplayName = () => {
        if(!profile) return 'User';
        const titlePart = profile.title ? `${profile.title.trim()} ` : '';
        const namePart = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.full_name;
        const suffixPart = profile.professional_suffix ? `, ${profile.professional_suffix.trim()}` : '';
        return `${titlePart}${namePart}${suffixPart}`;
    }

    const displayName = formatDisplayName();
    const displayJobTitle = profile?.job_title ? profile.job_title : null; 
    const avatarHistory = Array.isArray(profile?.avatar_history) ? profile.avatar_history : [];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            
            <EditDisplayModal visible={modalVisible} onClose={() => setModalVisible(false)} selectedKeys={visibleDetailKeys} onSave={(newKeys) => setVisibleDetailKeys(newKeys)} />
            <LoadingOverlay visible={isUpdating} message="Updating..." />

            {/* AVATAR HISTORY MODAL */}
            <Modal visible={avatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
                <Pressable onPress={() => setAvatarModalVisible(false)} style={styles.modalOverlay}>
                    <Pressable style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
                        <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 20, borderRadius: 2 }} />
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Profile Picture</Text>
                        
                        <TouchableOpacity onPress={pickAvatar} style={[styles.optionButton, { borderColor: theme.colors.border }]}>
                            <HugeiconsIcon icon={Camera01Icon} size={24} color={theme.colors.primary} />
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>Upload New Photo</Text>
                        </TouchableOpacity>

                        {avatarHistory.length > 0 && (
                            <>
                                <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>PREVIOUS PHOTOS</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 10 }}>
                                    {avatarHistory.map((url: string, index: number) => (
                                        <View key={index} style={{ position: 'relative' }}>
                                            <TouchableOpacity onPress={() => { setAvatarModalVisible(false); handleUpdateProfile({ avatar_url: url }); }}>
                                                <Image source={{ uri: url }} style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 1, borderColor: theme.colors.border }} />
                                            </TouchableOpacity>
                                            
                                            <TouchableOpacity 
                                                onPress={() => removeFromHistory(url)}
                                                style={{
                                                    position: 'absolute',
                                                    top: -4,
                                                    right: -4,
                                                    backgroundColor: theme.colors.danger,
                                                    borderRadius: 12,
                                                    width: 24,
                                                    height: 24,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderWidth: 2,
                                                    borderColor: theme.colors.card
                                                }}
                                            >
                                                <HugeiconsIcon icon={Cancel01Icon} size={12} color="#fff" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        <TouchableOpacity onPress={() => { setAvatarModalVisible(false); handleUpdateProfile({ avatar_url: null }); }} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 }}>
                            <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />
                            <Text style={{ color: theme.colors.danger, fontWeight: '700', marginLeft: 12 }}>Remove Current Photo</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* HEADER */}
            <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Profile</Text>
                <TouchableOpacity 
                    onPress={() => router.push('/settings')} 
                    style={[styles.settingsButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                >
                    <HugeiconsIcon icon={Settings02Icon} size={22} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.colors.primary} />} 
                    showsVerticalScrollIndicator={false}
                >
                    {/* PROFILE INFO SECTION */}
                    <View style={styles.profileSection}>
                        <TouchableOpacity onPress={() => setAvatarModalVisible(true)} activeOpacity={0.8} style={{ marginBottom: 16 }}>
                            <View style={[styles.avatarWrapper, { borderColor: theme.colors.primary }]}>
                                {profile?.avatar_url && !imageError ? (
                                    <Image 
                                        key={profile.avatar_url}
                                        source={{ uri: profile.avatar_url }} 
                                        style={styles.avatar} 
                                        resizeMode="cover"
                                        onError={() => setImageError(true)} 
                                    />
                                ) : (
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.iconBg }]}>
                                        <HugeiconsIcon icon={UserCircleIcon} size={80} color={theme.colors.textSecondary} />
                                    </View>
                                )}
                                <View style={[styles.editAvatarBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <HugeiconsIcon icon={Camera01Icon} size={14} color={theme.colors.text} />
                                </View>
                            </View>
                        </TouchableOpacity>

                        <Text style={[styles.nameText, { color: theme.colors.text }]}>{displayName}</Text>
                        {displayJobTitle ? (
                            <Text style={[styles.titleText, { color: theme.colors.primary }]}>{displayJobTitle}</Text>
                        ) : null}
                        <Text style={[styles.emailText, { color: theme.colors.textSecondary }]}>{email}</Text>

                        {/* Action Buttons */}
                        <View style={styles.actionButtonsRow}>
                            <TouchableOpacity 
                                onPress={() => router.push('/edit-profile')} 
                                style={[styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                            >
                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                                <Text style={[styles.actionButtonText, { color: theme.colors.text }]}>Edit Info</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                onPress={() => router.push('/job/job')} 
                                style={[styles.actionButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                            >
                                <HugeiconsIcon icon={Layers01Icon} size={16} color={theme.colors.primary} />
                                <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>Manage Jobs</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* JOB CARD */}
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>CURRENT JOB</Text>
                        {currentJob ? (
                            <JobCard 
                                currentJob={currentJob} 
                                visibleKeys={visibleDetailKeys} 
                                theme={theme} 
                                onEdit={() => setModalVisible(true)} 
                            />
                        ) : (
                            <EmptyJobCard theme={theme} router={router} />
                        )}
                    </View>

                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    settingsButton: {
        padding: 10,
        borderRadius: 99,
        borderWidth: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 120, // Ensure content isn't hidden by tab bar
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        padding: 3,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editAvatarBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    nameText: {
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 4,
        textAlign: 'center',
    },
    titleText: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emailText: {
        fontSize: 14,
        fontWeight: '500',
        opacity: 0.6,
        marginBottom: 24,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        width: '80%',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'center',
    },
    actionButtonText: {
        marginLeft: 8,
        fontWeight: '700',
        fontSize: 14,
    },
    sectionContainer: {
        paddingHorizontal: 24,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 12,
        opacity: 0.7,
    },
    card: {
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardHeader: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
    },
    jobTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    companyName: {
        fontSize: 14,
        fontWeight: '500',
    },
    iconButton: {
        padding: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    cardContent: {
        padding: 20,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -8,
    },
    gridItem: {
        width: '50%',
        paddingHorizontal: 8,
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    detailIconContainer: {
        marginTop: 2,
        marginRight: 10,
    },
    detailLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 2,
        opacity: 0.7,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '700',
    },
    emptyCard: {
        padding: 32,
        alignItems: 'center',
        borderRadius: 24,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    emptyIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 8,
    },
    emptyDesc: {
        textAlign: 'center',
        fontSize: 14,
        marginBottom: 24,
        opacity: 0.7,
    },
    primaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 100,
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        padding: 24,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 24,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    optionText: {
        marginLeft: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 10,
    },
});