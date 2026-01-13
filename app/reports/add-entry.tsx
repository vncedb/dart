import {
    ArrowLeft02Icon,
    Calendar03Icon,
    Camera01Icon,
    CheckmarkCircle02Icon,
    Delete02Icon,
    Image01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import { copyAsync, documentDirectory } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { generateUUID } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

const MAX_PHOTOS = 5;

export default function AddEntry() {
    const router = useRouter();
    const navigation = useNavigation();
    const { id } = useLocalSearchParams();
    const entryId = Array.isArray(id) ? id[0] : id; // Handle array case safely

    const theme = useAppTheme();
    const { triggerSync } = useSync();
    
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    const [errors, setErrors] = useState({ description: false });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Prevent going back with unsaved changes
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Unsaved Changes',
                message: 'Discard your changes?',
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

    // Load Data on Mount
    useEffect(() => {
        if (entryId) {
            fetchEntryDetails(entryId);
        } else {
            fetchActiveJob();
        }
    }, [entryId]);

    const fetchActiveJob = async () => {
        try {
            const db = await getDB();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // 1. Try to get specific active job from profile
                const profile = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [session.user.id]);
                if (profile && (profile as any).current_job_id) {
                    setActiveJobId((profile as any).current_job_id);
                } else {
                    // 2. Fallback: Get the most recently created job
                    const anyJob = await db.getFirstAsync('SELECT id FROM job_positions ORDER BY created_at DESC LIMIT 1');
                    if (anyJob) {
                        setActiveJobId((anyJob as any).id);
                    }
                }
            }
        } catch (e) {
            console.log("Error fetching job:", e);
        } finally {
            setInitialLoading(false);
        }
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

    // --- Image Logic ---
    const handleImagePick = async (source: 'camera' | 'gallery') => {
        if (images.length >= MAX_PHOTOS) {
            Alert.alert("Limit Reached", `Max ${MAX_PHOTOS} photos allowed.`);
            return;
        }
        
        try {
            let result;
            if (source === 'camera') {
                await ImagePicker.requestCameraPermissionsAsync();
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.7,
                });
            } else {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.7,
                });
            }

            if (!result.canceled && result.assets[0].uri) {
                setImages(prev => [...prev, result.assets[0].uri]);
                setIsDirty(true);
            }
        } catch (e) {
            Alert.alert("Error", "Could not capture image.");
        }
    };

    // --- Save Logic ---
    const saveEntry = async () => {
        if (!description.trim()) {
            setErrors({ description: true });
            return;
        }
        if (!activeJobId) {
            Alert.alert("No Job Found", "Please create or select a job in your profile first.");
            return;
        }

        setLoading(true);
        try {
            // 1. Process Images (Save to local app storage)
            const processedImages = await Promise.all(images.map(async (uri) => {
                if (uri.startsWith('http') || !documentDirectory) return uri;
                const filename = uri.split('/').pop();
                const newPath = documentDirectory + filename;
                try {
                    await copyAsync({ from: uri, to: newPath });
                    return newPath;
                } catch { return uri; }
            }));
            
            const imagesJson = JSON.stringify(processedImages);
            const now = new Date().toISOString();
            const dateStr = format(new Date(), 'yyyy-MM-dd'); // Standard Date Format
            const db = await getDB();
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            if (!userId) throw new Error("User not authenticated");

            if (entryId) {
                // UPDATE
                await db.runAsync(
                    'UPDATE accomplishments SET description = ?, remarks = ?, image_url = ?, updated_at = ? WHERE id = ?',
                    [description, remarks, imagesJson, now, entryId]
                );
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['accomplishments', entryId, 'UPDATE', JSON.stringify({ description, remarks, image_url: imagesJson, updated_at: now })]
                );
            } else {
                // INSERT
                const newId = generateUUID();
                const newRecord = {
                    id: newId,
                    user_id: userId,
                    job_id: activeJobId,
                    date: dateStr,
                    description,
                    remarks,
                    image_url: imagesJson,
                    created_at: now,
                    updated_at: now
                };

                await db.runAsync(
                    'INSERT INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [newId, userId, activeJobId, dateStr, description, remarks, imagesJson, now, now]
                );
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['accomplishments', newId, 'INSERT', JSON.stringify(newRecord)]
                );
            }

            setIsDirty(false);
            triggerSync(); // Background sync
            router.back(); // Return immediately
        } catch (e: any) {
            Alert.alert("Save Failed", e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message="Saving..." />
            
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={theme.colors.icon} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text }}>
                    {entryId ? 'Edit Entry' : 'New Entry'}
                </Text>
                <TouchableOpacity onPress={saveEntry} disabled={initialLoading} style={{ backgroundColor: theme.colors.primary + '20', padding: 8, borderRadius: 20 }}>
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {initialLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        {/* Date Badge */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border }}>
                            <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.primary} />
                            <Text style={{ marginLeft: 10, color: theme.colors.text, fontWeight: '600' }}>
                                {format(new Date(), 'MMMM d, yyyy')}
                            </Text>
                        </View>

                        {/* Description */}
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}>Description *</Text>
                        <TextInput
                            value={description}
                            onChangeText={(t) => { setDescription(t); setIsDirty(true); setErrors({description: false}); }}
                            placeholder="What did you work on?"
                            placeholderTextColor={theme.colors.textSecondary}
                            style={{ backgroundColor: theme.colors.card, color: theme.colors.text, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: errors.description ? 'red' : theme.colors.border, marginBottom: 20, fontSize: 16 }}
                        />

                        {/* Remarks */}
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}>Remarks (Optional)</Text>
                        <TextInput
                            value={remarks}
                            onChangeText={(t) => { setRemarks(t); setIsDirty(true); }}
                            placeholder="Extra details..."
                            placeholderTextColor={theme.colors.textSecondary}
                            multiline
                            textAlignVertical="top"
                            style={{ backgroundColor: theme.colors.card, color: theme.colors.text, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20, minHeight: 100 }}
                        />

                        {/* Photos */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>Photos</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{images.length} / {MAX_PHOTOS}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            <TouchableOpacity onPress={() => handleImagePick('camera')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                                <HugeiconsIcon icon={Camera01Icon} size={20} color={theme.colors.primary} />
                                <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '600' }}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleImagePick('gallery')} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                                <HugeiconsIcon icon={Image01Icon} size={20} color={theme.colors.primary} />
                                <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '600' }}>Gallery</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ gap: 12 }}>
                            {images.map((uri, idx) => (
                                <View key={idx} style={{ height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
                                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    <TouchableOpacity 
                                        onPress={() => { setImages(p => p.filter((_, i) => i !== idx)); setIsDirty(true); }}
                                        style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,0,0,0.8)', padding: 8, borderRadius: 20 }}
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={16} color="#fff" />
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