// filepath: app/reports/add-attendance.tsx
import {
    Calendar03Icon,
    Clock01Icon,
    PencilEdit02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import DatePicker from '../../components/DatePicker';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import TimePicker from '../../components/TimePicker';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { generateUUID, queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { refreshWidgetSnapshot } from '../../lib/widgets';

export default function AddAttendanceScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { user } = useAuth(); 
    const { triggerSync } = useSync();
    
    const { jobId, date: paramDate } = useLocalSearchParams();
    const passedJobId = Array.isArray(jobId) ? jobId[0] : jobId;
    
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(paramDate ? new Date(paramDate as string) : new Date());
    const [timeIn, setTimeIn] = useState<Date | undefined>(undefined);
    const [timeOut, setTimeOut] = useState<Date | undefined>(undefined);
    const [remarks, setRemarks] = useState('');

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimeInPicker, setShowTimeInPicker] = useState(false);
    const [showTimeOutPicker, setShowTimeOutPicker] = useState(false);

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'warning', title: 'Discard Changes?', message: 'You have unsaved attendance details. Are you sure you want to leave?',
                confirmText: 'Discard', cancelText: 'Keep Editing',
                onConfirm: () => {
                    setAlertConfig({ visible: false });
                    setIsDirty(false); 
                    navigation.dispatch(e.data.action);
                },
                onCancel: () => setAlertConfig({ visible: false })
            });
        });
        return unsubscribe;
    }, [navigation, loading, isDirty]);

    useEffect(() => {
        const fetchActiveJob = async () => {
            if (!user) return;
            try {
                if (passedJobId) {
                    setActiveJobId(passedJobId);
                } else {
                    const db = await getDB();
                    const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);
                    if (profile?.current_job_id) setActiveJobId(profile.current_job_id);
                }
            } catch (e) { console.log(e); } finally { setInitialLoading(false); }
        };
        fetchActiveJob();
    }, [passedJobId, user]);

    const handleTimeConfirm = (setter: React.Dispatch<React.SetStateAction<Date | undefined>>) => 
        (hours: number, minutes: number, period?: "AM" | "PM" | undefined) => {
            const newDate = new Date(selectedDate);
            let h = hours;
            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            
            newDate.setHours(h, minutes, 0, 0);
            setter(newDate);
            setIsDirty(true);
            setShowTimeInPicker(false);
            setShowTimeOutPicker(false);
        };

    const getInitialTime = (d?: Date): { h: number; m: number; p: "AM" | "PM" } => {
        if (!d) return { h: 12, m: 0, p: 'AM' };
        let h = d.getHours();
        const m = d.getMinutes();
        const p: "AM" | "PM" = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { h, m, p };
    };

    const saveAttendance = async () => {
        if (!timeIn) {
            setAlertConfig({ visible: true, type: 'warning', title: 'Missing Time In', message: 'You must provide at least a Clock In time.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }
        if (!activeJobId || !user?.id) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'User or Job profile missing.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }

        setLoading(true);
        try {
            const db = await getDB();
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const now = new Date().toISOString();

            const cIn = new Date(selectedDate);
            cIn.setHours(timeIn.getHours(), timeIn.getMinutes(), 0, 0);

            let cOut = null;
            let status = 'pending'; 

            if (timeOut) {
                cOut = new Date(selectedDate);
                cOut.setHours(timeOut.getHours(), timeOut.getMinutes(), 0, 0);
                if (cOut < cIn) {
                    setAlertConfig({ visible: true, type: 'warning', title: 'Invalid Time', message: 'Time Out must stay within the same day and cannot be earlier than Time In.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
                    setLoading(false);
                    return;
                }
                status = 'completed'; 
            }

            const newId = generateUUID();
            let finalRemarks = remarks.trim() ? `Manual Entry: ${remarks.trim()}` : 'Manual Entry';

            const newRecord = { 
                id: newId, 
                user_id: user.id, 
                job_id: activeJobId, 
                date: dateStr, 
                clock_in: cIn.toISOString(), 
                clock_out: cOut ? cOut.toISOString() : null,
                status, 
                remarks: finalRemarks, 
                updated_at: now 
            };

            await db.runAsync(
                'INSERT INTO attendance (id, user_id, job_id, date, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
                [newRecord.id, newRecord.user_id, newRecord.job_id, newRecord.date, newRecord.clock_in, newRecord.clock_out ?? null, newRecord.status, newRecord.remarks, newRecord.updated_at]
            );
            await queueSyncItem('attendance', newId, 'INSERT', newRecord);

            setIsDirty(false);
            triggerSync(); 
            await refreshWidgetSnapshot(user.id, { force: true });
            router.back(); 
        } catch (e: any) { 
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message || 'An error occurred.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
        } finally { setLoading(false); }
    };

    const timeInVals = getInitialTime(timeIn);
    const timeOutVals = getInitialTime(timeOut);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message="Logging Attendance..." />
            
            <DatePicker visible={showDatePicker} onClose={() => setShowDatePicker(false)} onSelect={(date) => { setSelectedDate(date); setIsDirty(true); setShowDatePicker(false); }} selectedDate={selectedDate} title="Select Shift Date" />
            
            <TimePicker visible={showTimeInPicker} onClose={() => setShowTimeInPicker(false)} onConfirm={handleTimeConfirm(setTimeIn)} title="Select Time In" initialHours={timeInVals.h} initialMinutes={timeInVals.m} initialPeriod={timeInVals.p} />
            <TimePicker visible={showTimeOutPicker} onClose={() => setShowTimeOutPicker(false)} onConfirm={handleTimeConfirm(setTimeOut)} title="Select Time Out" initialHours={timeOutVals.h} initialMinutes={timeOutVals.m} initialPeriod={timeOutVals.p} />

            <Header title="Log Attendance" />

            {initialLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        
                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Shift Date</Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowDatePicker(true)} style={[styles.inputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <View style={styles.dateRow}>
                                    <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.primary} />
                                    <Text style={[styles.dateText, { color: theme.colors.text }]}>{format(selectedDate, 'MMMM d, yyyy')}</Text>
                                </View>
                                <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Time In <Text style={{color: theme.colors.danger}}>*</Text></Text>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setShowTimeInPicker(true)} style={[styles.inputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                    <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.primary} />
                                    <Text style={[styles.dateText, { color: timeIn ? theme.colors.text : theme.colors.textSecondary, flex: 1 }]}>
                                        {timeIn ? format(timeIn, 'h:mm a') : 'Select Time'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Time Out (Optional)</Text>
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setShowTimeOutPicker(true)} style={[styles.inputWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                    <HugeiconsIcon icon={Clock01Icon} size={18} color={timeOut ? theme.colors.primary : theme.colors.textSecondary} />
                                    <Text style={[styles.dateText, { color: timeOut ? theme.colors.text : theme.colors.textSecondary, flex: 1 }]}>
                                        {timeOut ? format(timeOut, 'h:mm a') : 'Select Time'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Reason / Remarks</Text>
                            <View style={[styles.inputWrapper, styles.textAreaWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <TextInput style={[styles.textInput, styles.textArea, { color: theme.colors.text }]} placeholder="e.g. Forgot to clock in, Field Work..." placeholderTextColor={theme.colors.textSecondary} value={remarks} onChangeText={(t) => { setRemarks(t); setIsDirty(true); }} multiline textAlignVertical="top" />
                            </View>
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            )}
            
            {isDirty && (
                <Footer>
                    <Button title="Save Attendance" onPress={saveAttendance} isLoading={loading} disabled={loading || !timeIn} style={{ width: '100%' }} />
                </Footer>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 100 },
    inputBlock: { marginBottom: 24 },
    label: { fontSize: 11, fontFamily: 'Nunito_500Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 56 },
    dateRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    dateText: { fontFamily: 'Nunito_500Medium', fontSize: 15, marginLeft: 12 },
    textInput: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 15, paddingVertical: 16 },
    textAreaWrapper: { alignItems: 'flex-start', minHeight: 100 },
    textArea: { height: 80, paddingTop: 16 },
});
