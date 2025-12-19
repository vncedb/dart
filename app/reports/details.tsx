import {
  ArrowLeft02Icon,
  Clock01Icon,
  Delete02Icon,
  MoreVerticalCircle01Icon,
  PencilEdit02Icon,
  PrinterIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Image, // ADDED
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActionMenu from '../../components/ActionMenu';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { supabase } from '../../lib/supabase';

export default function ReportDetailsScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams();
  const [report, setReport] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  
  // Loading & Alert State
  const [loadingAction, setLoadingAction] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ 
      visible: false, 
      type: 'confirm', 
      title: '', 
      message: '', 
      confirmText: 'OK',
      onConfirm: () => {},
      onCancel: () => {}
  });

  useFocusEffect(
    useCallback(() => {
      fetchReportDetails();
    }, [date])
  );

  const fetchReportDetails = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !date) return;

    // 1. Fetch Attendance for this date
    const { data: attendance } = await supabase.from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .single();

    // 2. Fetch Tasks for this date
    const { data: tasks } = await supabase.from('accomplishments')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date);

    setReport({
      date: date,
      clockIn: attendance ? new Date(attendance.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--',
      clockOut: attendance?.clock_out ? new Date(attendance.clock_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--',
      accomplishments: tasks || []
    });
  };

  // --- ACTIONS ---
  const handleEdit = () => {
    setMenuVisible(false);
    router.push({ pathname: '/reports/edit', params: { date: date } });
  };

  const handlePrint = () => {
    setMenuVisible(false);
    router.push({ pathname: '/reports/print', params: { mode: 'single', date: date } });
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setAlertConfig({
        visible: true,
        type: 'confirm',
        title: 'Delete Report',
        message: 'Are you sure you want to delete this daily report? This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: async () => {
            setAlertConfig((prev: any) => ({ ...prev, visible: false }));
            setLoadingAction(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                   await supabase.from('attendance').delete().eq('user_id', user.id).eq('date', date);
                   await supabase.from('accomplishments').delete().eq('user_id', user.id).eq('date', date);
                   router.back();
                }
            } catch (error) {
                console.log(error);
            } finally {
                setLoadingAction(false);
            }
        },
        onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
    });
  };

  if (!report) return <View className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]" />;

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]">
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={loadingAction} message="Deleting Report..." />

      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800">
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
        </TouchableOpacity>
        <Text className="font-sans text-xl font-bold text-slate-900 dark:text-white">Report Details</Text>
        <TouchableOpacity 
            onPress={() => setMenuVisible(true)} 
            className="p-2 rounded-full bg-slate-50 dark:bg-slate-800"
        >
          <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ActionMenu 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
        actions={[
            { label: 'Edit Entry', icon: PencilEdit02Icon, onPress: handleEdit },
            { label: 'Print PDF', icon: PrinterIcon, onPress: handlePrint, color: '#f97316' },
            { label: 'Delete', icon: Delete02Icon, onPress: handleDelete, color: '#ef4444' },
        ]}
        position={{ top: 70, right: 20 }}
      />

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="bg-white dark:bg-slate-800 p-6 rounded-[32px] mb-6 shadow-sm border border-slate-100 dark:border-slate-700/50">
          <Text className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-400">Date</Text>
          <Text className="mb-6 text-3xl font-extrabold text-slate-900 dark:text-white">{new Date(report.date as string).toDateString()}</Text>
          
          <View className="flex-row gap-4">
            <View className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
              <View className="flex-row items-center gap-2 mb-1">
                <HugeiconsIcon icon={Clock01Icon} size={16} color="#6366f1" />
                <Text className="text-xs font-bold uppercase text-slate-400">Clock In</Text>
              </View>
              <Text className="text-lg font-bold text-slate-900 dark:text-white">{report.clockIn}</Text>
            </View>
            <View className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
              <View className="flex-row items-center gap-2 mb-1">
                <HugeiconsIcon icon={Clock01Icon} size={16} color="#f97316" />
                <Text className="text-xs font-bold uppercase text-slate-400">Clock Out</Text>
              </View>
              <Text className="text-lg font-bold text-slate-900 dark:text-white">{report.clockOut}</Text>
            </View>
          </View>
        </View>

        <Text className="mb-4 ml-2 text-lg font-bold text-slate-900 dark:text-white">Accomplishments</Text>
        <View className="gap-3">
          {report.accomplishments.length === 0 ? (
            <Text className="ml-2 italic text-slate-400">No accomplishments recorded.</Text>
          ) : report.accomplishments.map((acc: any) => (
            <View key={acc.id} className="flex-row items-start gap-3 p-5 bg-white border dark:bg-slate-800 rounded-2xl border-slate-100 dark:border-slate-700/50">
              <View className="w-2 h-2 mt-2 bg-green-500 rounded-full" />
              <View className="flex-1">
                <Text className="text-base font-medium leading-6 text-slate-700 dark:text-slate-200">{acc.description}</Text>
                {acc.remarks && (
                    <Text className="self-start p-2 mt-2 text-xs italic rounded-lg text-slate-400 bg-slate-50 dark:bg-slate-900">
                        Note: {acc.remarks}
                    </Text>
                )}
                {/* ADDED IMAGE DISPLAY */}
                {acc.image_url && (
                    <Image 
                        source={{ uri: acc.image_url }} 
                        style={{ aspectRatio: 3/4 }} // Enforce 3:4 ratio
                        className="w-full mt-3 rounded-xl bg-slate-200" 
                        resizeMode="cover" 
                    />
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}