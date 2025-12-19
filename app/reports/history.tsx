import {
    ArrowLeft02Icon,
    Delete02Icon,
    MoreVerticalCircle01Icon,
    PrinterIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActionMenu from '../../components/ActionMenu';
import ModernAlert from '../../components/ModernAlert';
import { supabase } from '../../lib/supabase';

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  
  // Menu State
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 20 });

  // Alert Config
  const [alertConfig, setAlertConfig] = useState<any>({ 
    visible: false, type: 'confirm', title: '', message: '', onConfirm: () => {} 
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('report_history')
        .select('*')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false });

      if (data) setHistory(data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMenu = (event: any, item: any) => {
    setMenuPosition({ top: event.nativeEvent.pageY + 20, right: 20 });
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const handleReprint = () => {
    setMenuVisible(false);
    router.push({
        pathname: '/reports/print',
        params: {
            mode: 'cutoff',
            startDate: selectedItem.start_date,
            endDate: selectedItem.end_date,
            title: selectedItem.title
        }
    });
  };

  const handleDelete = () => {
    setMenuVisible(false);
    
    setAlertConfig({
        visible: true,
        type: 'confirm',
        title: 'Delete Record',
        message: 'This will remove the item from your history list. The original logs are not affected.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        onConfirm: async () => {
            setAlertConfig((prev: any) => ({ ...prev, visible: false }));
            setLoadingAction(true);
            try {
                const { error } = await supabase.from('report_history').delete().eq('id', selectedItem.id);
                if (error) throw error;
                await fetchHistory();
            } catch (e: any) {
                // If it fails, RLS is likely the issue (See Step 1)
                setTimeout(() => {
                  setAlertConfig({
                    visible: true, type: 'error', title: 'Error', message: 'Could not delete. Check database permissions.', 
                    confirmText: 'OK', onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
                  });
                }, 300);
            } finally {
                setLoadingAction(false);
            }
        }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]">
      <ModernAlert {...alertConfig} />
      
      {loadingAction && (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black/30">
            <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}

      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800">
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
        </TouchableOpacity>
        <Text className="font-sans text-xl font-bold text-slate-900 dark:text-white">Report History</Text>
        <View className="w-10" />
      </View>

      <ActionMenu 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
        position={menuPosition}
        actions={[
            { label: 'Reprint', icon: PrinterIcon, onPress: handleReprint },
            { label: 'Delete Record', icon: Delete02Icon, onPress: handleDelete, color: '#ef4444' }
        ]}
      />

      {loading ? (
        <View className="items-center justify-center flex-1"><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : (
        <FlatList
            data={history}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 24 }}
            ListEmptyComponent={<Text className="mt-10 text-center text-slate-400">No history found.</Text>}
            renderItem={({ item }) => (
                <View className="bg-white dark:bg-slate-800 p-5 rounded-[24px] mb-3 flex-row items-center justify-between border border-slate-100 dark:border-slate-700 shadow-sm">
                    <View>
                        <Text className="text-base font-bold text-slate-900 dark:text-white">{item.title}</Text>
                        <Text className="mt-1 text-xs text-slate-400">Generated: {new Date(item.generated_at).toDateString()}</Text>
                    </View>
                    <TouchableOpacity onPress={(e) => handleMenu(e, item)} className="p-2">
                        <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={20} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
            )}
        />
      )}
    </SafeAreaView>
  );
}