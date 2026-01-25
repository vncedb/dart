import {
    Briefcase01Icon,
    Building03Icon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    Delete02Icon,
    DollarCircleIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    Tick02Icon,
    WifiOffIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
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
    employment_status: string;
    rate: number;
    rate_type: string;
    work_schedule: any;
    current_job_id?: string;
};

// --- HELPER COMPONENTS ---

const EmptyState = ({ isOffline, onAdd }: { isOffline: boolean; onAdd: () => void }) => {
    const theme = useAppTheme();
    return (
        <View className="items-center justify-center flex-1 px-8 pt-10">
            <View 
                style={{ backgroundColor: isOffline ? theme.colors.warning + '20' : theme.colors.card }}
                className="items-center justify-center w-24 h-24 mb-6 rounded-3xl"
            >
                <HugeiconsIcon 
                    icon={isOffline ? WifiOffIcon : Briefcase01Icon} 
                    size={48} 
                    color={isOffline ? theme.colors.warning : theme.colors.primary} 
                />
            </View>
            <Text style={{ color: theme.colors.text }} className="mb-3 text-2xl font-bold text-center">
                {isOffline ? 'Offline Mode' : 'No Jobs Found'}
            </Text>
            <Text style={{ color: theme.colors.textSecondary }} className="mb-8 text-base leading-6 text-center">
                {isOffline 
                    ? 'You can view locally saved jobs. Connect to internet to sync changes.' 
                    : 'Add a job position to start tracking your attendance and earnings.'}
            </Text>
            {!isOffline && (
                <TouchableOpacity 
                    onPress={onAdd} 
                    style={{ backgroundColor: theme.colors.primary }}
                    className="flex-row items-center px-8 py-4 rounded-full shadow-lg"
                >
                    <HugeiconsIcon icon={PlusSignIcon} size={20} color="#FFF" strokeWidth={3} />
                    <Text className="ml-2 text-base font-bold text-white">Add Your First Job</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const JobCard = ({ 
    item, 
    isActive, 
    onSetActive, 
    onEdit, 
    onDelete, 
    theme 
}: { 
    item: JobPosition, 
    isActive: boolean, 
    onSetActive: (id: string) => void,
    onEdit: (id: string) => void,
    onDelete: (id: string) => void,
    theme: any 
}) => {
    // Formatting Helpers
    const formatRate = (rate: number, type: string) => {
        if (!rate) return 'Not set';
        const amount = rate.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
        const unit = type === 'daily' ? 'day' : type === 'monthly' ? 'month' : 'hour';
        return `${amount} / ${unit}`;
    };

    const formatTime = (timeStr: string) => {
        if (!timeStr) return '--:--';
        const [h, m] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(h || '0'), parseInt(m || '0'));
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const schedule = typeof item.work_schedule === 'string' 
        ? JSON.parse(item.work_schedule) 
        : (item.work_schedule || { start: '09:00', end: '17:00' });

    return (
        <View 
            style={{ 
                backgroundColor: theme.colors.card, 
                borderColor: isActive ? theme.colors.primary : theme.colors.border,
                borderWidth: isActive ? 2 : 1
            }} 
            className="p-5 mb-5 shadow-sm rounded-3xl"
        >
            {/* Header */}
            <View className="flex-row justify-between mb-4">
                <View className="flex-1 mr-4">
                    <Text style={{ color: theme.colors.text }} className="text-xl font-extrabold" numberOfLines={1}>
                        {item.title}
                    </Text>
                    <View className="flex-row items-center mt-1">
                        <HugeiconsIcon icon={Building03Icon} size={16} color={theme.colors.textSecondary} />
                        <Text style={{ color: theme.colors.textSecondary }} className="ml-1.5 text-sm font-medium" numberOfLines={1}>
                            {item.company || 'Unknown Company'}
                        </Text>
                    </View>
                </View>
                <View className="items-end gap-2">
                    <View style={{ backgroundColor: theme.colors.primary + '15' }} className="px-2.5 py-1.5 rounded-xl">
                        <Text style={{ color: theme.colors.primary }} className="text-[10px] font-extrabold uppercase">
                            {item.employment_status || 'Regular'}
                        </Text>
                    </View>
                    {isActive && (
                        <View style={{ backgroundColor: theme.colors.success + '20' }} className="flex-row items-center px-2 py-1 rounded-lg">
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color={theme.colors.success} />
                            <Text style={{ color: theme.colors.success }} className="text-[10px] font-extrabold ml-1">ACTIVE</Text>
                        </View>
                    )}
                </View>
            </View>
            
            <View style={{ height: 1, backgroundColor: theme.colors.border }} className="w-full mb-4 opacity-50" />
            
            {/* Details */}
            <View className="gap-y-3">
                <View>
                    <Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Pay Rate</Text>
                    <View className="flex-row items-center">
                        <HugeiconsIcon icon={DollarCircleIcon} size={16} color={theme.colors.success} />
                        <Text style={{ color: theme.colors.text }} className="ml-2 text-sm font-bold">
                            {formatRate(item.rate, item.rate_type)}
                        </Text>
                    </View>
                </View>
                <View>
                    <Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Schedule</Text>
                    <View style={{ backgroundColor: theme.colors.background }} className="flex-row items-center p-3 rounded-xl">
                        <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.primary} />
                        <Text style={{ color: theme.colors.text }} className="ml-3 text-sm font-bold">
                            {formatTime(schedule.start)}  —  {formatTime(schedule.end)}
                        </Text>
                    </View>
                </View>
            </View>
            
            {/* Actions */}
            <View className="flex-row gap-3 mt-5">
                {!isActive && (
                    <TouchableOpacity 
                        onPress={() => onSetActive(item.id)}
                        style={{ backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }} 
                        className="flex-row items-center justify-center flex-1 py-3 border rounded-xl"
                    >
                        <HugeiconsIcon icon={Tick02Icon} size={16} color={theme.colors.primary} />
                        <Text style={{ color: theme.colors.primary }} className="ml-2 font-bold">Set Active</Text>
                    </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                    onPress={() => onEdit(item.id)}
                    style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }} 
                    className="flex-row items-center justify-center flex-1 py-3 border rounded-xl"
                >
                    <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                    <Text style={{ color: theme.colors.text }} className="ml-2 font-bold">Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    onPress={() => onDelete(item.id)}
                    style={{ backgroundColor: '#fee2e2' }} 
                    className="items-center justify-center px-4 py-3 rounded-xl"
                >
                    <HugeiconsIcon icon={Delete02Icon} size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
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

    // --- DATA FETCHING ---
    const fetchJobs = useCallback(async () => {
        try {
            // 1. Get Session
            const { data: { session } } = await supabase.auth.getSession();
            
            // CRITICAL FIX: Ensure valid string ID. 
            // If session.user.id is undefined, we use an empty string or return early.
            const rawUserId = session?.user?.id;
            
            if (!rawUserId) {
                console.log("No User ID found, skipping fetch.");
                setLoading(false);
                return;
            }

            const userId = String(rawUserId); // Double ensure it's a string

            const db = await getDB();
            if (!db) throw new Error("Database not ready");

            // 2. Fetch Jobs (Safe Param Check)
            // Explicitly verify userId is not null/undefined before passing to DB
            const localJobs = await db.getAllAsync(
                'SELECT * FROM job_positions WHERE user_id = ? ORDER BY created_at DESC', 
                [userId]
            );

            // 3. Fetch Active Profile
            const profile: any = await db.getFirstAsync(
                'SELECT current_job_id FROM profiles WHERE id = ?', 
                [userId]
            );

            const currentId = profile?.current_job_id;
            setActiveJobId(currentId || null);

            // 4. Sort: Active Job First
            let parsedJobs = (localJobs as JobPosition[]);
            if (currentId) {
                parsedJobs = parsedJobs.sort((a, b) => {
                    return a.id === currentId ? -1 : b.id === currentId ? 1 : 0;
                });
            }

            setJobs(parsedJobs);

            // 5. Check Network
            const netInfo = await NetInfo.fetch();
            setIsOffline(!netInfo.isConnected);

        } catch (error) {
            console.error('Fetch Jobs Error:', error);
            // Don't alert loop on error, just log
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        setLoading(true);
        fetchJobs();
    }, [fetchJobs]));

    const handleRefresh = async () => {
        setRefreshing(true);
        await triggerSync();
        await fetchJobs();
        setRefreshing(false);
    };

    // --- ACTIONS ---

    const handleSetActive = async (jobId: string) => {
        setLoadingMessage('Updating active job...');
        setProcessing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const rawUserId = session?.user?.id;
            if (!rawUserId) return;
            const userId = String(rawUserId);
            
            const db = await getDB();
            
            // Local DB Update
            await db.runAsync('UPDATE profiles SET current_job_id = ? WHERE id = ?', [jobId, userId]);
            
            // Queue Sync
            const updates = { id: userId, current_job_id: jobId, updated_at: new Date().toISOString() };
            await queueSyncItem('profiles', userId, 'UPDATE', updates);
            
            // UI Update
            setActiveJobId(jobId);
            setJobs(prev => [...prev].sort((a, b) => a.id === jobId ? -1 : b.id === jobId ? 1 : 0));
            
            triggerSync();
        } catch (e) {
            Alert.alert("Error", "Failed to update active job.");
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (jobId: string) => {
        Alert.alert(
            "Delete Job?", 
            "This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: async () => {
                        setLoadingMessage('Deleting...');
                        setProcessing(true);
                        try {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session?.user?.id) return;

                            // If deleting active job, clear profile reference first
                            if (activeJobId === jobId) {
                                const db = await getDB();
                                await db.runAsync('UPDATE profiles SET current_job_id = NULL WHERE id = ?', [session.user.id]);
                                await queueSyncItem('profiles', session.user.id, 'UPDATE', { current_job_id: null });
                                setActiveJobId(null);
                            }

                            await deleteJobLocal(jobId);
                            triggerSync();
                            fetchJobs();
                        } catch(e) {
                            Alert.alert("Error", "Could not delete job.");
                        } finally {
                            setProcessing(false);
                        }
                    } 
                }
            ]
        );
    };

    // --- RENDER ---

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <LoadingOverlay visible={processing} message={loadingMessage} />
            
            <Header 
                title="My Jobs" 
                rightElement={
                    !isOffline ? (
                        <TouchableOpacity 
                            onPress={() => router.push('/job/form')} 
                            style={{ backgroundColor: theme.colors.primaryLight, padding: 8, borderRadius: 20 }}
                        >
                            <HugeiconsIcon icon={PlusSignIcon} size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                    ) : null
                } 
            />
            
            {loading ? (
                <View className="items-center justify-center flex-1">
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList 
                    data={jobs} 
                    keyExtractor={(item) => item.id} 
                    contentContainerStyle={{ padding: 24, paddingBottom: 100, flexGrow: 1 }} 
                    showsVerticalScrollIndicator={false} 
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
                    }
                    ListEmptyComponent={<EmptyState isOffline={isOffline} onAdd={() => router.push('/job/form')} />}
                    renderItem={({ item }) => (
                        <JobCard 
                            item={item} 
                            isActive={item.id === activeJobId}
                            onSetActive={handleSetActive}
                            onEdit={(id) => router.push({ pathname: '/job/form', params: { id } })}
                            onDelete={handleDelete}
                            theme={theme}
                        />
                    )}
                />
            )}
        </SafeAreaView>
    );
}