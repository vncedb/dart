import {
    ArrowDown01Icon,
    Briefcase01Icon,
    Building03Icon,
    Calendar03Icon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    Delete02Icon,
    DollarCircleIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    UserGroupIcon,
    UserIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnalogTimePicker from '../../components/AnalogTimePicker';
import CalendarPickerModal from '../../components/CalendarPickerModal';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import SearchableSelectionModal from '../../components/SearchableSelectionModal';

import { JOBS_LIST } from '../../constants/Jobs';
import { useAppTheme } from '../../constants/theme';
import { generateUUID, queueSyncItem, saveJobLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

// Helper Functions
const formatCurrency = (val: string) => {
    const numericValue = val.replace(/[^0-9.]/g, '');
    if (!numericValue) return '';
    const parts = numericValue.split('.');
    if (parts[1] && parts[1].length > 2) parts[1] = parts[1].substring(0, 2);
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `₱ ${parts.join('.')}`;
};
const parseCurrency = (val: string) => parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
const formatTime12h = (date: Date | null) => {
    if (!date) return 'Set Time';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};
const parseTimeStringToDate = (timeStr: string, baseDate: Date = new Date()) => {
    if (!timeStr) return baseDate;
    const [h, m] = timeStr.split(':').map(Number);
    const newDate = new Date(baseDate);
    newDate.setHours(h || 0);
    newDate.setMinutes(m || 0);
    newDate.setSeconds(0);
    return newDate;
};

const EMPLOYMENT_STATUS_OPTIONS = [
    { label: 'Regular / Full-Time', value: 'Regular' },
    { label: 'Probationary', value: 'Probationary' },
    { label: 'Contractual', value: 'Contractual' },
    { label: 'Part-Time', value: 'Part-Time' },
    { label: 'Project-Based', value: 'Project-Based' },
    { label: 'Intern / OJT', value: 'Intern' },
];

export default function JobForm() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const params = useLocalSearchParams();
    const jobId = params.id as string;

    const [saving, setSaving] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    
    // Form fields
    const [position, setPosition] = useState('');
    const [company, setCompany] = useState('');
    const [department, setDepartment] = useState('');
    const [employmentStatus, setEmploymentStatus] = useState('Regular');
    const [salaryDisplay, setSalaryDisplay] = useState('');
    const [rateType, setRateType] = useState<'hourly' | 'daily' | 'monthly'>('hourly');
    const [startDate, setStartDate] = useState(new Date());
    const [cutoffType, setCutoffType] = useState<'semi-monthly' | 'monthly' | 'weekly'>('semi-monthly');
    const [workStart, setWorkStart] = useState<Date>(() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; });
    const [workEnd, setWorkEnd] = useState<Date>(() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d; });
    const [breaks, setBreaks] = useState<{ id: string, start: Date, end: Date, title?: string }[]>([]);
    
    // UI state
    const [pickerVisible, setPickerVisible] = useState(false);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [jobSelectorVisible, setJobSelectorVisible] = useState(false);
    const [statusSelectorVisible, setStatusSelectorVisible] = useState(false);
    const [pickerConfig, setPickerConfig] = useState<{ mode: string, breakId?: string, currentValue?: Date }>({ mode: 'workStart' });
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const [tempBreak, setTempBreak] = useState<{ start: Date, end: Date } | null>(null);
    const [breakTitleModalVisible, setBreakTitleModalVisible] = useState(false);
    const [newBreakTitle, setNewBreakTitle] = useState('');
    const [editingBreakId, setEditingBreakId] = useState<string | null>(null); 

    const markDirty = (setter: any, val: any) => { setter(val); setIsDirty(true); };
    const handleSalaryChange = (text: string) => { 
        const formatted = formatCurrency(text); 
        setSalaryDisplay(formatted); 
        setIsDirty(true); 
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (!isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'confirm', title: 'Discard Changes?', message: 'Unsaved changes will be lost.', confirmText: 'Discard', cancelText: "Keep Editing",
                onConfirm: () => { setAlertConfig((prev:any) => ({ ...prev, visible: false })); navigation.dispatch(e.data.action); },
                onCancel: () => setAlertConfig((prev:any) => ({ ...prev, visible: false }))
            });
        });
        return unsubscribe;
    }, [navigation, isDirty]);

    useEffect(() => { fetchJobData(); }, []);

    const fetchJobData = async () => {
        if (!jobId) { setInitialLoading(false); return; }
        try {
            const db = await getDB();
            // Try local first
            const localJob = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [jobId]);
            let data: any = localJob;

            if (!localJob) {
                const { data: remoteData } = await supabase.from('job_positions').select('*').eq('id', jobId).single();
                data = remoteData;
            }

            if (data) {
                const workSched = typeof data.work_schedule === 'string' ? JSON.parse(data.work_schedule) : data.work_schedule;
                const breakSched = typeof data.break_schedule === 'string' ? JSON.parse(data.break_schedule) : data.break_schedule;

                setPosition(data.title);
                setCompany(data.company || '');
                setDepartment(data.department || '');
                setEmploymentStatus(data.employment_status || 'Regular');
                setSalaryDisplay(data.rate ? formatCurrency(data.rate.toString()) : '');
                setRateType(data.rate_type || 'hourly');
                if (data.start_date) setStartDate(new Date(data.start_date));
                if (data.cutoff_config && data.cutoff_config.type) setCutoffType(data.cutoff_config.type);
                
                if (workSched) {
                    setWorkStart(parseTimeStringToDate(workSched.start));
                    setWorkEnd(parseTimeStringToDate(workSched.end));
                }
                if (breakSched && Array.isArray(breakSched)) {
                    setBreaks(breakSched.map((b: any, index: number) => ({
                        id: Date.now().toString() + index,
                        start: parseTimeStringToDate(b.start),
                        end: parseTimeStringToDate(b.end),
                        title: b.title || ''
                    })));
                }
            }
        } catch (error) { console.log('Error fetching job:', error); } 
        finally { setInitialLoading(false); setTimeout(() => setIsDirty(false), 100); }
    };

    // ... Helper functions for picker ...
    const openPicker = (mode: string, breakId?: string) => {
        let currentValue = new Date();
        if (mode === 'workStart') currentValue = workStart;
        else if (mode === 'workEnd') currentValue = workEnd;
        else if (mode === 'newBreakStart') currentValue = new Date(new Date().setHours(12, 0, 0, 0));
        else if (mode === 'newBreakEnd') currentValue = tempBreak?.start || new Date(new Date().setHours(13, 0, 0, 0));
        else if (breakId) {
            const b = breaks.find(i => i.id === breakId);
            if (b) currentValue = mode === 'breakStart' ? b.start : b.end;
        }
        setPickerConfig({ mode, breakId, currentValue });
        setPickerVisible(true);
    };

    const handleTimeSelect = (timeStr: string) => {
        const newDate = parseTimeStringToDate(timeStr, pickerConfig.currentValue || new Date());
        setIsDirty(true);
        if (pickerConfig.mode === 'workStart') setWorkStart(newDate);
        else if (pickerConfig.mode === 'workEnd') setWorkEnd(newDate);
        else if (pickerConfig.mode === 'breakStart' && pickerConfig.breakId) {
            setBreaks(prev => prev.map(b => b.id === pickerConfig.breakId ? { ...b, start: newDate } : b));
        }
        else if (pickerConfig.mode === 'breakEnd' && pickerConfig.breakId) {
            setBreaks(prev => prev.map(b => b.id === pickerConfig.breakId ? { ...b, end: newDate } : b));
        }
        else if (pickerConfig.mode === 'newBreakStart') {
            setTempBreak({ start: newDate, end: newDate }); 
            setTimeout(() => { openPicker('newBreakEnd'); }, 400);
        }
        else if (pickerConfig.mode === 'newBreakEnd') {
            setTempBreak(prev => prev ? { ...prev, end: newDate } : { start: newDate, end: newDate });
            setNewBreakTitle(''); 
            setEditingBreakId(null); 
            setTimeout(() => { setBreakTitleModalVisible(true); }, 400);
        }
    };
    
    const startAddBreak = () => { openPicker('newBreakStart'); };
    const openEditBreakTitle = (breakId: string, currentTitle: string) => { setEditingBreakId(breakId); setNewBreakTitle(currentTitle || ''); setBreakTitleModalVisible(true); };
    const saveBreakTitle = () => {
        if (editingBreakId) { setBreaks(prev => prev.map(b => b.id === editingBreakId ? { ...b, title: newBreakTitle.trim() } : b)); setIsDirty(true); } 
        else if (tempBreak) { setBreaks([...breaks, { id: generateUUID(), start: tempBreak.start, end: tempBreak.end, title: newBreakTitle.trim() || undefined }]); setIsDirty(true); }
        setBreakTitleModalVisible(false); setTempBreak(null); setEditingBreakId(null);
    };
    const removeBreak = (id: string) => { setBreaks(breaks.filter(b => b.id !== id)); setIsDirty(true); };
    const calculateDailyHours = () => {
        const getMins = (d: Date) => d.getHours() * 60 + d.getMinutes();
        let workMins = getMins(workEnd) - getMins(workStart);
        if (workMins < 0) workMins += 24 * 60;
        let breakMins = 0;
        breaks.forEach(b => { let bDur = getMins(b.end) - getMins(b.start); if (bDur < 0) bDur += 24 * 60; breakMins += bDur; });
        return Math.max(0, (workMins - breakMins) / 60);
    };
    const formatHoursDisplay = (hours: number) => { const displayVal = parseFloat(hours.toFixed(2)); return `${displayVal} ${displayVal === 1 ? 'hour' : 'hours'}`; };

    const handleSave = async () => {
        if (!position || !salaryDisplay || !company) {
            setAlertConfig({ visible: true, type: 'error', title: 'Missing Fields', message: 'Job Title, Company Name, and Pay Rate are required.', confirmText: 'Okay', onConfirm: () => setAlertConfig((prev:any) => ({ ...prev, visible: false })) });
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user found');
            const formatDBTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            const salaryValue = parseCurrency(salaryDisplay);
            
            const finalJobId = jobId || generateUUID();
            const now = new Date().toISOString();

            const payload = {
                id: finalJobId,
                user_id: user.id, 
                title: position,
                company: company, 
                department: department, 
                employment_status: employmentStatus, 
                rate: salaryValue, 
                salary: salaryValue, 
                rate_type: rateType, 
                start_date: startDate.toISOString().split('T')[0],
                work_schedule: { start: formatDBTime(workStart), end: formatDBTime(workEnd) },
                break_schedule: breaks.map(b => ({ start: formatDBTime(b.start), end: formatDBTime(b.end), title: b.title })),
                cutoff_config: { type: cutoffType },
                updated_at: now
            };

            if (!jobId) (payload as any).created_at = now;
            
            // 1. Save Local (Instant)
            await saveJobLocal(payload);

            // 2. Queue Sync
            await queueSyncItem('job_positions', finalJobId, jobId ? 'UPDATE' : 'INSERT', payload);
            
            // 3. Update Profile Link (If new)
            if (!jobId) {
                const db = await getDB();
                await db.runAsync('UPDATE profiles SET current_job_id = ? WHERE id = ?', [finalJobId, user.id]);
                await queueSyncItem('profiles', user.id, 'UPDATE', { current_job_id: finalJobId });
                supabase.from('profiles').update({ current_job_id: finalJobId }).eq('id', user.id).then();
            }

            supabase.from('job_positions').upsert(payload).then();

            setIsDirty(false);
            router.back();

        } catch (e: any) { 
            console.log(e); 
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message || 'Error saving job.', confirmText: 'Close', onConfirm: () => setAlertConfig((prev:any) => ({ ...prev, visible: false })) }); 
        } finally { 
            setSaving(false); 
        }
    };

    if (initialLoading) return <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
    
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <LoadingOverlay visible={saving} message="Saving Job..." />
            <ModernAlert {...alertConfig} />
            
            <AnalogTimePicker visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={handleTimeSelect} value={pickerConfig.currentValue} title={pickerConfig.mode.includes('Start') ? "Start Time" : "End Time"} />
            <SearchableSelectionModal visible={jobSelectorVisible} onClose={() => setJobSelectorVisible(false)} onSelect={(val) => markDirty(setPosition, val)} title="Select Job Title" options={JOBS_LIST} placeholder="Search job title..." />
            <SearchableSelectionModal visible={statusSelectorVisible} onClose={() => setStatusSelectorVisible(false)} onSelect={(val) => markDirty(setEmploymentStatus, val)} title="Employment Status" options={EMPLOYMENT_STATUS_OPTIONS} placeholder="Select Status" />
            <CalendarPickerModal visible={calendarVisible} onClose={() => setCalendarVisible(false)} onSelect={(date) => { markDirty(setStartDate, date); setCalendarVisible(false); }} selectedDate={startDate} />

            <Modal transparent={true} visible={breakTitleModalVisible} animationType="fade" onRequestClose={() => setBreakTitleModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ width: '85%', backgroundColor: theme.colors.card, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8, textAlign: 'center' }}>{editingBreakId ? 'Rename Break' : 'Break Title'}</Text>
                        <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 }}>
                            <TextInput placeholder="e.g. Lunch Break" placeholderTextColor={theme.colors.textSecondary} value={newBreakTitle} onChangeText={setNewBreakTitle} autoFocus maxLength={16} style={{ fontSize: 16, color: theme.colors.text }} />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <TouchableOpacity onPress={() => { setBreakTitleModalVisible(false); setTempBreak(null); setEditingBreakId(null); }} style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: theme.colors.background, alignItems: 'center' }}><Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={saveBreakTitle} style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Header title={jobId ? 'Edit Job' : 'Add New Job'} rightElement={<TouchableOpacity onPress={handleSave} style={{ padding: 8, borderRadius: 999, backgroundColor: theme.colors.primaryLight }}><HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color={theme.colors.primary} /></TouchableOpacity>} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    <View className="mb-8">
                        <Text style={{ color: theme.colors.textSecondary }} className="mb-4 text-xs font-bold tracking-wider uppercase">Job Information</Text>
                        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="p-6 border shadow-sm rounded-3xl">
                             <TouchableOpacity onPress={() => setJobSelectorVisible(true)} className="flex-row items-center mb-6"><HugeiconsIcon icon={Briefcase01Icon} size={22} color={theme.colors.primary} /><View className="flex-1 ml-4"><Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 2 }}>Job Title</Text><Text style={{ color: position ? theme.colors.text : theme.colors.textSecondary, fontWeight: position ? 'bold' : 'normal', fontSize: 16 }}>{position || 'Select Job Title'}</Text></View><HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} /></TouchableOpacity>
                             <View className="h-[1px] bg-slate-100 dark:bg-slate-800 mb-6" />
                             <View className="flex-row items-center mb-6"><HugeiconsIcon icon={Building03Icon} size={22} color={theme.colors.textSecondary} /><View className="flex-1 ml-4"><Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 2, textTransform: 'uppercase' }}>COMPANY/ORGANIZATION NAME</Text><TextInput placeholder="Enter Name" placeholderTextColor={theme.colors.textSecondary} value={company} onChangeText={(val) => markDirty(setCompany, val)} style={{ color: theme.colors.text, fontSize: 16, fontWeight: 'bold', padding: 0 }} /></View></View>
                             <View className="h-[1px] bg-slate-100 dark:bg-slate-800 mb-6" />
                             <View className="flex-row items-center mb-6"><HugeiconsIcon icon={UserGroupIcon} size={22} color={theme.colors.textSecondary} /><View className="flex-1 ml-4"><Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 2 }}>Department</Text><TextInput placeholder="Optional" placeholderTextColor={theme.colors.textSecondary} value={department} onChangeText={(val) => markDirty(setDepartment, val)} style={{ color: theme.colors.text, fontSize: 16, fontWeight: 'bold', padding: 0 }} /></View></View>
                             <View className="h-[1px] bg-slate-100 dark:bg-slate-800 mb-6" />
                             <TouchableOpacity onPress={() => setStatusSelectorVisible(true)} className="flex-row items-center mb-6"><HugeiconsIcon icon={UserIcon} size={22} color={theme.colors.textSecondary} /><View className="flex-1 ml-4"><Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 2 }}>Employment Status</Text><Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>{employmentStatus}</Text></View><HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} /></TouchableOpacity>
                             <View className="h-[1px] bg-slate-100 dark:bg-slate-800 mb-6" />
                             <TouchableOpacity onPress={() => setCalendarVisible(true)} className="flex-row items-center"><HugeiconsIcon icon={Calendar03Icon} size={22} color={theme.colors.primary} /><View className="flex-1 ml-4"><Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 2 }}>Date Started</Text><Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: 'bold' }}>{startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text></View><HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} /></TouchableOpacity>
                        </View>
                    </View>
                    <View className="mb-8">
                        <Text style={{ color: theme.colors.textSecondary }} className="mb-4 text-xs font-bold tracking-wider uppercase">Compensation</Text>
                        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="p-6 mb-4 border shadow-sm rounded-3xl">
                            <View className="flex-row items-center"><HugeiconsIcon icon={DollarCircleIcon} size={22} color={theme.colors.success} /><View className="flex-1 ml-4"><Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 2 }}>Pay Rate</Text><TextInput placeholder="₱ 0.00" placeholderTextColor={theme.colors.textSecondary} value={salaryDisplay} onChangeText={handleSalaryChange} keyboardType="numeric" style={{ color: theme.colors.text, fontSize: 16, fontWeight: 'bold', padding: 0 }} /></View></View>
                        </View>
                        <View style={{ flexDirection: 'row', backgroundColor: theme.colors.card, padding: 6, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border }}>{(['hourly', 'daily', 'monthly'] as const).map((type) => (<TouchableOpacity key={type} onPress={() => markDirty(setRateType, type)} style={{ flex: 1, paddingVertical: 12, borderRadius: 16, backgroundColor: rateType === type ? theme.colors.primary : 'transparent', alignItems: 'center' }}><Text style={{ color: rateType === type ? '#fff' : theme.colors.textSecondary, fontWeight: 'bold', fontSize: 14, textTransform: 'capitalize' }}>{type}</Text></TouchableOpacity>))}</View>
                    </View>
                    <View className="mb-8">
                        <Text style={{ color: theme.colors.textSecondary }} className="mb-4 text-xs font-bold tracking-wider uppercase">Shift Schedule</Text>
                        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="p-5 border shadow-sm rounded-3xl">
                            <View style={{ flexDirection: 'row', gap: 12 }}><TouchableOpacity onPress={() => openPicker('workStart')} style={{ flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}><View className="flex-row items-center justify-between mb-3"><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>START</Text><HugeiconsIcon icon={Clock01Icon} size={16} color={theme.colors.primary} /></View><Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>{formatTime12h(workStart)}</Text></TouchableOpacity><TouchableOpacity onPress={() => openPicker('workEnd')} style={{ flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}><View className="flex-row items-center justify-between mb-3"><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>END</Text><HugeiconsIcon icon={Clock01Icon} size={16} color={theme.colors.warning} /></View><Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>{formatTime12h(workEnd)}</Text></TouchableOpacity></View>
                            <View style={{ marginTop: 20, alignItems: 'center', backgroundColor: theme.colors.primary + '10', padding: 12, borderRadius: 12 }}><Text style={{ color: theme.colors.textSecondary }} className="text-sm font-medium">Total Daily Goal: <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{formatHoursDisplay(calculateDailyHours())}</Text></Text></View>
                        </View>
                    </View>
                    <View className="mb-8">
                        <View className="flex-row items-center justify-between mb-4"><Text style={{ color: theme.colors.textSecondary }} className="text-xs font-bold tracking-wider uppercase">Unpaid Breaks</Text><TouchableOpacity onPress={startAddBreak} style={{ flexDirection: 'row', alignItems: 'center' }}><HugeiconsIcon icon={PlusSignIcon} size={16} color={theme.colors.primary} /><Text style={{ color: theme.colors.primary }} className="ml-1 text-xs font-bold">Add Break</Text></TouchableOpacity></View>
                        {breaks.length === 0 ? (<View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: theme.colors.border, borderRadius: 24 }}><Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500' }}>No breaks added yet.</Text></View>) : (
                            <View style={{ gap: 12 }}>{breaks.map((brk, index) => (<View key={brk.id} style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="flex-col p-4 border shadow-sm rounded-2xl"><View className="flex-row items-center justify-between mb-2"><View className="flex-row items-center flex-1"><View className="items-center justify-center w-6 h-6 mr-3 rounded-full bg-slate-100 dark:bg-slate-800"><Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold', fontSize: 12 }}>{index + 1}</Text></View><Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 14, marginRight: 8 }}>{brk.title || "Unpaid Break"}</Text><TouchableOpacity onPress={() => openEditBreakTitle(brk.id, brk.title || '')} style={{ padding: 4 }}><HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.textSecondary} /></TouchableOpacity></View><TouchableOpacity onPress={() => removeBreak(brk.id)} style={{ padding: 4 }}><HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} /></TouchableOpacity></View><View className="flex-row items-center justify-around w-full mt-1"><TouchableOpacity onPress={() => openPicker('breakStart', brk.id)} className="flex-1 p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800"><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' }}>Start</Text><Text style={{ color: theme.colors.text, fontWeight: 'bold', fontSize: 14 }}>{formatTime12h(brk.start)}</Text></TouchableOpacity><HugeiconsIcon icon={ArrowDown01Icon} size={16} color={theme.colors.textSecondary} style={{ marginHorizontal: 8, transform: [{ rotate: '-90deg' }] }} /><TouchableOpacity onPress={() => openPicker('breakEnd', brk.id)} className="flex-1 p-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800"><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' }}>End</Text><Text style={{ color: theme.colors.text, fontWeight: 'bold', fontSize: 14 }}>{formatTime12h(brk.end)}</Text></TouchableOpacity></View></View>))}</View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}