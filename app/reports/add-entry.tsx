import {
    Calendar03Icon,
    Camera01Icon,
    CheckmarkCircle03Icon,
    Delete02Icon,
    Image01Icon
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
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { generateUUID } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

const MAX_PHOTOS = 4;

export default function AddEntry() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { id, jobId } = useLocalSearchParams();
    
    const entryId = Array.isArray(id) ? id[0] : id; 
    const passedJobId = Array.isArray(jobId) ? jobId[0] : jobId;

    const { triggerSync } = useSync();
    
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    const [errors, setErrors] = useState({ description: false });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    
    // Alert Configuration
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // 1. Navigation Guard
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

    // 2. Data Loading
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
    }, [entryId, passedJobId]);

    const fetchActiveJob = async () => {
        try {
            const db = await getDB();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const profile = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [session.user.id]);
                if (profile && (profile as any).current_job_id) {
                    setActiveJobId((profile as any).current_job_id);
                }
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

    // 3. Image Handling
    const handleImagePick = async (source: 'camera' | 'gallery') => {
        const remaining = MAX_PHOTOS - images.length;
        if (remaining <= 0) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Limit Reached',
                message: 'You can only add up to 4 images.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
            return;
        }
        
        try {
            let result: ImagePicker.ImagePickerResult; 
            const options: ImagePicker.ImagePickerOptions = {
                // FIXED: Using MediaTypeOptions to satisfy current installed version
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
        } catch (_) { // FIXED: Removed unused variable
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Error',
                message: 'Could not capture image.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        }
    };

    const confirmDeleteImage = (idx: number) => {
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: 'Remove Image',
            message: 'Are you sure you want to remove this image?',
            confirmText: 'Remove',
            cancelText: 'Cancel',
            onConfirm: () => {
                setImages(p => p.filter((_, i) => i !== idx)); 
                setIsDirty(true);
                setAlertConfig((p: any) => ({ ...p, visible: false }));
            },
            onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
        });
    };

    // 4. Save Entry
    const saveEntry = async () => {
        if (!description.trim()) {
            setErrors({ description: true });
            return;
        }
        if (!activeJobId) {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Error',
                message: 'No active job context found. Please ensure you have a job selected.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
            return;
        }

        setLoading(true);
        try {
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
            const dateStr = format(new Date(), 'yyyy-MM-dd');
            const db = await getDB();
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) throw new Error("Auth error");

            if (entryId) {
                await db.runAsync(
                    'UPDATE accomplishments SET description = ?, remarks = ?, image_url = ?, updated_at = ? WHERE id = ?',
                    [description, remarks, imagesJson, now, entryId]
                );
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['accomplishments', entryId, 'UPDATE', JSON.stringify({ description, remarks, image_url: imagesJson, updated_at: now })]
                );
            } else {
                const newId = generateUUID();
                const newRecord = { id: newId, user_id: userId, job_id: activeJobId, date: dateStr, description, remarks, image_url: imagesJson, created_at: now, updated_at: now };

                await db.runAsync(
                    'INSERT INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [newRecord.id, userId, activeJobId, dateStr, description, remarks, imagesJson, now, now]
                );
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['accomplishments', newId, 'INSERT', JSON.stringify(newRecord)]
                );
            }

            setIsDirty(false);
            triggerSync(); 
            router.back(); 
        } catch (e: any) { 
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Save Failed',
                message: e.message || 'An error occurred while saving.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message="Saving entry..." />
            
            <Header 
                title={entryId ? 'Edit Task' : 'New Task'} 
                rightElement={
                    <TouchableOpacity 
                        onPress={saveEntry} 
                        disabled={initialLoading} 
                        style={{ 
                            backgroundColor: theme.colors.primary, 
                            width: 36, height: 36, borderRadius: 18, 
                            alignItems: 'center', justifyContent: 'center',
                            shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2
                        }}
                    >
                        <HugeiconsIcon icon={CheckmarkCircle03Icon} size={20} color="#fff" />
                    </TouchableOpacity>
                }
            />

            {initialLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, opacity: 0.6 }}>
                            <HugeiconsIcon icon={Calendar03Icon} size={16} color={theme.colors.text} />
                            <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '600', fontSize: 14 }}>
                                {format(new Date(), 'MMMM d, yyyy')}
                            </Text>
                        </View>

                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' }}>Task Description</Text>
                            <TextInput
                                value={description}
                                onChangeText={(t) => { setDescription(t); setIsDirty(true); setErrors({description: false}); }}
                                placeholder="What did you accomplish?"
                                placeholderTextColor={theme.colors.textSecondary}
                                style={{ 
                                    backgroundColor: theme.colors.card, 
                                    color: theme.colors.text, 
                                    padding: 16, borderRadius: 16, borderWidth: 1.5, 
                                    borderColor: errors.description ? theme.colors.danger : theme.colors.border,
                                    fontSize: 16, fontWeight: '500'
                                }}
                            />
                        </View>

                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' }}>Remarks</Text>
                            <TextInput
                                value={remarks}
                                onChangeText={(t) => { setRemarks(t); setIsDirty(true); }}
                                placeholder="Additional details (optional)..."
                                placeholderTextColor={theme.colors.textSecondary}
                                multiline
                                textAlignVertical="top"
                                style={{ 
                                    backgroundColor: theme.colors.card, 
                                    color: theme.colors.text, 
                                    padding: 16, borderRadius: 16, borderWidth: 1, 
                                    borderColor: theme.colors.border, 
                                    minHeight: 120, fontSize: 15, lineHeight: 22
                                }}
                            />
                        </View>

                        <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Attachments</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{images.length} / {MAX_PHOTOS}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                            <TouchableOpacity onPress={() => handleImagePick('camera')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border }}>
                                <HugeiconsIcon icon={Camera01Icon} size={18} color={theme.colors.primary} />
                                <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleImagePick('gallery')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border }}>
                                <HugeiconsIcon icon={Image01Icon} size={18} color={theme.colors.primary} />
                                <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>Gallery</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ gap: 16 }}>
                            {images.map((uri, idx) => (
                                <View 
                                    key={idx} 
                                    style={{ 
                                        width: '100%', 
                                        aspectRatio: 4/3,
                                        borderRadius: 16, 
                                        overflow: 'hidden', 
                                        backgroundColor: theme.colors.card, 
                                        borderWidth: 1, 
                                        borderColor: theme.colors.border, 
                                        position: 'relative' 
                                    }}
                                >
                                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    <TouchableOpacity 
                                        onPress={() => confirmDeleteImage(idx)} 
                                        style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 }}
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}