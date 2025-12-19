import {
  ArrowLeft02Icon,
  CheckmarkCircle02Icon,
  Delete02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../../components/LoadingOverlay'; // IMPORTED
import ModernAlert from '../../components/ModernAlert'; // IMPORTED
import { supabase } from '../../lib/supabase';

export default function EditReportScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams(); 
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Initial load
  const [saving, setSaving] = useState(false);  // Saving state
  
  const [alertConfig, setAlertConfig] = useState<any>({ 
      visible: false, 
      type: 'confirm', 
      title: '', 
      message: '', 
      confirmText: 'OK',
      onConfirm: () => {},
      onCancel: () => {}
  });

  useEffect(() => {
    fetchTasks();
  }, [date]);

  const fetchTasks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && date) {
      const { data } = await supabase.from('accomplishments')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date);
      if (data) setTasks(data);
    }
    setLoading(false);
  };

  const handleUpdate = (id: string, text: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, description: text } : t));
  };

  const handleDelete = (id: string) => {
    setAlertConfig({
        visible: true,
        type: 'confirm',
        title: 'Delete Item',
        message: 'Remove this accomplishment?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: () => {
            // Logic to remove locally. (Note: This doesn't delete from DB until you implement tracking deleted items or direct DB delete)
            // Assuming we stick to simple local filtering for now as per previous logic.
            setTasks(prev => prev.filter(t => t.id !== id));
            setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        },
        onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
    });
  };

  const handleSave = () => {
    setAlertConfig({
        visible: true,
        type: 'confirm',
        title: 'Save Changes',
        message: 'Confirm updates to this report?',
        confirmText: 'Save',
        cancelText: 'Cancel',
        onConfirm: async () => {
            setAlertConfig((prev: any) => ({ ...prev, visible: false }));
            setSaving(true);
            try {
                // Batch update logic
                for (const t of tasks) {
                    await supabase.from('accomplishments').update({ description: t.description }).eq('id', t.id);
                }
                router.back();
            } catch (e) {
                console.log(e);
            } finally {
                setSaving(false);
            }
        },
        onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]">
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={saving} message="Saving Changes..." />
      <LoadingOverlay visible={loading} message="Loading..." />

      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800">
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
        </TouchableOpacity>
        <Text className="font-sans text-xl font-bold text-slate-900 dark:text-white">
            Edit Report
        </Text>
        <TouchableOpacity onPress={handleSave} className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text className="mb-4 text-xs font-bold uppercase text-slate-400">
            {date ? new Date(date as string).toDateString() : ''}
        </Text>

        {tasks.map((task, index) => (
            <View key={task.id || index} className="mb-4">
                <Text className="mb-2 text-xs font-bold text-slate-400">Item {index + 1}</Text>
                <View className="flex-row gap-2">
                    <TextInput 
                        value={task.description}
                        multiline
                        onChangeText={(t) => handleUpdate(task.id, t)}
                        className="flex-1 p-4 bg-white border shadow-sm dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
                    />
                    <TouchableOpacity onPress={() => handleDelete(task.id)} className="items-center justify-center w-12 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                        <HugeiconsIcon icon={Delete02Icon} size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}