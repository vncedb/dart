import {
    Briefcase01Icon,
    Building03Icon,
    Calendar03Icon,
    Clock01Icon,
    Coffee01Icon,
    Delete02Icon,
    DollarCircleIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    UserGroupIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

const formatRateDisplay = (amount: number, type: string) => {
    const formattedAmount = amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });
    let unit = 'hour';
    if (type === 'daily') unit = 'day';
    if (type === 'monthly') unit = 'month';
    const unitDisplay = `${unit}/s`; 
    return `${formattedAmount} / ${unitDisplay}`;
};

const formatTime12h = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const date = new Date();
    date.setHours(parseInt(h), parseInt(m));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

const EmptyJobCard = ({ theme, router }: any) => {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
            <View style={{ width: 100, height: 100, borderRadius: 30, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }}>
                <HugeiconsIcon icon={Briefcase01Icon} size={48} color={theme.colors.primary} />
            </View>
            <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
                No Jobs Found
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32 }}>
                You haven't added any work profiles yet. Add a job to start tracking your attendance and earnings.
            </Text>
            
            <TouchableOpacity 
                onPress={() => router.push('/job/form')} 
                style={{ backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 100, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 }}
            >
                <HugeiconsIcon icon={PlusSignIcon} size={20} color="#FFF" strokeWidth={3} />
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }}>Add First Job</Text>
            </TouchableOpacity>
        </View>
    );
};

export default function MyJobsScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deleting, setDeleting] = useState(false); // New state for overlay
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const fetchJobs = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('job_positions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setJobs(data || []);
        } catch (error) {
            console.log('Error fetching jobs:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchJobs();
        }, [])
    );

    const handleDelete = (id: string) => {
        setAlertConfig({
            visible: true,
            type: 'warning',
            title: 'Delete Job?',
            message: 'This will permanently remove this job position and its settings.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setDeleting(true);
                try {
                    await supabase.from('job_positions').delete().eq('id', id);
                    const db = await getDB();
                    await db.runAsync('DELETE FROM sync_queue WHERE row_id = ?', [id]);
                    fetchJobs(); 
                } catch (e) {
                    console.log('Delete error:', e);
                } finally {
                    setDeleting(false);
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
        });
    };

    const renderJobItem = ({ item }: any) => {
        const isSalarySet = item.rate && item.rate > 0;
        const workSchedule = item.work_schedule || { start: '09:00', end: '17:00' };
        const breaks = item.break_schedule || [];

        return (
            <View 
                style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} 
                className="p-5 mb-5 border shadow-sm rounded-3xl"
            >
                <View className="flex-row justify-between mb-4">
                    <View className="flex-1 mr-4">
                        <Text style={{ color: theme.colors.text }} className="text-xl font-extrabold" numberOfLines={1}>
                            {item.title}
                        </Text>
                        <View className="flex-row items-center mt-1">
                            <HugeiconsIcon icon={Building03Icon} size={16} color={theme.colors.textSecondary} />
                            <Text 
                                style={{ color: theme.colors.textSecondary }} 
                                className="ml-1.5 text-sm font-medium"
                                numberOfLines={2} 
                                ellipsizeMode="tail"
                            >
                                {item.company || 'Unknown Company'}
                            </Text>
                        </View>
                    </View>
                    
                    <View style={{ backgroundColor: theme.colors.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' }}>
                        <Text style={{ color: theme.colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                            {item.employment_status || 'Regular'}
                        </Text>
                    </View>
                </View>

                <View style={{ height: 1, backgroundColor: theme.colors.border }} className="w-full mb-4 opacity-50" />

                <View className="gap-y-4">
                    {item.department && (
                        <View>
                            <Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Department</Text>
                            <View className="flex-row items-center">
                                <HugeiconsIcon icon={UserGroupIcon} size={16} color={theme.colors.text} />
                                <Text style={{ color: theme.colors.text }} className="ml-2 text-sm font-bold">{item.department}</Text>
                            </View>
                        </View>
                    )}

                    <View>
                        <Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Pay Rate</Text>
                        <View className="flex-row items-center">
                            <HugeiconsIcon icon={DollarCircleIcon} size={16} color={theme.colors.success} />
                            <Text style={{ color: theme.colors.text }} className="ml-2 text-sm font-bold">
                                {isSalarySet ? formatRateDisplay(item.rate, item.rate_type || 'hourly') : 'Not set'}
                            </Text>
                        </View>
                    </View>

                    <View>
                        <Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Payroll Schedule</Text>
                        <View className="flex-row items-center">
                            <HugeiconsIcon icon={Calendar03Icon} size={16} color={theme.colors.primary} />
                            <Text style={{ color: theme.colors.text }} className="ml-2 text-sm font-bold" style={{ textTransform: 'capitalize' }}>
                                {item.cutoff_config?.type?.replace('-', ' ') || 'Semi Monthly'}
                            </Text>
                        </View>
                    </View>

                    <View>
                        <Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Shift Schedule</Text>
                        <View className="flex-row items-center p-3 rounded-xl" style={{ backgroundColor: theme.colors.background }}>
                            <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.primary} />
                            <Text style={{ color: theme.colors.text }} className="ml-3 text-sm font-bold">
                                {formatTime12h(workSchedule.start)}  —  {formatTime12h(workSchedule.end)}
                            </Text>
                        </View>
                    </View>

                    {breaks.length > 0 && (
                        <View>
                            <Text style={{ color: theme.colors.textSecondary }} className="mb-1 text-xs font-bold uppercase">Unpaid Breaks</Text>
                            <View style={{ gap: 8 }}>
                                {breaks.map((brk: any, i: number) => (
                                    <View key={i} className="flex-row items-center p-2.5 rounded-lg border" style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}>
                                        <HugeiconsIcon icon={Coffee01Icon} size={16} color={theme.colors.textSecondary} />
                                        <View className="flex-1 ml-3">
                                            <Text style={{ color: theme.colors.text, fontSize: 13, fontWeight: '600' }}>
                                                {brk.title || `Break ${i + 1}`}
                                            </Text>
                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                                                {formatTime12h(brk.start)} - {formatTime12h(brk.end)}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                <View className="flex-row gap-3 mt-5">
                    <TouchableOpacity 
                        onPress={() => router.push({ pathname: '/job/form', params: { id: item.id } })}
                        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }} 
                        className="flex-row items-center justify-center flex-1 py-3 border rounded-xl active:opacity-70"
                    >
                        <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                        <Text style={{ color: theme.colors.text }} className="ml-2 font-bold">Edit</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={() => handleDelete(item.id)}
                        style={{ backgroundColor: '#fee2e2' }} 
                        className="flex-row items-center justify-center flex-1 py-3 rounded-xl active:opacity-70"
                    >
                        <HugeiconsIcon icon={Delete02Icon} size={16} color="#ef4444" />
                        <Text style={{ color: '#ef4444' }} className="ml-2 font-bold">Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
                <Header title="My Jobs" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <LoadingOverlay visible={deleting} message="Deleting job..." />
            <ModernAlert {...alertConfig} />

            <Header 
                title="My Jobs" 
                rightElement={
                    jobs.length > 0 ? (
                        <TouchableOpacity 
                            onPress={() => router.push('/job/form')} 
                            style={{ backgroundColor: theme.colors.primaryLight, padding: 8, borderRadius: 20 }}
                        >
                            <HugeiconsIcon icon={PlusSignIcon} size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                    ) : null
                } 
            />

            <FlatList
                data={jobs}
                keyExtractor={(item) => item.id}
                renderItem={renderJobItem}
                contentContainerStyle={{ padding: 24, paddingBottom: 100, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={<EmptyJobCard theme={theme} router={router} />}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={theme.colors.primary} />
                }
            />
        </SafeAreaView>
    );
}