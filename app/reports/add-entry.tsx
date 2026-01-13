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
import * as FileSystem from 'expo-file-system'; // FIXED: Import as namespace
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
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { generateUUID } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

const MAX_PHOTOS = 5;
const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 20) / 3; // 3 columns, padding calculations

export default function AddEntry() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    
    // Accept jobId param to ensure we save to the correct context
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
            if (passedJobId) {
                setActiveJobId(passedJobId);
                setInitialLoading(false);
            } else {
                fetchActiveJob();
            }
        }
    }, [entryId, passedJobId]);

    const fetchActiveJob = async () => {
        try {
            const db = await getDB();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const profile = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [session.user.id]);
                if (profile && (profile as any).current_job_id) {
                    setActiveJobId((profile as any).current_job_id);
                } else {
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

    const handleImagePick = async (source: 'camera' | 'gallery') => {
        const remaining = MAX_PHOTOS - images.length;
        if (remaining <= 0) {
            Alert.alert("Limit Reached", `Max ${MAX_PHOTOS} photos allowed.`);
            return;
        }
        
        try {
            // FIXED: Explicit type definition
            let result: ImagePicker.ImagePickerResult; 
            
            if (source === 'camera') {
                await ImagePicker.requestCameraPermissionsAsync();
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.7,
                });
                
                if (!result.canceled && result.assets[0].uri) {
                    setImages(prev => [...prev, result.assets![0].uri]);
                    setIsDirty(true);
                }
            } else {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.7,
                    allowsMultipleSelection: true, 
                    selectionLimit: remaining,    
                });

                if (!result.canceled && result.assets) {
                    const newUris = result.assets.map(a => a.uri);
                    setImages(prev => [...prev, ...newUris].slice(0, MAX_PHOTOS));
                    setIsDirty(true);
                }
            }
        } catch (e) {
            console.log(e); // Used 'e' to avoid ESLint unused var warning
            Alert.alert("Error", "Could not capture image.");
        }
    };

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
            const processedImages = await Promise.all(images.map(async (uri) => {
                // FIXED: Use FileSystem.documentDirectory
                if (uri.startsWith('http') || !FileSystem.documentDirectory) return uri;
                const filename = uri.split('/').pop();
                const newPath = FileSystem.documentDirectory + filename;
                try {
                    // FIXED: Use FileSystem.copyAsync
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
            triggerSync(); 
            router.back(); 
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={theme.colors.icon} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>
                    {entryId ? 'Edit Entry' : 'New Entry'}
                </Text>
                <TouchableOpacity 
                    onPress={saveEntry} 
                    disabled={initialLoading} 
                    style={{ backgroundColor: theme.colors.primary, padding: 8, borderRadius: 50, shadowColor: theme.colors.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {initialLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 50 }}>
                        
                        {/* Date Display */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, opacity: 0.8 }}>
                            <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.primary} />
                            <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '600', fontSize: 16 }}>
                                {format(new Date(), 'EEEE, MMMM d')}
                            </Text>
                        </View>

                        {/* Description Field */}
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description <Text style={{color: 'red'}}>*</Text></Text>
                            <TextInput
                                value={description}
                                onChangeText={(t) => { setDescription(t); setIsDirty(true); setErrors({description: false}); }}
                                placeholder="What did you work on?"
                                placeholderTextColor={theme.colors.textSecondary + '80'}
                                style={{ 
                                    backgroundColor: theme.colors.card, 
                                    color: theme.colors.text, 
                                    padding: 16, 
                                    borderRadius: 16, 
                                    borderWidth: 1.5, 
                                    borderColor: errors.description ? '#ef4444' : theme.colors.border,
                                    fontSize: 16,
                                    minHeight: 56
                                }}
                            />
                        </View>

                        {/* Remarks Field */}
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remarks (Optional)</Text>
                            <TextInput
                                value={remarks}
                                onChangeText={(t) => { setRemarks(t); setIsDirty(true); }}
                                placeholder="Add extra details..."
                                placeholderTextColor={theme.colors.textSecondary + '80'}
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

                        {/* Photos Section */}
                        <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Photos</Text>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{images.length} / {MAX_PHOTOS}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                            <TouchableOpacity 
                                onPress={() => handleImagePick('camera')} 
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}
                            >
                                <HugeiconsIcon icon={Camera01Icon} size={20} color={theme.colors.primary} />
                                <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '700' }}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => handleImagePick('gallery')} 
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}
                            >
                                <HugeiconsIcon icon={Image01Icon} size={20} color={theme.colors.primary} />
                                <Text style={{ marginLeft: 8, color: theme.colors.text, fontWeight: '700' }}>Gallery</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Image Grid */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {images.map((uri, idx) => (
                                <View key={idx} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.colors.card, position: 'relative' }}>
                                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    <TouchableOpacity 
                                        onPress={() => { setImages(p => p.filter((_, i) => i !== idx)); setIsDirty(true); }}
                                        style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 }}
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={14} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {/* Empty Placeholders for better grid alignment visual */}
                            {[...Array(Math.max(0, MAX_PHOTOS - images.length))].map((_, i) => (
                                <View key={`empty-${i}`} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                    {i === 0 && <Text style={{fontSize: 10, color: theme.colors.textSecondary}}>Empty</Text>}
                                </View>
                            ))}
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}