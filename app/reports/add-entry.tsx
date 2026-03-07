// filepath: app/reports/add-entry.tsx
import {
    ArrowDown01Icon,
    Calendar03Icon,
    Camera01Icon,
    Delete02Icon,
    Image01Icon,
    PencilEdit02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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

const MAX_PHOTOS = 4;

export default function AddEntryScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { user } = useAuth(); 
    const { triggerSync } = useSync();
    
    const { id, jobId, date: paramDate, fixedDate, showAttendance } = useLocalSearchParams();
    const entryId = Array.isArray(id) ? id[0] : id; 
    const passedJobId = Array.isArray(jobId) ? jobId[0] : jobId;
    const isFixedDate = fixedDate === 'true';
    const showAttendanceBool = showAttendance === 'true';
    
    const canEditDate = !isFixedDate && !entryId;
    
    // --- Data States ---
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date>(paramDate ? new Date(paramDate as string) : new Date());
    
    // --- Time States (Attendance Mode) ---
    const [timeIn, setTimeIn] = useState<Date | undefined>(undefined);
    const [timeOut, setTimeOut] = useState<Date | undefined>(undefined);

    // --- Modal States ---
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimeInPicker, setShowTimeInPicker] = useState(false);
    const [showTimeOutPicker, setShowTimeOutPicker] = useState(false);

    // --- UI/UX States ---
    const [errors, setErrors] = useState({ description: false });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'warning', title: 'Discard Changes?', message: 'You have unsaved changes. Are you sure you want to leave?',
                confirmText: 'Discard', cancelText: 'Keep Editing',
                onConfirm: () => {
                    setAlertConfig((p: any) => ({ ...p, visible: false }));
                    setIsDirty(false); 
                    navigation.dispatch(e.data.action);
                },
                onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        });
        return unsubscribe;
    }, [navigation, loading, isDirty]);

    const fetchActiveJob = useCallback(async () => {
        if (!user) return;
        try {
            const db = await getDB();
            const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);
            if (profile?.current_job_id) setActiveJobId(profile.current_job_id);
        } catch (e) {
            console.log(e);
        } finally {
            setInitialLoading(false);
        }
    }, [user]);

    const fetchEntryDetails = useCallback(async (id: string) => {
        try {
            const db = await getDB();
            const entry: any = await db.getFirstAsync('SELECT * FROM accomplishments WHERE id = ?', [id]);
            if (entry) {
                setDescription(entry.description);
                setRemarks(entry.remarks || '');
                setActiveJobId(entry.job_id);
                setSelectedDate(new Date(entry.date));
                if (entry.image_url) {
                    try {
                        const parsed = JSON.parse(entry.image_url);
                        setImages(Array.isArray(parsed) ? parsed : [entry.image_url]);
                    } catch {
                        setImages([entry.image_url]);
                    }
                }
                setIsDirty(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setInitialLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            if (entryId) await fetchEntryDetails(entryId);
            else if (passedJobId) { setActiveJobId(passedJobId); setInitialLoading(false); }
            else await fetchActiveJob();
        };
        init();
    }, [entryId, passedJobId, fetchEntryDetails, fetchActiveJob]);

    // --- Time Handlers ---
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

    // --- Image Handlers ---
    const handleImagePick = async (source: 'camera' | 'gallery') => {
        const remaining = MAX_PHOTOS - images.length;
        if (remaining <= 0) {
            setAlertConfig({ visible: true, type: 'warning', title: 'Limit Reached', message: `Max ${MAX_PHOTOS} images allowed.`, confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }
        try {
            let result: ImagePicker.ImagePickerResult; 
            const options: ImagePicker.ImagePickerOptions = { 
                mediaTypes: ['images'], 
                quality: 0.7, 
                allowsEditing: true, 
                aspect: [4, 3] 
            };

            if (source === 'camera') {
                await ImagePicker.requestCameraPermissionsAsync();
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                result = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: false });
            }

            if (!result.canceled && result.assets) {
                setImages(prev => [...prev, result.assets[0].uri]);
                setIsDirty(true);
            }
        } catch { 
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Could not capture image.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
        }
    };

    const confirmDeleteImage = (idx: number) => {
        setAlertConfig({
            visible: true, type: 'confirm', title: 'Remove Image', message: 'Remove this image?', confirmText: 'Remove', cancelText: 'Cancel',
            onConfirm: () => {
                setImages(p => p.filter((_, i) => i !== idx)); 
                setIsDirty(true);
                setAlertConfig({ visible: false });
            },
            onCancel: () => setAlertConfig({ visible: false })
        });
    };

    // --- Save Handler ---
    const saveEntry = async () => {
        const hasTimeIn = !!timeIn;
        const hasTimeOut = !!timeOut;
        const hasTask = !!description.trim();

        if (!hasTask) {
            setErrors({ description: true });
            setAlertConfig({ visible: true, type: 'warning', title: 'Missing Info', message: 'Please enter a task description.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }

        if (showAttendanceBool) {
            if (!hasTimeIn || !hasTimeOut) {
                setAlertConfig({ visible: true, type: 'warning', title: 'Missing Info', message: 'Please provide both Time In and Time Out.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
                return;
            }
        }

        if (!activeJobId || !user?.id) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'No active job or user found.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }

        setLoading(true);
        try {
            const db = await getDB();
            const dateStr = format(selectedDate, 'yyyy-MM-dd'); 
            const now = new Date().toISOString();

            // 1. Create Attendance (If applicable)
            if (showAttendanceBool && timeIn && timeOut) {
                const cIn = new Date(selectedDate);
                cIn.setHours(timeIn.getHours(), timeIn.getMinutes(), 0, 0);

                const cOut = new Date(selectedDate);
                cOut.setHours(timeOut.getHours(), timeOut.getMinutes(), 0, 0);

                if (cOut < cIn) {
                    setAlertConfig({ visible: true, type: 'warning', title: 'Invalid Time', message: 'Time Out cannot be earlier than Time In on the same day.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
                    setLoading(false);
                    return;
                }

                const newAttId = generateUUID();
                const attRemarks = remarks.trim() ? `Manual Entry: ${remarks.trim()}` : 'Manual Entry';

                const newRecord = { 
                    id: newAttId, user_id: user.id, job_id: activeJobId, date: dateStr, 
                    clock_in: cIn.toISOString(), clock_out: cOut.toISOString(),
                    status: 'completed', remarks: attRemarks, updated_at: now 
                };

                await db.runAsync(
                    'INSERT INTO attendance (id, user_id, job_id, date, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
                    [newRecord.id, newRecord.user_id, newRecord.job_id, newRecord.date, newRecord.clock_in, newRecord.clock_out, newRecord.status, newRecord.remarks, newRecord.updated_at]
                );
                await queueSyncItem('attendance', newAttId, 'INSERT', newRecord);
            }

            // 2. Create/Update Task
            const processedImages = await Promise.all(images.map(async (uri) => {
                if (uri.startsWith('http') || !FileSystem.documentDirectory) return uri;
                const filename = uri.split('/').pop();
                const newPath = FileSystem.documentDirectory + filename;
                try { await FileSystem.copyAsync({ from: uri, to: newPath }); return newPath; } catch { return uri; }
            }));
            const imagesJson = JSON.stringify(processedImages);

            if (entryId) {
                const payload = { id: entryId, user_id: user.id, job_id: activeJobId, description: description.trim(), remarks: remarks.trim(), image_url: imagesJson, date: dateStr, updated_at: now };
                await db.runAsync('UPDATE accomplishments SET description = ?, remarks = ?, image_url = ?, date = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [payload.description, payload.remarks, payload.image_url, payload.date, payload.updated_at, entryId]);
                await queueSyncItem('accomplishments', entryId, 'UPDATE', payload);
            } else {
                const newId = generateUUID();
                const newRecord = { id: newId, user_id: user.id, job_id: activeJobId, date: dateStr, description: description.trim(), remarks: remarks.trim(), image_url: imagesJson, created_at: now, updated_at: now };
                await db.runAsync('INSERT INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)', [newRecord.id, newRecord.user_id, newRecord.job_id, newRecord.date, newRecord.description, newRecord.remarks, newRecord.image_url, newRecord.created_at, newRecord.updated_at]);
                await queueSyncItem('accomplishments', newId, 'INSERT', newRecord);
            }

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
    
    const isReadyToSave = isDirty && ((showAttendanceBool && timeIn && timeOut && description.trim()) || (!showAttendanceBool && description.trim()));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message="Saving entry..." />
            
            <DatePicker visible={showDatePicker} onClose={() => setShowDatePicker(false)} onSelect={(date) => { setSelectedDate(date); setIsDirty(true); setShowDatePicker(false); }} selectedDate={selectedDate} title="Select Entry Date" />
            
            <TimePicker visible={showTimeInPicker} onClose={() => setShowTimeInPicker(false)} onConfirm={handleTimeConfirm(setTimeIn)} title="Select Time In" initialHours={timeInVals.h} initialMinutes={timeInVals.m} initialPeriod={timeInVals.p} />
            <TimePicker visible={showTimeOutPicker} onClose={() => setShowTimeOutPicker(false)} onConfirm={handleTimeConfirm(setTimeOut)} title="Select Time Out" initialHours={timeOutVals.h} initialMinutes={timeOutVals.m} initialPeriod={timeOutVals.p} />

            <Header title={entryId ? 'Edit Entry' : 'Add Entry'} />

            {initialLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        
                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                Date <Text style={{ color: '#ef4444' }}>*</Text>
                            </Text>
                            <View style={{ position: 'relative' }}>
                                <TouchableOpacity disabled={!canEditDate} activeOpacity={canEditDate ? 0.7 : 1} onPress={() => setShowDatePicker(true)}>
                                    <View style={{ 
                                        flexDirection: 'row', alignItems: 'center', 
                                        backgroundColor: canEditDate ? theme.colors.card : theme.colors.background, 
                                        borderRadius: 16, borderWidth: 1, 
                                        borderColor: theme.colors.border,
                                        height: 56, paddingHorizontal: 16 
                                    }}>
                                        <HugeiconsIcon icon={Calendar03Icon} size={22} color={canEditDate ? theme.colors.primary : theme.colors.textSecondary} />
                                        
                                        <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Nunito_500Medium', color: theme.colors.text }}>
                                            {format(selectedDate, 'MMMM d, yyyy')}
                                        </Text>
                                        
                                        {canEditDate && <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} />}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {showAttendanceBool && (
                            <View style={styles.inputBlock}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Attendance Record</Text>
                                <View style={[styles.sessionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <View style={styles.sessionCardBody}>
                                        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowTimeInPicker(true)} style={styles.sessionTimeCol}>
                                            <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME IN <Text style={{color: '#ef4444'}}>*</Text></Text>
                                            <View style={styles.sessionValueRow}>
                                                <Text style={[styles.sessionTimeValue, { color: timeIn ? theme.colors.text : theme.colors.textSecondary }]}>
                                                    {timeIn ? format(timeIn, 'h:mm a') : '--:--'}
                                                </Text>
                                                <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} />
                                            </View>
                                        </TouchableOpacity>
                                        
                                        <View style={[styles.sessionCardDivider, { backgroundColor: theme.colors.border }]} />
                                        
                                        <TouchableOpacity activeOpacity={0.7} onPress={() => setShowTimeOutPicker(true)} style={styles.sessionTimeCol}>
                                            <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME OUT <Text style={{color: '#ef4444'}}>*</Text></Text>
                                            <View style={styles.sessionValueRow}>
                                                <Text style={[styles.sessionTimeValue, { color: timeOut ? theme.colors.text : theme.colors.textSecondary }]}>
                                                    {timeOut ? format(timeOut, 'h:mm a') : '--:--'}
                                                </Text>
                                                <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} />
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )}

                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                Task Description <Text style={{color: '#ef4444'}}>*</Text>
                            </Text>
                            <View style={[styles.inputWrapper, { borderColor: errors.description ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <TextInput style={[styles.textInput, { color: theme.colors.text }]} placeholder="What did you accomplish?" placeholderTextColor={theme.colors.textSecondary} value={description} onChangeText={(t) => { setDescription(t); setIsDirty(true); setErrors({description: false}); }} maxLength={255} />
                            </View>
                        </View>

                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Remarks (Optional)</Text>
                            <View style={[styles.inputWrapper, styles.textAreaWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <TextInput style={[styles.textInput, styles.textArea, { color: theme.colors.text }]} placeholder="Add any additional details or notes..." placeholderTextColor={theme.colors.textSecondary} value={remarks} onChangeText={(t) => { setRemarks(t); setIsDirty(true); }} multiline textAlignVertical="top" />
                            </View>
                        </View>

                        <View style={styles.inputBlock}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={[styles.label, { marginBottom: 0, color: theme.colors.textSecondary }]}>Attachments</Text>
                                <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary }}>{images.length} / {MAX_PHOTOS}</Text>
                            </View>

                            {images.length < MAX_PHOTOS && (
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: images.length > 0 ? 16 : 0 }}>
                                    <TouchableOpacity onPress={() => handleImagePick('camera')} style={[styles.uploadBtnRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                        <HugeiconsIcon icon={Camera01Icon} size={18} color={theme.colors.primary} />
                                        <Text style={[styles.uploadBtnText, { color: theme.colors.text }]}>Camera</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleImagePick('gallery')} style={[styles.uploadBtnRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                        <HugeiconsIcon icon={Image01Icon} size={18} color={theme.colors.primary} />
                                        <Text style={[styles.uploadBtnText, { color: theme.colors.text }]}>Gallery</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {images.length > 0 && (
                                <View style={{ gap: 16 }}>
                                    {images.map((uri, idx) => (
                                        <View key={idx} style={[styles.imagePreviewWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                            <Image source={{ uri }} style={styles.imagePreview} resizeMode="cover" />
                                            <TouchableOpacity onPress={() => confirmDeleteImage(idx)} style={styles.removeImageBtn} activeOpacity={0.8}>
                                                <HugeiconsIcon icon={Delete02Icon} size={18} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            )}
            
            {isDirty && (
                <Footer>
                    <Button title={entryId ? 'Update Entry' : 'Save Entry'} onPress={saveEntry} isLoading={loading} disabled={loading || !isReadyToSave} style={{ width: '100%' }} />
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
    label: { fontSize: 11, fontFamily: 'Nunito_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 56 },
    textInput: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 15, paddingVertical: 16 },
    textAreaWrapper: { alignItems: 'flex-start', minHeight: 120 },
    textArea: { height: 100, paddingTop: 16 },
    uploadBtnRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
    uploadBtnText: { marginLeft: 8, fontFamily: 'Nunito_500Medium', fontSize: 13 },
    imagePreviewWrapper: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative' },
    imagePreview: { width: '100%', height: '100%' },
    removeImageBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },

    sessionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    sessionCardBody: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    sessionTimeCol: { flex: 1 },
    sessionTimeLabel: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
    sessionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sessionTimeValue: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },
    sessionCardDivider: { width: 1, height: 32, marginHorizontal: 16, opacity: 0.5 },
});
