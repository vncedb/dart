import {
    Calendar03Icon,
    Camera01Icon,
    CheckmarkCircle02Icon, // Icon Only
    Delete02Icon,
    Image01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
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
const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 36) / 4; 

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
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

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

    const handleImagePick = async (source: 'camera' | 'gallery') => {
        const remaining = MAX_PHOTOS - images.length;
        if (remaining <= 0) return;
        
        try {
            let result: ImagePicker.ImagePickerResult; 
            if (source === 'camera') {
                await ImagePicker.requestCameraPermissionsAsync();
                result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: true });
            } else {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsMultipleSelection: true, selectionLimit: remaining });
            }

            if (!result.canceled && result.assets) {
                const newUris = result.assets.map(a => a.uri);
                setImages(prev => [...prev, ...newUris].slice(0, MAX_PHOTOS));
                setIsDirty(true);
            }
        } catch (e) { Alert.alert("Error", "Could not capture image."); }
    };

    const saveEntry = async () => {
        if (!description.trim()) {
            setErrors({ description: true });
            return;
        }
        if (!activeJobId) {
            Alert.alert("Error", "No active job context found.");
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
        } catch (e: any) { Alert.alert("Error", e.message); } finally { setLoading(false); }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message="Saving entry..." />
            
            {/* UPDATED HEADER: Icon-Only Save Button */}
            <Header 
                title={entryId ? 'Edit Task' : 'New Task'} 
                rightElement={
                    <TouchableOpacity 
                        onPress={saveEntry} 
                        disabled={initialLoading} 
                        style={{ 
                            backgroundColor: theme.colors.primary, 
                            width: 36, 
                            height: 36, 
                            borderRadius: 18, 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            shadowColor: theme.colors.primary,
                            shadowOpacity: 0.3,
                            shadowRadius: 4,
                            elevation: 2
                        }}
                    >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="#fff" />
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
                                    padding: 16, 
                                    borderRadius: 16, 
                                    borderWidth: 1.5, 
                                    borderColor: errors.description ? theme.colors.danger : theme.colors.border,
                                    fontSize: 16,
                                    fontWeight: '500'
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
                                    padding: 16, 
                                    borderRadius: 16, 
                                    borderWidth: 1, 
                                    borderColor: theme.colors.border, 
                                    minHeight: 120,
                                    fontSize: 15,
                                    lineHeight: 22
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

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                            {images.map((uri, idx) => (
                                <View key={idx} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
                                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    <TouchableOpacity onPress={() => { setImages(p => p.filter((_, i) => i !== idx)); setIsDirty(true); }} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 20 }}>
                                        <HugeiconsIcon icon={Delete02Icon} size={12} color="#fff" />
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