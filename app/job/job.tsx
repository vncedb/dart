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
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { deleteJobLocal, queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

const formatRateDisplay = (amount: number, type: string) => {
    const formattedAmount = amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    let unit = 'hour';
    if (type === 'daily') unit = 'day';
    if (type === 'monthly') unit = 'month';
    return `${formattedAmount} / ${unit}`;
};

const formatTime12h = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

const EmptyJobCard = ({ theme, router, isOffline }: any) => {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
            <View style={{ width: 100, height: 100, borderRadius: 30, backgroundColor: isOffline ? theme.colors.warning + '20' : theme.colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <HugeiconsIcon icon={isOffline ? WifiOffIcon : Briefcase01Icon} size={48} color={isOffline ? theme.colors.warning : theme.colors.primary} />
            </View>
            <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
                {isOffline ? 'Offline Mode' : 'No Jobs Found'}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
                {isOffline ? 'You can view locally saved jobs. Connect to internet to sync changes.' : 'Add a job to start tracking your attendance.'}
            </Text>
            {!isOffline && (
                <TouchableOpacity onPress={() => router.push('/job/form')} style={{ backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 100 }}>
                    <HugeiconsIcon icon={PlusSignIcon} size={20} color="#FFF" strokeWidth={3} />
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }}>Add First Job</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

export default function MyJobsScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { triggerSync } = useSync();
    
    const [jobs, setJobs] = useState<any[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    const [processing, setProcessing] = useState(false); 
    const [loadingMessage, setLoadingMessage] = useState('');
    
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [isOffline, setIsOffline] = useState(false);

    const fetchJobs = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const db = await getDB();

            // 1. Fetch Local Jobs
            const localJobs = await db.getAllAsync('SELECT * FROM job_positions WHERE user_id = ? ORDER BY created_at DESC', [user.id]);
            let parsedLocalJobs = (localJobs as any[]).map(j => ({
                ...j,
                work_schedule: typeof j.work_schedule === 'string' ? JSON.parse(j.work_schedule) : j.work_schedule,
                break_schedule: typeof j.break_schedule === 'string' ? JSON.parse(j.break_schedule) : j.break_schedule
            }));

            // 2. Fetch Active Job ID from Profile
            const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);
            const currentId = profile?.current_job_id;
            
            if (currentId) {
                setActiveJobId(currentId);
                // 3. SORT: Move Active Job to the top
                parsedLocalJobs = parsedLocalJobs.sort((a, b) => {
                    if (a.id === currentId) return -1;
                    if (b.id === currentId) return 1;
                    return 0; 
                });
            } else {
                setActiveJobId(null);
            }

            setJobs(parsedLocalJobs);

            const netInfo = await NetInfo.fetch();
            setIsOffline(!netInfo.isConnected);
            
        } catch (error) { 
            console.log('Error fetching jobs:', error); 
        } finally { 
            setLoading(false); 
        }
    };

    useFocusEffect(useCallback(() => { fetchJobs(); }, []));

    const handleSetActive = async (jobId: string) => {
        setLoadingMessage('Updating profile...');
        setProcessing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const db = await getDB();
            
            await db.runAsync('UPDATE profiles SET current_job_id = ? WHERE id = ?', [jobId, user.id]);
            
            const updates = { id: user.id, current_job_id: jobId, updated_at: new Date().toISOString() };
            await queueSyncItem('profiles', user.id, 'UPDATE', updates);
            
            setActiveJobId(jobId);
            
            // Re-sort locally immediately for instant feedback
            setJobs(prevJobs => {
                const sorted = [...prevJobs].sort((a, b) => {
                    if (a.id === jobId) return -1;
                    if (b.id === jobId) return 1;
                    return 0; 
                });
                return sorted;
            });

            triggerSync();
            
        } catch (e) {
            console.log("Error setting active job:", e);
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Could not update active job.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete Job?', message: 'This will permanently remove this job position.', confirmText: 'Delete', cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setLoadingMessage('Deleting job...');
                setProcessing(true);
                try {
                    const db = await getDB();
                    const { data: { user } } = await supabase.auth.getUser();
                    if(!user) return;

                    if (activeJobId === id) {
                        await db.runAsync('UPDATE profiles SET current_job_id = NULL WHERE id = ?', [user.id]);
                        await queueSyncItem('profiles', user.id, 'UPDATE', { current_job_id: null });
                        setActiveJobId(null);
                    }

                    await deleteJobLocal(id);
                    await queueSyncItem('job_positions', id, 'DELETE');
                    
                    triggerSync();
                    await fetchJobs();

                } catch (e) { 
                    console.log('Delete error:', e); 
                } finally { 
                    setProcessing(false); 
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
        });
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await triggerSync();
        await fetchJobs();
        setRefreshing(false);
    };

    const renderJobItem = ({ item }: any) => {
        const isActive = item.id === activeJobId;
        const isSalarySet = item.rate && item.rate > 0;
        const workSchedule = item.work_schedule || { start: '09:00', end: '17:00' };

        return (
            <View 
                style={{ 
                    backgroundColor: theme.colors.card, 
                    borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    borderWidth: isActive ? 2 : 1
                }} 
                className="p-5 mb-5 shadow-sm rounded-3xl"
            >
                {/* Header Section */}
                <View className="flex-row justify-between mb-4">
                    {/* Left: Title & Company */}
                    <View className="flex-1 mr-4">
                        <Text style={{ color: theme.colors.text }} className="text-xl font-extrabold" numberOfLines={1}>{item.title}</Text>
                        <View className="flex-row items-center mt-1">
                            <HugeiconsIcon icon={Building03Icon} size={16} color={theme.colors.textSecondary} />
                            <Text style={{ color: theme.colors.textSecondary }} className="ml-1.5 text-sm font-medium" numberOfLines={2}>{item.company || 'Unknown Company'}</Text>
                        </View>
                    </View>

                    {/* Right: Status Indicators (Swapped Order) */}
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={{ backgroundColor: theme.colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
                            <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{item.employment_status || 'Regular'}</Text>
                        </View>
                        {isActive && (
                            <View style={{ backgroundColor: theme.colors.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} color={theme.colors.success} />
                                <Text style={{ color: theme.colors.success, fontSize: 10, fontWeight: '800', marginLeft: 4 }}>ACTIVE</Text>
                            </View>
                        )}
                    </View>
                </View>
                
                <View style={{ height: 1, backgroundColor: theme.colors.border }} className="w-full mb-4 opacity-50" />
                
                <View className="gap-y-4">
                    <View><Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Pay Rate</Text><View className="flex-row items-center"><HugeiconsIcon icon={DollarCircleIcon} size={16} color={theme.colors.success} /><Text style={{ color: theme.colors.text }} className="ml-2 text-sm font-bold">{isSalarySet ? formatRateDisplay(item.rate, item.rate_type || 'hourly') : 'Not set'}</Text></View></View>
                    <View><Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Shift Schedule</Text><View className="flex-row items-center p-3 rounded-xl" style={{ backgroundColor: theme.colors.background }}><HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.primary} /><Text style={{ color: theme.colors.text }} className="ml-3 text-sm font-bold">{formatTime12h(workSchedule.start)}  —  {formatTime12h(workSchedule.end)}</Text></View></View>
                </View>
                
                <View className="flex-row gap-3 mt-5">
                    {!isActive && (
                        <TouchableOpacity onPress={() => handleSetActive(item.id)} style={{ backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }} className="flex-row items-center justify-center flex-1 py-3 border rounded-xl active:opacity-70">
                            <HugeiconsIcon icon={Tick02Icon} size={16} color={theme.colors.primary} />
                            <Text style={{ color: theme.colors.primary }} className="ml-2 font-bold">Set Active</Text>
                        </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity onPress={() => router.push({ pathname: '/job/form', params: { id: item.id } })} style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }} className="flex-row items-center justify-center flex-1 py-3 border rounded-xl active:opacity-70">
                        <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                        <Text style={{ color: theme.colors.text }} className="ml-2 font-bold">Edit</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ backgroundColor: '#fee2e2' }} className="items-center justify-center px-4 py-3 rounded-xl active:opacity-70">
                        <HugeiconsIcon icon={Delete02Icon} size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <LoadingOverlay visible={processing} message={loadingMessage} />
            <ModernAlert {...alertConfig} />
            <Header title="My Jobs" rightElement={!isOffline ? (<TouchableOpacity onPress={() => router.push('/job/form')} style={{ backgroundColor: theme.colors.primaryLight, padding: 8, borderRadius: 20 }}><HugeiconsIcon icon={PlusSignIcon} size={24} color={theme.colors.primary} /></TouchableOpacity>) : null} />
            
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList 
                    data={jobs} 
                    keyExtractor={(item) => item.id} 
                    renderItem={renderJobItem} 
                    contentContainerStyle={{ padding: 24, paddingBottom: 100, flexGrow: 1 }} 
                    showsVerticalScrollIndicator={false} 
                    ListEmptyComponent={<EmptyJobCard theme={theme} router={router} isOffline={isOffline} />} 
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing} 
                            onRefresh={handleRefresh} 
                            tintColor={theme.colors.primary} 
                        />
                    } 
                />
            )}
        </SafeAreaView>
    );
}