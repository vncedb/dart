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
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function AddEntry() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams(); 
  const theme = useAppTheme();
  
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  
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
        const { data } = await supabase.from('accomplishments').select('*').eq('id', entryId).single();
        if (data) {
            setDescription(data.description);
            setRemarks(data.remarks || '');
            setImageUri(data.image_url);
            setIsDirty(false); 
        }
    } catch (e) { console.log(e); } finally { setInitialLoading(false); }
  };

  // --- IMAGE PICKER ---
  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) handleImageSelected(result.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) handleImageSelected(result.assets[0].uri);
  };

  const handleImageSelected = (uri: string) => {
      setImageUri(uri);
      setIsDirty(true);
  };

  const uploadImage = async (uri: string) => {
    if (!uri.startsWith('file://')) return uri;
    try {
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `entries/${fileName}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      
      const { error: uploadError } = await supabase.storage.from('entry-images').upload(filePath, arrayBuffer, { contentType: blob.type || 'image/jpeg', upsert: false });
      
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('entry-images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error: any) { 
        // Propagate error for the main handler to catch
        throw error;
    }
  };

  // --- SAVE LOGIC ---
  const handleSavePress = () => {
      if (!description.trim()) { setErrors({ description: true }); return; }
      executeSave();
  };

  const executeSave = async () => {
    setLoading(true);
    try {
      let publicUrl = imageUri;
      if (imageUri && imageUri.startsWith('file://')) {
          setLoadingMessage("Saving Image...");
          publicUrl = await uploadImage(imageUri);
      }
      setLoadingMessage("Saving entry...");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in");

      const payload = {
        user_id: user.id,
        description: description,
        remarks: remarks,
        image_url: publicUrl,
        date: format(new Date(), 'yyyy-MM-dd'),
      };

      if (id) await supabase.from('accomplishments').update(payload).eq('id', id);
      else await supabase.from('accomplishments').insert(payload);

      setIsDirty(false); 
      router.back();
    } catch (e: any) {
      // Enhanced Error Handling
      let title = 'Error';
      let message = e.message || 'An unexpected error occurred.';

      // Check for network related errors
      if (
          message.includes('Network request failed') || 
          message.includes('connection') || 
          message.includes('fetch') || 
          message.includes('internet')
      ) {
          title = 'No Internet Connection';
          message = 'Failed to save entry. Please check your internet connection and try again.';
      } else if (message.includes('storage')) {
          title = 'Upload Failed';
          message = 'Failed to upload the image. Please try again.';
      }

      setAlertConfig({ 
          visible: true, 
          type: 'error', 
          title: title, 
          message: message, 
          confirmText: 'Close', 
          onConfirm: () => setAlertConfig((p:any) => ({ ...p, visible: false })) 
      });
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={loading} message={loadingMessage} />
      
      {/* HEADER: Visible even during initial load */}
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

                {/* Image Picker */}
                <View className="mb-6">
                    <Text style={{ color: theme.colors.textSecondary }} className="mb-2 text-xs font-bold uppercase">ADD Photo</Text>
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
                    <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} className={`w-full aspect-[4/3] rounded-2xl border-2 ${!imageUri ? 'border-dashed' : ''} overflow-hidden items-center justify-center relative`}>
                        {imageUri ? (
                            <>
                                <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                                <TouchableOpacity onPress={() => { setImageUri(null); setIsDirty(true); }} className="absolute p-2 bg-red-500 rounded-full shadow-sm top-2 right-2">
                                    <HugeiconsIcon icon={Delete02Icon} size={16} color="white" />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View className="items-center justify-center">
                                <View style={{ backgroundColor: theme.colors.primaryLight }} className="items-center justify-center w-12 h-12 mb-2 rounded-full">
                                    <HugeiconsIcon icon={Image01Icon} size={24} color={theme.colors.primary} />
                                </View>
                                <Text style={{ color: theme.colors.textSecondary }} className="text-sm font-semibold">No photo selected</Text>
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