import {
  ArrowLeft02Icon,
  Calendar03Icon,
  Camera01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Image01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns'; // Ensure this is imported
import * as FileSystem from 'expo-file-system';
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
    const theme = useAppTheme();
    const { triggerSync } = useSync();
    
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [images, setImages] = useState<string[]>([]);
    
    const [errors, setErrors] = useState({ description: false });
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Initializing...');
    const [initialLoading, setInitialLoading] = useState(false);
    
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [isDirty, setIsDirty] = useState(false);

    // --- NAVIGATION PROTECTION ---
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading) {
                e.preventDefault();
                return;
            }
            if (isDirty) {
                e.preventDefault();
                setAlertConfig({
                    visible: true,
                    type: 'warning',
                    title: 'Unsaved Changes',
                    message: 'You have unsaved changes. Do you want to discard them?',
                    confirmText: 'Discard',
                    cancelText: 'Keep Editing',
                    onConfirm: () => {
                        setAlertConfig((p: any) => ({ ...p, visible: false }));
                        setIsDirty(false); 
                        setTimeout(() => navigation.dispatch(e.action), 0);
                    },
                    onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
                });
            }
        });
        return unsubscribe;
    }, [navigation, loading, isDirty]);

    // --- FETCH DATA ---
    useEffect(() => {
        if (id) fetchEntryDetails(id as string);
    }, [id]);

    const updateField = (setter: any, value: any, fieldName: string) => {
        setter(value);
        setIsDirty(true);
        if (fieldName === 'description' && errors.description) {
            setErrors(prev => ({ ...prev, description: false }));
        }
    };

    const fetchEntryDetails = async (entryId: string) => {
        setInitialLoading(true);
        setLoadingMessage("Fetching details...");
        try {
            const db = await getDB();
            const entry = await db.getFirstAsync('SELECT * FROM accomplishments WHERE id = ?', [entryId]);
            
            if (entry) {
                const data = entry as any;
                setDescription(data.description);
                setRemarks(data.remarks || '');
                
                // Parse images
                if (data.image_url) {
                    try {
                        const parsed = JSON.parse(data.image_url);
                        if (Array.isArray(parsed)) {
                            setImages(parsed);
                        } else {
                            setImages([data.image_url]);
                        }
                    } catch {
                        setImages([data.image_url]);
                    }
                }
                setIsDirty(false); 
            }
        } catch (e) { console.log(e); } finally { setInitialLoading(false); }
    };

    // --- IMAGE HANDLING ---
    const checkLimit = () => {
        if (images.length >= MAX_PHOTOS) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Limit Reached',
                message: `You can only add up to ${MAX_PHOTOS} photos.`,
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
            });
            return false;
        }
        return true;
    };

    // Safe accessor for MediaType
    const getMediaType = () => {
        // @ts-ignore
        return ImagePicker.MediaTypeOptions?.Images ?? ImagePicker.MediaType?.Images ?? 'Images';
    };

    const pickFromCamera = async () => {
        if (!checkLimit()) return;

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Required", "Camera access is needed.");
            return;
        }
        
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: getMediaType(),
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
            });

            if (!result.canceled) addImage(result.assets[0].uri);
        } catch (e) {
            console.error("Camera Error:", e);
            Alert.alert("Error", "Failed to open camera.");
        }
    };

    const pickFromGallery = async () => {
        if (!checkLimit()) return;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Required", "Gallery access is needed.");
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: getMediaType(),
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
            });

            if (!result.canceled) addImage(result.assets[0].uri);
        } catch (e) {
            console.error("Gallery Error:", e);
            Alert.alert("Error", "Failed to open gallery.");
        }
    };

    const addImage = (uri: string) => {
        setImages(prev => [...prev, uri]);
        setIsDirty(true);
    };

    const removeImage = (indexToRemove: number) => {
        setImages(prev => prev.filter((_, index) => index !== indexToRemove));
        setIsDirty(true);
    };

    const uploadImage = async (uri: string) => {
        if (uri.startsWith('http')) return uri;
        if (!uri.startsWith('file://')) return uri;

        const filename = uri.split('/').pop();
        const docDir = FileSystem.documentDirectory;
        if (docDir) {
            const newPath = `${docDir}${filename}`;
            try {
                await FileSystem.copyAsync({ from: uri, to: newPath });
                return newPath;
            } catch {
                return uri; 
            }
        }
        return uri;
    };

    // --- SAVE LOGIC ---
    const handleSavePress = () => {
        if (!description.trim()) { setErrors({ description: true }); return; }
        executeSave();
    };

    const executeSave = async () => {
        setLoading(true);
        try {
            setLoadingMessage("Processing images...");
            
            const processedImages = await Promise.all(
                images.map(async (img) => await uploadImage(img))
            );
            const imagesJson = JSON.stringify(processedImages);

            setLoadingMessage("Saving entry...");
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) throw new Error("No user logged in");

            const db = await getDB();
            
            // --- DATE FIX START ---
            const now = new Date().toISOString(); // Keep ISO for timestamps
            // use local date for the 'date' column so it matches Home screen filter
            const dateStr = format(new Date(), 'yyyy-MM-dd'); 
            // --- DATE FIX END ---

            if (id) {
                // Update Local
                await db.runAsync(
                    'UPDATE accomplishments SET description = ?, remarks = ?, image_url = ?, updated_at = ? WHERE id = ?',
                    [description, remarks, imagesJson, now, id]
                );
                // Queue Sync
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['accomplishments', id, 'UPDATE', JSON.stringify({ description, remarks, image_url: imagesJson, updated_at: now })]
                );
            } else {
                const newId = generateUUID();
                const newEntry = {
                    id: newId,
                    user_id: user.id,
                    date: dateStr, // Uses local date
                    description,
                    remarks,
                    image_url: imagesJson,
                    created_at: now,
                    updated_at: now
                };

                await db.runAsync(
                    'INSERT INTO accomplishments (id, user_id, date, description, remarks, image_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [newId, user.id, dateStr, description, remarks, imagesJson, now, now]
                );

                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['accomplishments', newId, 'INSERT', JSON.stringify(newEntry)]
                );
            }

            triggerSync();
            setIsDirty(false); 
            router.back();
        } catch (e: any) {
            setAlertConfig({ 
                visible: true, 
                type: 'error', 
                title: 'Error', 
                message: e.message || 'Failed to save entry.', 
                confirmText: 'Close', 
                onConfirm: () => setAlertConfig((p:any) => ({ ...p, visible: false })) 
            });
        } finally { setLoading(false); }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={loading} message={loadingMessage} />
            
            {/* HEADER */}
            <View style={{ backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }} className="z-10 flex-row items-center justify-between px-6 py-4 border-b shadow-sm">
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-full active:bg-slate-100 dark:active:bg-slate-800">
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={theme.colors.icon} />
                </TouchableOpacity>
                <Text style={{ color: theme.colors.text }} className="text-xl font-bold">{id ? 'Edit Entry' : 'New Entry'}</Text>
                <TouchableOpacity 
                    onPress={handleSavePress} 
                    disabled={initialLoading || loading}
                    style={{ backgroundColor: theme.colors.primaryLight, opacity: (initialLoading || loading) ? 0.5 : 1 }} 
                    className="p-2 -mr-2 rounded-full"
                >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {/* CONTENT BODY */}
            {initialLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={{ marginTop: 12, color: theme.colors.textSecondary, fontWeight: '500' }}>Fetching Details...</Text>
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
                        {/* Date Display */}
                        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="flex-row items-center p-4 mb-6 border rounded-2xl">
                            <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.icon} />
                            <Text style={{ color: theme.colors.text }} className="ml-3 text-base font-bold">{format(new Date(), 'MMMM d, yyyy')}</Text>
                        </View>

                        {/* Description Input */}
                        <View className="mb-5">
                            <Text style={{ color: theme.colors.textSecondary }} className="mb-2 text-xs font-bold uppercase">Task Description <Text style={{ color: theme.colors.danger }}>*</Text></Text>
                            <View style={{ backgroundColor: errors.description ? '#FEF2F2' : theme.colors.card, borderColor: errors.description ? '#EF4444' : theme.colors.border }} className="flex-row items-center border rounded-xl">
                                <TextInput value={description} onChangeText={(t) => updateField(setDescription, t, 'description')} placeholder="What did you work on?" placeholderTextColor={theme.colors.textSecondary} style={{ color: theme.colors.text }} className="flex-1 p-4 font-bold" />
                            </View>
                        </View>

                        {/* Remarks Input */}
                        <View className="mb-5">
                            <Text style={{ color: theme.colors.textSecondary }} className="mb-2 text-xs font-bold uppercase">Remarks (Optional)</Text>
                            <TextInput value={remarks} onChangeText={(t) => updateField(setRemarks, t, 'remarks')} placeholder="Additional notes..." placeholderTextColor={theme.colors.textSecondary} multiline textAlignVertical="top" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }} className="p-4 min-h-[100px] font-medium border rounded-xl" />
                        </View>

                        {/* Image Picker Section */}
                        <View className="mb-6">
                            <View className="flex-row items-center justify-between mb-2">
                                <Text style={{ color: theme.colors.textSecondary }} className="text-xs font-bold uppercase">ADD Photo</Text>
                                <Text style={{ color: images.length >= MAX_PHOTOS ? theme.colors.danger : theme.colors.textSecondary, fontSize: 11, fontWeight: 'bold' }}>
                                    {images.length} / {MAX_PHOTOS}
                                </Text>
                            </View>

                            {/* Buttons Row */}
                            <View className="flex-row gap-3 mb-3">
                                <TouchableOpacity onPress={pickFromCamera} style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="flex-row items-center justify-center flex-1 p-3 border rounded-xl">
                                    <HugeiconsIcon icon={Camera01Icon} size={20} color={theme.colors.primary} />
                                    <Text style={{ color: theme.colors.text }} className="ml-2 font-semibold">Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={pickFromGallery} style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="flex-row items-center justify-center flex-1 p-3 border rounded-xl">
                                    <HugeiconsIcon icon={Image01Icon} size={20} color={theme.colors.primary} />
                                    <Text style={{ color: theme.colors.text }} className="ml-2 font-semibold">Gallery</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Images Stack */}
                            <View className="gap-4">
                                {images.length > 0 ? (
                                    images.map((uri, index) => (
                                        <View key={index} style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="w-full aspect-[4/3] rounded-2xl border overflow-hidden items-center justify-center relative">
                                            <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                                            <TouchableOpacity 
                                                onPress={() => removeImage(index)} 
                                                className="absolute p-2 bg-red-500 rounded-full shadow-sm top-2 right-2"
                                            >
                                                <HugeiconsIcon icon={Delete02Icon} size={16} color="white" />
                                            </TouchableOpacity>
                                            
                                            {/* Badge for index */}
                                            <View className="absolute px-2 py-1 rounded-md top-2 left-2 bg-black/50">
                                                <Text className="text-xs font-bold text-white">Photo {index + 1}</Text>
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    // Empty State
                                    <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed overflow-hidden items-center justify-center">
                                        <View className="items-center justify-center">
                                            <View style={{ backgroundColor: theme.colors.primaryLight }} className="items-center justify-center w-12 h-12 mb-2 rounded-full">
                                                <HugeiconsIcon icon={Image01Icon} size={24} color={theme.colors.primary} />
                                            </View>
                                            <Text style={{ color: theme.colors.textSecondary }} className="text-sm font-semibold">No photo selected</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
}