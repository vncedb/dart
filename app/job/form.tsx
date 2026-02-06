// Footer Fixed Bottom, Outside Keyboard Avoiding View
import {
    ArrowDown01Icon,
    Briefcase01Icon,
    Building03Icon,
    Calendar03Icon,
    Clock01Icon,
    Delete02Icon,
    DollarCircleIcon,
    InformationCircleIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    Tick01Icon,
    UserGroupIcon,
    UserIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddBreakModal from '../../components/AddBreakModal';
import DatePicker from '../../components/DatePicker';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import SearchableSelectionModal from '../../components/SearchableSelectionModal';
import TimePickerModal from '../../components/TimePicker';

import { JOBS_LIST } from '../../constants/Jobs';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { generateUUID, queueSyncItem, saveJobLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

// ... (Helpers and Options retained) ...
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
    if (!date || isNaN(date.getTime())) return 'Set Time';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

const parseTimeStringToDate = (timeStr: string, baseDate: Date = new Date()) => {
    if (!timeStr) return baseDate;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return baseDate;
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

const PAYOUT_GRID_OPTIONS = [
    { label: 'Weekly', value: 'Weekly', desc: 'Every Friday' },
    { label: 'Bi-Weekly', value: 'Bi-Weekly', desc: 'Every 2 weeks' },
    { label: 'Semi-Monthly', value: 'Semi-Monthly', desc: '15th & 30th' },
    { label: 'Monthly', value: 'Monthly', desc: 'End of month' },
];

const Tooltip = ({ message, theme }: { message: string, theme: any }) => (
    <View style={{ position: 'absolute', right: 0, zIndex: 100, width: 220, marginTop: 8, top: '100%' }}>
        <View style={{ width: '100%' }}>
            <View style={{ position: 'absolute', right: 24, top: -6, width: 12, height: 12, backgroundColor: theme.colors.card, borderLeftWidth: 1, borderTopWidth: 1, borderColor: theme.colors.border, transform: [{ rotate: '45deg' }] }} />
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <HugeiconsIcon icon={InformationCircleIcon} size={16} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', marginBottom: 2, color: theme.colors.text }}>Attention Needed</Text>
                        <Text style={{ fontSize: 11, lineHeight: 15, color: theme.colors.textSecondary }}>{message}</Text>
                    </View>
                </View>
            </View>
        </View>
    </View>
);

export default function JobForm() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const params = useLocalSearchParams();
    const jobId = params.id as string;
    const { user } = useAuth(); 

    const [saving, setSaving] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [jobOptions, setJobOptions] = useState(JOBS_LIST);

    const [position, setPosition] = useState('');
    const [company, setCompany] = useState('');
    const [department, setDepartment] = useState('');
    const [employmentStatus, setEmploymentStatus] = useState('Regular');
    const [salaryDisplay, setSalaryDisplay] = useState('');
    const [rateType, setRateType] = useState<'hourly' | 'daily' | 'monthly'>('hourly');
    const [payoutType, setPayoutType] = useState('Semi-Monthly'); 
    const [startDate, setStartDate] = useState(new Date());
    const [workStart, setWorkStart] = useState<Date>(() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; });
    const [workEnd, setWorkEnd] = useState<Date>(() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d; });
    const [breaks, setBreaks] = useState<{ id: string, start: Date, end: Date, title?: string }[]>([]);
    
    const [errors, setErrors] = useState<{ position?: string; company?: string; salary?: string }>({});
    const [visibleTooltip, setVisibleTooltip] = useState<'position' | 'company' | 'salary' | null>(null);

    const [pickerVisible, setPickerVisible] = useState(false);
    const [calendarVisible, setCalendarVisible] = useState(false);
    const [jobSelectorVisible, setJobSelectorVisible] = useState(false);
    const [statusSelectorVisible, setStatusSelectorVisible] = useState(false);
    const [addBreakModalVisible, setAddBreakModalVisible] = useState(false);
    const [breakTitleModalVisible, setBreakTitleModalVisible] = useState(false);
    const [pickerConfig, setPickerConfig] = useState<{ mode: string, breakId?: string, currentValue?: Date }>({ mode: 'workStart' });
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    
    const [newBreakTitle, setNewBreakTitle] = useState('');
    const [editingBreakId, setEditingBreakId] = useState<string | null>(null); 

    const markDirty = (setter: any, val: any) => { setter(val); setIsDirty(true); };
    
    const handleSalaryChange = (text: string) => { 
        const formatted = formatCurrency(text); 
        setSalaryDisplay(formatted); 
        if (errors.salary) { setErrors(p => ({...p, salary: undefined})); setVisibleTooltip(null); }
        setIsDirty(true); 
    };

    const isOvernightShift = () => {
        const startMins = workStart.getHours() * 60 + workStart.getMinutes();
        const endMins = workEnd.getHours() * 60 + workEnd.getMinutes();
        return endMins < startMins;
    };

    const handleJobSelect = (val: string) => {
        const exists = jobOptions.some(o => o.value === val);
        if (!exists) setJobOptions(prev => [{ label: val, value: val }, ...prev]);
        markDirty(setPosition, val);
        if (errors.position) { setErrors(p => ({...p, position: undefined})); setVisibleTooltip(null); }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (!isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'confirmation', title: 'Discard Changes?', message: 'Unsaved changes will be lost.', confirmText: 'Discard', cancelText: "Keep Editing",
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
                if (!jobOptions.some(o => o.value === data.title)) { setJobOptions(prev => [{ label: data.title, value: data.title }, ...prev]); }

                setCompany(data.company || '');
                setDepartment(data.department || '');
                setEmploymentStatus(data.employment_status || 'Regular');
                setSalaryDisplay(data.rate ? formatCurrency(data.rate.toString()) : '');
                setRateType(data.rate_type || 'hourly');
                setPayoutType(data.payout_type || 'Semi-Monthly'); 

                if (data.start_date) setStartDate(new Date(data.start_date));
                if (workSched) { setWorkStart(parseTimeStringToDate(workSched.start)); setWorkEnd(parseTimeStringToDate(workSched.end)); }
                if (breakSched && Array.isArray(breakSched)) {
                    setBreaks(breakSched.map((b: any, index: number) => ({ id: Date.now().toString() + index, start: parseTimeStringToDate(b.start), end: parseTimeStringToDate(b.end), title: b.title || '' })));
                }
            }
        } catch (error) { console.log('Error fetching job:', error); } 
        finally { setInitialLoading(false); setTimeout(() => setIsDirty(false), 100); }
    };

    const openPicker = (mode: string, breakId?: string) => {
        let currentValue = new Date();
        if (mode === 'workStart') currentValue = workStart;
        else if (mode === 'workEnd') currentValue = workEnd;
        else if (breakId) {
            const b = breaks.find(i => i.id === breakId);
            if (b) currentValue = mode === 'breakStart' ? b.start : b.end;
        }
        setPickerConfig({ mode, breakId, currentValue });
        setPickerVisible(true);
    };

    const handleTimeConfirm = (h: number, m: number, p?: 'AM' | 'PM') => {
        let hours = h;
        if (p === 'PM' && hours !== 12) hours += 12;
        if (p === 'AM' && hours === 12) hours = 0;
        const newDate = new Date(); newDate.setHours(hours); newDate.setMinutes(m); newDate.setSeconds(0);
        setIsDirty(true);
        if (pickerConfig.mode === 'workStart') setWorkStart(newDate);
        else if (pickerConfig.mode === 'workEnd') setWorkEnd(newDate);
        else if (pickerConfig.mode === 'breakStart' && pickerConfig.breakId) { setBreaks(prev => prev.map(b => b.id === pickerConfig.breakId ? { ...b, start: newDate } : b)); }
        else if (pickerConfig.mode === 'breakEnd' && pickerConfig.breakId) { setBreaks(prev => prev.map(b => b.id === pickerConfig.breakId ? { ...b, end: newDate } : b)); }
    };
    
    const handleAddBreak = (newBreak: { start: Date; end: Date; title: string }) => { setBreaks([...breaks, { id: generateUUID(), ...newBreak }]); setIsDirty(true); };
    const openEditBreakTitle = (breakId: string, currentTitle: string) => { setEditingBreakId(breakId); setNewBreakTitle(currentTitle || ''); setBreakTitleModalVisible(true); };
    const saveBreakTitle = () => { if (editingBreakId) { setBreaks(prev => prev.map(b => b.id === editingBreakId ? { ...b, title: newBreakTitle.trim() } : b)); setIsDirty(true); } setBreakTitleModalVisible(false); setEditingBreakId(null); };
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

    const validate = () => {
        const newErrors: any = {};
        let isValid = true;
        if (!position) { newErrors.position = "Job Title is required."; isValid = false; }
        if (!company) { newErrors.company = "Company Name is required."; isValid = false; }
        if (!salaryDisplay) { newErrors.salary = "Pay Rate is required."; isValid = false; }
        
        setErrors(newErrors);
        if (newErrors.position) setVisibleTooltip('position');
        else if (newErrors.company) setVisibleTooltip('company');
        else if (newErrors.salary) setVisibleTooltip('salary');
        return isValid;
    };

    const handleSave = async () => {
        if (!validate()) return;

        setSaving(true);
        try {
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
                payout_type: payoutType, 
                start_date: startDate.toISOString().split('T')[0],
                work_schedule: { start: formatDBTime(workStart), end: formatDBTime(workEnd) },
                break_schedule: breaks.map(b => ({ start: formatDBTime(b.start), end: formatDBTime(b.end), title: b.title })),
                updated_at: now
            };

            if (!jobId) (payload as any).created_at = now;
            
            await saveJobLocal(payload);
            await queueSyncItem('job_positions', finalJobId, jobId ? 'UPDATE' : 'INSERT', payload);
            
            if (!jobId) {
                const db = await getDB();
                await db.runAsync('UPDATE profiles SET current_job_id = ? WHERE id = ?', [finalJobId, user.id]);
                queueSyncItem('profiles', user.id, 'UPDATE', { current_job_id: finalJobId }).then();
                supabase.from('profiles').update({ current_job_id: finalJobId }).eq('id', user.id).then();
            }
            supabase.from('job_positions').upsert(payload).then();
            
            setIsDirty(false);
            setSaving(false);
            router.back();

        } catch (e: any) { 
            setSaving(false);
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message || 'Error saving job.', confirmText: 'Close', onConfirm: () => setAlertConfig((prev:any) => ({ ...prev, visible: false })) }); 
        }
    };

    const StyledInput = ({ label, value, onChange, placeholder, icon, required, errorKey, readonly, onPress }: any) => {
        const isError = errorKey && errors[errorKey as keyof typeof errors];
        const showTooltip = errorKey && visibleTooltip === errorKey;
        
        return (
            <View style={{ marginBottom: 20, zIndex: showTooltip ? 50 : 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
                    {label} {required && <Text style={{ color: '#ef4444' }}>*</Text>}
                </Text>
                <View style={{ position: 'relative' }}>
                    <TouchableOpacity activeOpacity={readonly ? 0.7 : 1} onPress={onPress}>
                        <View style={{ 
                            flexDirection: 'row', alignItems: 'center', 
                            backgroundColor: theme.colors.card, 
                            borderRadius: 16, borderWidth: 1, 
                            borderColor: isError ? '#ef4444' : theme.colors.border,
                            height: 56, paddingHorizontal: 16 
                        }}>
                            <HugeiconsIcon icon={icon} size={22} color={isError ? "#ef4444" : (readonly ? theme.colors.primary : theme.colors.textSecondary)} />
                            {readonly ? (
                                <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: theme.colors.text }}>{value}</Text>
                            ) : (
                                <TextInput 
                                    value={value} 
                                    onChangeText={(t) => { onChange(t); if(errorKey) { setErrors(prev => ({...prev, [errorKey]: undefined})); setVisibleTooltip(null); }}} 
                                    style={{ flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: theme.colors.text }} 
                                    placeholder={placeholder} 
                                    placeholderTextColor={theme.colors.textSecondary}
                                    onFocus={() => setVisibleTooltip(null)}
                                />
                            )}
                            
                            {readonly && <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} />}
                            
                            {isError && !readonly && (
                                <TouchableOpacity onPress={() => setVisibleTooltip(showTooltip ? null : errorKey)}>
                                    <HugeiconsIcon icon={InformationCircleIcon} size={22} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                    {showTooltip && <Tooltip message={errors[errorKey as keyof typeof errors] || ''} theme={theme} />}
                </View>
            </View>
        );
    };

    if (initialLoading) return <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
    
    return (
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setVisibleTooltip(null); }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
                <LoadingOverlay visible={saving} message="Saving Job..." />
                <ModernAlert {...alertConfig} />
                <TimePickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} onConfirm={handleTimeConfirm} initialHours={pickerConfig.currentValue?.getHours()} initialMinutes={pickerConfig.currentValue?.getMinutes()} initialPeriod={pickerConfig.currentValue && pickerConfig.currentValue.getHours() >= 12 ? 'PM' : 'AM'} title={pickerConfig.mode.includes('Start') ? "Start Time" : "End Time"} />
                <AddBreakModal visible={addBreakModalVisible} onClose={() => setAddBreakModalVisible(false)} onAdd={handleAddBreak} />
                <SearchableSelectionModal visible={jobSelectorVisible} onClose={() => setJobSelectorVisible(false)} onSelect={handleJobSelect} title="Select Job Title" options={jobOptions} placeholder="Search job title..." currentValue={position} />
                <SearchableSelectionModal visible={statusSelectorVisible} onClose={() => setStatusSelectorVisible(false)} onSelect={(val) => markDirty(setEmploymentStatus, val)} title="Employment Status" options={EMPLOYMENT_STATUS_OPTIONS} placeholder="Select Status" currentValue={employmentStatus} />
                <DatePicker visible={calendarVisible} onClose={() => setCalendarVisible(false)} onSelect={(date) => { markDirty(setStartDate, date); setCalendarVisible(false); }} selectedDate={startDate} />
                <Modal transparent={true} visible={breakTitleModalVisible} animationType="fade" onRequestClose={() => setBreakTitleModalVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <View style={{ width: '85%', backgroundColor: theme.colors.card, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 8, textAlign: 'center' }}>Rename Break</Text>
                            <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 }}>
                                <TextInput placeholder="e.g. Lunch Break" placeholderTextColor={theme.colors.textSecondary} value={newBreakTitle} onChangeText={setNewBreakTitle} autoFocus maxLength={16} style={{ fontSize: 16, color: theme.colors.text }} />
                            </View>
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                                <TouchableOpacity onPress={() => { setBreakTitleModalVisible(false); setEditingBreakId(null); }} style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: theme.colors.background, alignItems: 'center' }}><Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity onPress={saveBreakTitle} style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                <Header title={jobId ? 'Edit Job' : 'Add New Job'} />

                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={{ flex: 1 }}
                >
                    <ScrollView 
                        contentContainerStyle={{ padding: 24, paddingBottom: 100 }} 
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>Job Details</Text>
                            <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                                <StyledInput label="Job Title" value={position || 'Select Title'} onPress={() => setJobSelectorVisible(true)} readonly icon={Briefcase01Icon} required errorKey="position" />
                                <StyledInput label="Company Name" value={company} onChange={(t:string) => markDirty(setCompany, t)} placeholder="Enter Company" icon={Building03Icon} required errorKey="company" />
                                <StyledInput label="Department" value={department} onChange={(t:string) => markDirty(setDepartment, t)} placeholder="Optional" icon={UserGroupIcon} />
                                <StyledInput label="Employment Status" value={employmentStatus} onPress={() => setStatusSelectorVisible(true)} readonly icon={UserIcon} />
                                <StyledInput label="Date Started" value={startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} onPress={() => setCalendarVisible(true)} readonly icon={Calendar03Icon} />
                            </View>
                        </View>
                        
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>Compensation</Text>
                            <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                                <StyledInput label="Pay Rate" value={salaryDisplay} onChange={handleSalaryChange} placeholder="₱ 0.00" icon={DollarCircleIcon} required errorKey="salary" />
                                <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, padding: 4, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20 }}>
                                    {(['hourly', 'daily', 'monthly'] as const).map((type) => (
                                        <TouchableOpacity key={type} onPress={() => markDirty(setRateType, type)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: rateType === type ? theme.colors.primary : 'transparent', alignItems: 'center' }}>
                                            <Text style={{ color: rateType === type ? '#fff' : theme.colors.textSecondary, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' }}>{type}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>Payout Schedule</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                    {PAYOUT_GRID_OPTIONS.map((opt) => {
                                        const isSelected = payoutType === opt.value;
                                        return (
                                            <TouchableOpacity key={opt.value} onPress={() => markDirty(setPayoutType, opt.value)} style={{ width: '48%', backgroundColor: isSelected ? theme.colors.primary : theme.colors.card, borderColor: isSelected ? theme.colors.primary : theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                                                <Text style={{ color: isSelected ? '#fff' : theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 2 }}>{opt.label}</Text>
                                                <Text style={{ color: isSelected ? '#ffffffcc' : theme.colors.textSecondary, fontSize: 10, fontWeight: '500' }}>{opt.desc}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        </View>

                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>Schedule</Text>
                            <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                    <TouchableOpacity onPress={() => openPicker('workStart')} style={{ flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>START</Text><HugeiconsIcon icon={Clock01Icon} size={16} color={theme.colors.primary} /></View>
                                        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>{formatTime12h(workStart)}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openPicker('workEnd')} style={{ flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: 'bold' }}>END</Text><HugeiconsIcon icon={Clock01Icon} size={16} color="#ef4444" /></View>
                                        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>{formatTime12h(workEnd)}</Text>
                                        {isOvernightShift() && <Text style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 9, color: theme.colors.primary, fontWeight: 'bold', backgroundColor: theme.colors.primary + '15', paddingHorizontal: 4, borderRadius: 4 }}>+1 DAY</Text>}
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Unpaid Breaks</Text>
                                    <TouchableOpacity onPress={() => setAddBreakModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <HugeiconsIcon icon={PlusSignIcon} size={16} color={theme.colors.primary} />
                                        <Text style={{ color: theme.colors.primary, marginLeft: 4, fontSize: 12, fontWeight: '700' }}>Add</Text>
                                    </TouchableOpacity>
                                </View>

                                {breaks.length === 0 ? (
                                    <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: theme.colors.border, borderRadius: 16 }}>
                                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' }}>No breaks added.</Text>
                                    </View>
                                ) : (
                                    <View style={{ gap: 10 }}>
                                        {breaks.map((brk) => (
                                            <View key={brk.id} style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginRight: 8 }}>{brk.title || "Break"}</Text>
                                                        <TouchableOpacity onPress={() => openEditBreakTitle(brk.id, brk.title || '')}><HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.textSecondary} /></TouchableOpacity>
                                                    </View>
                                                    <TouchableOpacity onPress={() => removeBreak(brk.id)}><HugeiconsIcon icon={Delete02Icon} size={16} color="#ef4444" /></TouchableOpacity>
                                                </View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <TouchableOpacity onPress={() => openPicker('breakStart', brk.id)} style={{ flex: 1, padding: 8, backgroundColor: theme.colors.card, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                                                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700' }}>START</Text>
                                                        <Text style={{ fontSize: 13, color: theme.colors.text, fontWeight: '700' }}>{formatTime12h(brk.start)}</Text>
                                                    </TouchableOpacity>
                                                    <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
                                                    <TouchableOpacity onPress={() => openPicker('breakEnd', brk.id)} style={{ flex: 1, padding: 8, backgroundColor: theme.colors.card, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                                                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700' }}>END</Text>
                                                        <Text style={{ fontSize: 13, color: theme.colors.text, fontWeight: '700' }}>{formatTime12h(brk.end)}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                
                                <View style={{ marginTop: 20, alignItems: 'center', backgroundColor: theme.colors.primary + '10', padding: 12, borderRadius: 12 }}>
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Total Daily Goal: <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>{formatHoursDisplay(calculateDailyHours())}</Text></Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
                
                <Footer>
                    <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, height: 56, borderRadius: 16, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginRight: 8 }}>{jobId ? 'Update Job' : 'Save Job'}</Text>
                        <HugeiconsIcon icon={Tick01Icon} size={20} color="white" strokeWidth={2.5} />
                    </TouchableOpacity>
                </Footer>
            </SafeAreaView>
        </TouchableWithoutFeedback>
    );
}