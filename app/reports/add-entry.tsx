import {
    Calendar03Icon,
    Camera01Icon,
    Delete02Icon,
    Image01Icon,
    PencilEdit02Icon,
    Tick01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext'; // <-- ADDED: Local offline auth
import { useSync } from '../../context/SyncContext';
import { generateUUID, queueSyncItem } from '../../lib/database'; // <-- ADDED: Sync Queue helper
import { getDB } from '../../lib/db-client';

const MAX_PHOTOS = 4;

export default function AddEntryScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { user } = useAuth(); // <-- FETCH USER LOCALLY
    const { triggerSync } = useSync();
    
    // Params: 'id' (from Timeline Edit), 'jobId' (from Home Add), 'date' (from Reports Add)
    const { id, jobId, date: paramDate } = useLocalSearchParams();
    const entryId = Array.isArray(id) ? id[0] : id; 
    const passedJobId = Array.isArray(jobId) ? jobId[0] : jobId;
    
    // RULE: If we have an explicit ID (Timeline) or JobID (Home Action), lock the Date.
    // If navigating directly from the Reports tab, allow Date editing.
    const canEditDate = !passedJobId && !entryId;
    
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date>(paramDate ? new Date(paramDate as string) : new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [errors, setErrors] = useState({ description: false });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Warn on unsaved changes
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Discard Changes?',
                message: 'You have unsaved changes. Are you sure you want to leave?',
                confirmText: 'Discard',
                cancelText: 'Keep Editing',
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

    // Initialize logic
    useEffect(() => {
        const init = async () => {
            if (entryId) {
                await fetchEntryDetails(entryId);
            } else {
                if (passedJobId) {
                    setActiveJobId(passedJobId);
                    setInitialLoading(false);
                } else {
                    await fetchActiveJob();
                }
            }
        };
        init();
    }, [entryId, passedJobId, user]);

    // 🔴 OFFLINE-FIRST FIX: Read from local SQLite instead of Supabase
    const fetchActiveJob = async () => {
        if (!user) return;
        try {
            const db = await getDB();
            const profile = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);
            if (profile && (profile as any).current_job_id) {
                setActiveJobId((profile as any).current_job_id);
            }
        } catch (e) { console.log(e); } finally { setInitialLoading(false); }
    };

    const fetchEntryDetails = async (id: string) => {
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
                    } catch { setImages([entry.image_url]); }
                }
                setIsDirty(false);
            }
        } catch (e) { console.error(e); } finally { setInitialLoading(false); }
    };

    const handleImagePick = async (source: 'camera' | 'gallery') => {
        const remaining = MAX_PHOTOS - images.length;
        if (remaining <= 0) {
            setAlertConfig({
                visible: true, type: 'warning', title: 'Limit Reached', message: `You can only add up to ${MAX_PHOTOS} images.`, confirmText: 'Okay', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
            return;
        }
        
        try {
            let result: ImagePicker.ImagePickerResult; 
            const options: ImagePicker.ImagePickerOptions = {
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: true,
                aspect: [4, 3], 
            };

            if (source === 'camera') {
                await ImagePicker.requestCameraPermissionsAsync();
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                result = await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: false });
            }

            if (!result.canceled && result.assets) {
                const newUri = result.assets[0].uri;
                setImages(prev => [...prev, newUri]);
                setIsDirty(true);
            }
        } catch (e) { 
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Could not capture image.', confirmText: 'Okay', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) });
        }
    };

    const confirmDeleteImage = (idx: number) => {
        setAlertConfig({
            visible: true, type: 'confirm', title: 'Remove Image', message: 'Are you sure you want to remove this image?', confirmText: 'Remove', cancelText: 'Cancel',
            onConfirm: () => {
                setImages(p => p.filter((_, i) => i !== idx)); 
                setIsDirty(true);
                setAlertConfig((p: any) => ({ ...p, visible: false }));
            },
            onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
        });
    };

    // 🔴 OFFLINE-FIRST FIX: Write straight to SQLite and background sync queue
    const saveEntry = async () => {
        if (!description.trim()) {
            setErrors({ description: true });
            setAlertConfig({ visible: true, type: 'warning', title: 'Missing Info', message: 'Please enter a description for this entry.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }
        if (!activeJobId) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'No active job context found. Please ensure you have a job selected.', confirmText: 'Okay', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) });
            return;
        }

        setLoading(true);
        try {
            // Photos are cached locally. Our Background Sync Engine will handle the Cloud upload.
            const processedImages = await Promise.all(images.map(async (uri) => {
                if (uri.startsWith('http')) return uri;
                if (!FileSystem.documentDirectory) return uri;
                
                const filename = uri.split('/').pop();
                const newPath = FileSystem.documentDirectory + filename;
                try {
                    await FileSystem.copyAsync({ from: uri, to: newPath });
                    return newPath;
                } catch { return uri; }
            }));
            
            const imagesJson = JSON.stringify(processedImages);
            const now = new Date().toISOString();
            const dateStr = format(selectedDate, 'yyyy-MM-dd'); 
            
            const db = await getDB();
            if (!user) throw new Error("Authentication context lost.");

            if (entryId) {
                const payload = { 
                    id: entryId, user_id: user.id, job_id: activeJobId, 
                    description: description.trim(), remarks: remarks.trim(), 
                    image_url: imagesJson, date: dateStr, updated_at: now 
                };

                await db.runAsync(
                    'UPDATE accomplishments SET description = ?, remarks = ?, image_url = ?, date = ?, updated_at = ?, is_synced = 0 WHERE id = ?',
                    [payload.description, payload.remarks, payload.image_url, payload.date, payload.updated_at, entryId]
                );
                await queueSyncItem('accomplishments', entryId, 'UPDATE', payload);

            } else {
                const newId = generateUUID();
                const newRecord = { 
                    id: newId, user_id: user.id, job_id: activeJobId, 
                    date: dateStr, description: description.trim(), 
                    remarks: remarks.trim(), image_url: imagesJson, 
                    created_at: now, updated_at: now 
                };

                await db.runAsync(
                    'INSERT INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
                    [newRecord.id, newRecord.user_id, newRecord.job_id, newRecord.date, newRecord.description, newRecord.remarks, newRecord.image_url, newRecord.created_at, newRecord.updated_at]
                );
                await queueSyncItem('accomplishments', newId, 'INSERT', newRecord);
            }

            setIsDirty(false);
            triggerSync(); // Will attempt network push in background
            router.back(); 

        } catch (e: any) { 
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message || 'An error occurred while saving locally.', confirmText: 'Okay', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })) });
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message="Saving entry..." />
            
            <DatePicker 
                visible={showDatePicker} 
                onClose={() => setShowDatePicker(false)} 
                onSelect={(date) => { setSelectedDate(date); setIsDirty(true); setShowDatePicker(false); }} 
                selectedDate={selectedDate} 
                title="Select Entry Date" 
            />

            <Header title={entryId ? 'Edit Entry' : 'New Entry'} />

            {initialLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        
                        {/* Dynamic Date Field */}
                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Date</Text>
                            <TouchableOpacity 
                                activeOpacity={canEditDate ? 0.7 : 1}
                                onPress={() => canEditDate && setShowDatePicker(true)} 
                                style={[
                                    styles.inputWrapper, 
                                    { borderColor: theme.colors.border, backgroundColor: theme.colors.card }
                                ]}
                            >
                                <View style={styles.dateRow}>
                                    <HugeiconsIcon icon={Calendar03Icon} size={20} color={canEditDate ? theme.colors.primary : theme.colors.textSecondary} />
                                    <Text style={[styles.dateText, { color: theme.colors.text }]}>
                                        {format(selectedDate, 'MMMM d, yyyy')}
                                    </Text>
                                </View>
                                {canEditDate && (
                                    <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.textSecondary} />
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Description Field */}
                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Description <Text style={{color: theme.colors.danger}}>*</Text></Text>
                            <View style={[styles.inputWrapper, { borderColor: errors.description ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <TextInput
                                    style={[styles.textInput, { color: theme.colors.text }]}
                                    placeholder="What did you accomplish?"
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={description}
                                    onChangeText={(t) => { setDescription(t); setIsDirty(true); setErrors({description: false}); }}
                                    maxLength={255}
                                />
                            </View>
                        </View>

                        {/* Remarks Field */}
                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Remarks (Optional)</Text>
                            <View style={[styles.inputWrapper, styles.textAreaWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <TextInput
                                    style={[styles.textInput, styles.textArea, { color: theme.colors.text }]}
                                    placeholder="Add any additional details or notes..."
                                    placeholderTextColor={theme.colors.textSecondary}
                                    value={remarks}
                                    onChangeText={(t) => { setRemarks(t); setIsDirty(true); }}
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        {/* Attachments Section */}
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
            
            <Footer>
                <Button 
                    title={entryId ? 'Update Entry' : 'Save Entry'} 
                    onPress={saveEntry} 
                    isLoading={loading} 
                    disabled={loading || !description.trim()}
                    style={{ width: '100%' }}
                    icon={<HugeiconsIcon icon={Tick01Icon} size={20} color="#fff" strokeWidth={2.5} />}
                />
            </Footer>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 100 },
    
    inputBlock: { 
        marginBottom: 24 
    },
    label: { 
        fontSize: 11, 
        fontFamily: 'Nunito_500Medium', 
        textTransform: 'uppercase', 
        letterSpacing: 0.8,
        marginBottom: 8, 
        marginLeft: 4 
    },
    inputWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderWidth: 1, 
        borderRadius: 16, 
        paddingHorizontal: 16, 
        minHeight: 56 
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    dateText: {
        fontFamily: 'Nunito_500Medium', 
        fontSize: 15, 
        marginLeft: 12
    },
    textInput: { 
        flex: 1, 
        fontFamily: 'Nunito_500Medium', 
        fontSize: 15, 
        paddingVertical: 16,
    },
    textAreaWrapper: { 
        alignItems: 'flex-start',
        minHeight: 120 
    },
    textArea: { 
        height: 100, 
        paddingTop: 16 
    },

    uploadBtnRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    uploadBtnText: {
        marginLeft: 8,
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
    },
    imagePreviewWrapper: {
        width: '100%',
        aspectRatio: 4 / 3,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    removeImageBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 20,
    }
});