import {
    ArrowDown01Icon,
    Briefcase01Icon,
    Building03Icon,
    Calendar03Icon,
    Clock01Icon,
    Delete02Icon,
    InformationCircleIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    Target02Icon,
    UserGroupIcon,
    UserIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AddBreakModal from '../../components/AddBreakModal';
import Button from '../../components/Button';
import DatePicker from '../../components/DatePicker';
import DurationPicker from '../../components/DurationPicker';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import LoadingScreen from '../../components/LoadingScreen';
import ModernAlert from '../../components/ModernAlert';
import SearchableSelectionModal from '../../components/SearchableSelectionModal';
import TimePickerModal from '../../components/TimePicker';

import { JOBS_LIST } from '../../constants/Jobs';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { generateUUID, saveJobLocal, saveProfileLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { requireOnlineFeature } from '../../lib/offline-access';
import { supabase } from '../../lib/supabase';

// --- HELPERS ---
const formatCurrency = (val: string) => {
    const numericValue = val.replace(/[^0-9.]/g, '');
    if (!numericValue) return '';
    const parts = numericValue.split('.');
    if (parts[1] && parts[1].length > 2) parts[1] = parts[1].substring(0, 2);
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
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

// --- COMPONENTS ---
const Tooltip = ({ message, theme }: { message: string, theme: any }) => (
    <View style={{ position: 'absolute', right: 0, zIndex: 100, width: 220, marginTop: 8, top: '100%' }}>
        <View style={{ width: '100%' }}>
            <View style={{ position: 'absolute', right: 24, top: -6, width: 12, height: 12, backgroundColor: theme.colors.card, borderLeftWidth: 1, borderTopWidth: 1, borderColor: theme.colors.border, transform: [{ rotate: '45deg' }] }} />
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <HugeiconsIcon icon={InformationCircleIcon} size={16} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', marginBottom: 2, color: theme.colors.text }}>Attention Needed</Text>
                        <Text style={{ fontSize: 11, lineHeight: 15, fontFamily: 'Nunito_400Regular', color: theme.colors.textSecondary }}>{message}</Text>
                    </View>
                </View>
            </View>
        </View>
    </View>
);

const StyledInput = ({ label, value, onChange, placeholder, icon, prefix, keyboardType = 'default', required, errorKey, readonly, onPress, theme, errors, setErrors, visibleTooltip, setVisibleTooltip }: any) => {
    const isError = errorKey && errors[errorKey];
    const showTooltip = errorKey && visibleTooltip === errorKey;
    const hasValue = value && value.length > 0;
    
    return (
        <View style={{ marginBottom: 20, zIndex: showTooltip ? 50 : 1 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
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
                        {icon ? (
                            <HugeiconsIcon icon={icon} size={22} color={isError ? "#ef4444" : (readonly && hasValue ? theme.colors.primary : theme.colors.textSecondary)} />
                        ) : null}

                        {prefix ? (
                            <Text style={{ marginLeft: icon ? 10 : 0, fontSize: 20, fontFamily: 'Nunito_500Medium', color: isError ? "#ef4444" : (readonly && hasValue ? theme.colors.primary : theme.colors.textSecondary) }}>
                                {prefix}
                            </Text>
                        ) : null}

                        {readonly ? (
                            <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Nunito_500Medium', color: hasValue ? theme.colors.text : theme.colors.textSecondary }}>
                                {hasValue ? value : placeholder}
                            </Text>
                        ) : (
                            <TextInput 
                                value={value} 
                                onChangeText={(t) => { onChange(t); if(errorKey) { setErrors((prev:any) => ({...prev, [errorKey]: undefined})); setVisibleTooltip(null); }}} 
                                style={{ flex: 1, marginLeft: 12, padding: 0, fontSize: 15, fontFamily: 'Nunito_500Medium', color: theme.colors.text }} 
                                placeholder={placeholder} 
                                placeholderTextColor={theme.colors.textSecondary}
                                keyboardType={keyboardType}
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
                {showTooltip && <Tooltip message={errors[errorKey] || ''} theme={theme} />}
            </View>
        </View>
    );
};

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
    
    const [targetHours, setTargetHours] = useState<string>('');
    const [targetMinutes, setTargetMinutes] = useState<string>('');
    const [durationPickerVisible, setDurationPickerVisible] = useState(false);

    const [startDate, setStartDate] = useState(new Date());
    const [workStart, setWorkStart] = useState<Date>(() => { const d = new Date(); d.setHours(9, 0, 0, 0); return d; });
    const [workEnd, setWorkEnd] = useState<Date>(() => { const d = new Date(); d.setHours(17, 0, 0, 0); return d; });
    const [breaks, setBreaks] = useState<{ id: string, start: Date, end: Date, title?: string }[]>([]);
    
    const [errors, setErrors] = useState<any>({});
    const [visibleTooltip, setVisibleTooltip] = useState<string | null>(null);

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
        if (errors.salary) { setErrors((p:any) => ({...p, salary: undefined})); setVisibleTooltip(null); }
        setIsDirty(true); 
    };

    const targetTotalHours = useMemo(() => {
        const h = parseInt(targetHours || '0', 10);
        const m = parseInt(targetMinutes || '0', 10);
        if (isNaN(h) && isNaN(m)) return 0;
        return Math.max(0, (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m) / 60);
    }, [targetHours, targetMinutes]);

    const estimatedPeriodPay = useMemo(() => {
        const salary = parseCurrency(salaryDisplay);
        if (!salary || salary <= 0) return null;

        if (rateType === 'monthly') {
            return salary;
        }

        if (targetTotalHours <= 0) {
            return null;
        }

        if (rateType === 'daily') {
            return salary * (targetTotalHours / 8);
        }

        return salary * targetTotalHours;
    }, [rateType, salaryDisplay, targetTotalHours]);

    const formatPeso = useCallback((value: number) => {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
    }, []);

    const isOvernightShift = () => {
        const startMins = workStart.getHours() * 60 + workStart.getMinutes();
        const endMins = workEnd.getHours() * 60 + workEnd.getMinutes();
        return endMins < startMins;
    };

    const handleJobSelect = (val: string) => {
        const exists = jobOptions.some(o => o.value === val);
        if (!exists) setJobOptions(prev => [{ label: val, value: val }, ...prev]);
        markDirty(setPosition, val);
        if (errors.position) { setErrors((p:any) => ({...p, position: undefined})); setVisibleTooltip(null); }
    };

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (saving || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'confirmation', title: 'Discard Changes?', message: 'Unsaved changes will be lost.', confirmText: 'Discard', cancelText: "Keep Editing",
                onConfirm: () => { setAlertConfig((prev:any) => ({ ...prev, visible: false })); navigation.dispatch(e.data.action); },
                onCancel: () => setAlertConfig((prev:any) => ({ ...prev, visible: false }))
            });
        });
        return unsubscribe;
    }, [navigation, isDirty, saving]);

    const fetchJobData = useCallback(async () => {
        if (!jobId) { setInitialLoading(false); return; }
        try {
            const db = await getDB();
            const localJob = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [jobId]);
            let data: any = localJob;

            // OFFLINE-FIRST: Only attempt remote fetch if device is connected AND local doesn't exist
            if (!localJob) {
                const netInfo = await NetInfo.fetch();
                if (netInfo.isConnected) {
                    const { data: remoteData } = await supabase.from('job_positions').select('*').eq('id', jobId).single();
                    data = remoteData;
                }
            }

            if (data) {
                const workSched = typeof data.work_schedule === 'string' ? JSON.parse(data.work_schedule) : data.work_schedule;
                const breakSched = typeof data.break_schedule === 'string' ? JSON.parse(data.break_schedule) : data.break_schedule;

                setPosition(data.title);
                setJobOptions(prev => prev.some(o => o.value === data.title) ? prev : [{ label: data.title, value: data.title }, ...prev]);

                setCompany(data.company || '');
                setDepartment(data.department || '');
                setEmploymentStatus(data.employment_status || 'Regular');
                setSalaryDisplay(data.rate ? formatCurrency(data.rate.toString()) : '');
                setRateType(data.rate_type || 'hourly');
                setPayoutType(data.payout_type || 'Semi-Monthly'); 

                if (data.period_target !== undefined && data.period_target !== null) {
                    const totalMins = Number(data.period_target);
                    if (!isNaN(totalMins) && totalMins > 0) {
                        setTargetHours(Math.floor(totalMins / 60).toString());
                        setTargetMinutes((totalMins % 60).toString());
                    } else {
                        setTargetHours('');
                        setTargetMinutes('');
                    }
                } else {
                    setTargetHours('');
                    setTargetMinutes('');
                }

                if (data.start_date) setStartDate(new Date(data.start_date));
                if (workSched) { setWorkStart(parseTimeStringToDate(workSched.start)); setWorkEnd(parseTimeStringToDate(workSched.end)); }
                if (breakSched && Array.isArray(breakSched)) {
                    setBreaks(breakSched.map((b: any, index: number) => ({ id: Date.now().toString() + index, start: parseTimeStringToDate(b.start), end: parseTimeStringToDate(b.end), title: b.title || '' })));
                }
            }
        } catch (error) { console.log('Error fetching job:', error); } 
        finally { setInitialLoading(false); setTimeout(() => setIsDirty(false), 100); }
    }, [jobId]);

    useEffect(() => { fetchJobData(); }, [fetchJobData]);

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

    const normalizeValue = (value: string) => value.trim().toLowerCase();

    const handleSave = async () => {
        if (!validate()) return;

        const canProceed = await requireOnlineFeature('job_editor', setAlertConfig);
        if (!canProceed) return;

        setSaving(true);
        try {
            if (!user) throw new Error('No user found');

            const formatDBTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            const salaryValue = parseCurrency(salaryDisplay);
            const finalJobId = jobId || generateUUID();
            const now = new Date().toISOString();
            
            let periodTargetMins = null;
            const h = parseInt(targetHours || '0', 10);
            const m = parseInt(targetMinutes || '0', 10);
            if (h > 0 || m > 0) { periodTargetMins = (h * 60) + m; }

            const db = await getDB();
            const localJobs: any[] = await db.getAllAsync(
                'SELECT id, title, company FROM job_positions WHERE user_id = ? AND deleted_at IS NULL AND id != ?',
                [user.id, finalJobId]
            );
            const remoteJobsRes = await supabase.from('job_positions').select('id,title,company').eq('user_id', user.id);
            if (remoteJobsRes.error) throw remoteJobsRes.error;

            const duplicateExists = [...localJobs, ...(remoteJobsRes.data || [])].some((job: any) => (
                job.id !== finalJobId &&
                normalizeValue(job.title || '') === normalizeValue(position) &&
                normalizeValue(job.company || '') === normalizeValue(company)
            ));

            if (duplicateExists) {
                throw new Error('This exact job title and company combination already exists. Use a different title or company.');
            }

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
                period_target: periodTargetMins,
                start_date: startDate.toISOString().split('T')[0],
                work_schedule: { start: formatDBTime(workStart), end: formatDBTime(workEnd) },
                break_schedule: breaks.map(b => ({ start: formatDBTime(b.start), end: formatDBTime(b.end), title: b.title })),
                updated_at: now
            };

            if (!jobId) (payload as any).created_at = now;

            const { error: saveError } = await supabase.from('job_positions').upsert(payload);
            if (saveError) throw saveError;

            await saveJobLocal(payload, { queueSync: false, synced: true });

            if (!jobId) {
                await db.runAsync('UPDATE profiles SET current_job_id = ? WHERE id = ?', [finalJobId, user.id]);
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ current_job_id: finalJobId, updated_at: now })
                    .eq('id', user.id);
                if (profileError) throw profileError;

                const localProfile: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [user.id]);
                await saveProfileLocal({ ...(localProfile || { id: user.id }), current_job_id: finalJobId, updated_at: now }, { queueSync: false, synced: true });
            }

            setIsDirty(false);
            setSaving(false);
            router.back();
        } catch (e: any) { 
            setSaving(false);
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message || 'Error saving job.', confirmText: 'Close', onConfirm: () => setAlertConfig((prev:any) => ({ ...prev, visible: false })) }); 
        }
    };

    if (initialLoading) return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}><LoadingScreen variant="job-form" message="Loading Job..." /></SafeAreaView>;
    
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <LoadingOverlay visible={saving} message="Saving Job..." />
            <ModernAlert {...alertConfig} />
            <TimePickerModal visible={pickerVisible} onClose={() => setPickerVisible(false)} onConfirm={handleTimeConfirm} initialHours={pickerConfig.currentValue?.getHours()} initialMinutes={pickerConfig.currentValue?.getMinutes()} initialPeriod={pickerConfig.currentValue && pickerConfig.currentValue.getHours() >= 12 ? 'PM' : 'AM'} title={pickerConfig.mode.includes('Start') ? "Start Time" : "End Time"} />
            
            <DurationPicker 
                visible={durationPickerVisible} 
                onClose={() => setDurationPickerVisible(false)} 
                onConfirm={(h, m) => { 
                    setTargetHours(h.toString()); 
                    setTargetMinutes(m.toString()); 
                    setIsDirty(true); 
                    setDurationPickerVisible(false);
                }} 
                initialHours={parseInt(targetHours || '0', 10)} 
                initialMinutes={parseInt(targetMinutes || '0', 10)} 
                title="Target Duration"
                maxHours={200}
            />
            
            <AddBreakModal visible={addBreakModalVisible} onClose={() => setAddBreakModalVisible(false)} onAdd={handleAddBreak} />
            <SearchableSelectionModal visible={jobSelectorVisible} onClose={() => setJobSelectorVisible(false)} onSelect={handleJobSelect} title="Select Job Title" options={jobOptions} placeholder="Search job title..." currentValue={position} />
            <SearchableSelectionModal visible={statusSelectorVisible} onClose={() => setStatusSelectorVisible(false)} onSelect={(val) => markDirty(setEmploymentStatus, val)} title="Employment Status" options={EMPLOYMENT_STATUS_OPTIONS} placeholder="Select Status" currentValue={employmentStatus} />
            <DatePicker visible={calendarVisible} onClose={() => setCalendarVisible(false)} onSelect={(date) => { markDirty(setStartDate, date); setCalendarVisible(false); }} selectedDate={startDate} />
            
            <Modal transparent={true} visible={breakTitleModalVisible} animationType="fade" onRequestClose={() => setBreakTitleModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ width: '85%', backgroundColor: theme.colors.card, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }}>
                        <Text style={{ fontSize: 18, fontFamily: 'Nunito_500Medium', color: theme.colors.text, marginBottom: 8, textAlign: 'center' }}>Rename Break</Text>
                        <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 }}>
                            <TextInput placeholder="e.g. Lunch Break" placeholderTextColor={theme.colors.textSecondary} value={newBreakTitle} onChangeText={setNewBreakTitle} autoFocus maxLength={16} style={{ fontSize: 16, fontFamily: 'Nunito_500Medium', color: theme.colors.text }} />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <TouchableOpacity onPress={() => { setBreakTitleModalVisible(false); setEditingBreakId(null); }} style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: theme.colors.background, alignItems: 'center' }}><Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={saveBreakTitle} style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center' }}><Text style={{ color: '#fff', fontFamily: 'Nunito_500Medium' }}>Save</Text></TouchableOpacity>
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
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: isDirty ? 150 : 40 }]} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Nunito_500Medium', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>Job Details</Text>
                        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <StyledInput label="Job Title" value={position || 'Select Title'} onPress={() => setJobSelectorVisible(true)} readonly icon={Briefcase01Icon} required errorKey="position" theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                            <StyledInput label="Company Name" value={company} onChange={(t:string) => markDirty(setCompany, t)} placeholder="Enter Company Name" icon={Building03Icon} required errorKey="company" theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                            <StyledInput label="Department" value={department} onChange={(t:string) => markDirty(setDepartment, t)} placeholder="Enter Department Name" icon={UserGroupIcon} theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                            <StyledInput label="Employment Status" value={employmentStatus} onPress={() => setStatusSelectorVisible(true)} readonly icon={UserIcon} required theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                            <StyledInput label="Date Started" value={startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} onPress={() => setCalendarVisible(true)} readonly icon={Calendar03Icon} required theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                        </View>
                    </View>
                    
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Nunito_500Medium', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>Compensation</Text>
                        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            
                                                        <StyledInput label="Pay Rate" prefix={String.fromCharCode(0x20b1)} keyboardType="decimal-pad" value={salaryDisplay} onChange={handleSalaryChange} placeholder="0.00" required errorKey="salary" theme={theme} errors={errors} setErrors={setErrors} visibleTooltip={visibleTooltip} setVisibleTooltip={setVisibleTooltip} />
                            
                            <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, padding: 4, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20 }}>
                                {(['hourly', 'daily', 'monthly'] as const).map((type) => (
                                    <TouchableOpacity key={type} onPress={() => markDirty(setRateType, type)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: rateType === type ? theme.colors.primary : 'transparent', alignItems: 'center' }}>
                                        <Text style={{ color: rateType === type ? '#fff' : theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', fontSize: 13, textTransform: 'capitalize' }}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            
                            <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
                                Payout Schedule <Text style={{ color: '#ef4444' }}>*</Text>
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                                {PAYOUT_GRID_OPTIONS.map((opt) => {
                                    const isSelected = payoutType === opt.value;
                                    return (
                                        <TouchableOpacity key={opt.value} onPress={() => markDirty(setPayoutType, opt.value)} style={{ width: '48%', backgroundColor: isSelected ? theme.colors.primary : theme.colors.card, borderColor: isSelected ? theme.colors.primary : theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                                            <Text style={{ color: isSelected ? '#fff' : theme.colors.text, fontFamily: 'Nunito_500Medium', fontSize: 14, marginBottom: 2 }}>{opt.label}</Text>
                                            <Text style={{ color: isSelected ? '#ffffffcc' : theme.colors.textSecondary, fontSize: 10, fontFamily: 'Nunito_500Medium' }}>{opt.desc}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ marginBottom: 8 }}>
                                <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 }}>
                                    {payoutType} Target Duration
                                </Text>
                                
                                <TouchableOpacity 
                                    activeOpacity={0.7}
                                    onPress={() => setDurationPickerVisible(true)}
                                    style={{ 
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                        backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, 
                                        borderColor: theme.colors.border, height: 56, paddingHorizontal: 16 
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <HugeiconsIcon 
                                            icon={Target02Icon} 
                                            size={22} 
                                            color={(targetHours || targetMinutes) ? theme.colors.primary : theme.colors.textSecondary} 
                                        />
                                        <Text style={{ marginLeft: 12, fontSize: 15, fontFamily: 'Nunito_500Medium', color: (targetHours || targetMinutes) ? theme.colors.text : theme.colors.textSecondary }}>
                                            {(targetHours || targetMinutes) ? `${targetHours || '0'} hrs ${targetMinutes || '0'} mins` : 'Select Target Duration'}
                                        </Text>
                                    </View>
                                    <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>


                    {estimatedPeriodPay !== null && (
                        <View style={{ marginBottom: 20, marginTop: -6, backgroundColor: theme.colors.primary + '12', borderColor: theme.colors.primary + '28', borderWidth: 1, borderRadius: 16, padding: 14 }}>
                            <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', color: theme.colors.textSecondary, marginBottom: 4 }}>
                                Estimated {rateType === 'monthly' ? 'Monthly' : payoutType} Gross
                            </Text>
                            <Text style={{ fontSize: 22, fontFamily: 'Nunito_800ExtraBold', color: theme.colors.primary }}>
                                {formatPeso(estimatedPeriodPay)}
                            </Text>
                            {rateType === 'daily' && (
                                <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, marginTop: 4 }}>
                                    Daily rate conversion uses an 8-hour workday baseline.
                                </Text>
                            )}
                        </View>
                    )}

                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: 'Nunito_500Medium', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' }}>
                            Schedule <Text style={{ color: '#ef4444' }}>*</Text>
                        </Text>
                        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                                <TouchableOpacity onPress={() => openPicker('workStart')} style={{ flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontFamily: 'Nunito_500Medium' }}>START</Text><HugeiconsIcon icon={Clock01Icon} size={16} color={theme.colors.primary} /></View>
                                    <Text style={{ color: theme.colors.text, fontSize: 18, fontFamily: 'Nunito_500Medium' }}>{formatTime12h(workStart)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => openPicker('workEnd')} style={{ flex: 1, backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}><Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontFamily: 'Nunito_500Medium' }}>END</Text><HugeiconsIcon icon={Clock01Icon} size={16} color="#ef4444" /></View>
                                    <Text style={{ color: theme.colors.text, fontSize: 18, fontFamily: 'Nunito_500Medium' }}>{formatTime12h(workEnd)}</Text>
                                    {isOvernightShift() && <Text style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 9, color: theme.colors.primary, fontFamily: 'Nunito_500Medium', backgroundColor: theme.colors.primary + '15', paddingHorizontal: 4, borderRadius: 4 }}>+1 DAY</Text>}
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Unpaid Breaks</Text>
                                <TouchableOpacity onPress={() => setAddBreakModalVisible(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <HugeiconsIcon icon={PlusSignIcon} size={16} color={theme.colors.primary} />
                                    <Text style={{ color: theme.colors.primary, marginLeft: 4, fontSize: 12, fontFamily: 'Nunito_500Medium' }}>Add</Text>
                                </TouchableOpacity>
                            </View>

                            {breaks.length === 0 ? (
                                <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: theme.colors.border, borderRadius: 16 }}>
                                    <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontFamily: 'Nunito_500Medium' }}>No breaks added.</Text>
                                </View>
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {breaks.map((brk) => (
                                        <View key={brk.id} style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={{ color: theme.colors.text, fontFamily: 'Nunito_500Medium', fontSize: 14, marginRight: 8 }}>{brk.title || "Break"}</Text>
                                                    <TouchableOpacity onPress={() => openEditBreakTitle(brk.id, brk.title || '')}><HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.textSecondary} /></TouchableOpacity>
                                                </View>
                                                <TouchableOpacity onPress={() => removeBreak(brk.id)}><HugeiconsIcon icon={Delete02Icon} size={16} color="#ef4444" /></TouchableOpacity>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <TouchableOpacity onPress={() => openPicker('breakStart', brk.id)} style={{ flex: 1, padding: 8, backgroundColor: theme.colors.card, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                                                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium' }}>START</Text>
                                                    <Text style={{ fontSize: 13, color: theme.colors.text, fontFamily: 'Nunito_500Medium' }}>{formatTime12h(brk.start)}</Text>
                                                </TouchableOpacity>
                                                <HugeiconsIcon icon={ArrowDown01Icon} size={16} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
                                                <TouchableOpacity onPress={() => openPicker('breakEnd', brk.id)} style={{ flex: 1, padding: 8, backgroundColor: theme.colors.card, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                                                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium' }}>END</Text>
                                                    <Text style={{ fontSize: 13, color: theme.colors.text, fontFamily: 'Nunito_500Medium' }}>{formatTime12h(brk.end)}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                            
                            <View style={{ marginTop: 20, alignItems: 'center', backgroundColor: theme.colors.primary + '10', padding: 12, borderRadius: 12 }}>
                                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontFamily: 'Nunito_500Medium' }}>Total Daily Goal: <Text style={{ color: theme.colors.primary, fontFamily: 'Nunito_500Medium' }}>{formatHoursDisplay(calculateDailyHours())}</Text></Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>

                {isDirty && (
                    <Footer style={{ backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }}>
                        <Button
                            title={jobId ? 'Update Job Profile' : 'Save Job Profile'}
                            onPress={handleSave}
                            disabled={saving}
                            isLoading={saving}
                            style={{ width: '100%', height: 56, borderRadius: 16 }}
                        />
                    </Footer>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 24, paddingBottom: 150, flexGrow: 1 }
});

