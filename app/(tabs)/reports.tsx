import {
  AlertCircleIcon,
  Clock01Icon,
  Delete02Icon,
  File02Icon,
  MoreVerticalCircle01Icon,
  PrinterIcon,
  Search01Icon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActionMenu from '../../components/ActionMenu';
import FloatingAlert from '../../components/FloatingAlert';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { sendLocalNotification } from '../../lib/notifications'; // Added
import { supabase } from '../../lib/supabase';

export default function ReportsScreen() {
  const router = useRouter();
  const [sections, setSections] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTarget, setMenuTarget] = useState<any>(null); 
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 20 });

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false, type: 'confirm', title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
  const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [pendingNotification, setPendingNotification] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
      setSelectedId(null);
    }, [])
  );

  const fetchReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: historyData } = await supabase.from('report_history').select('title').eq('user_id', user.id);
      const generatedTitles = new Set(historyData?.map(h => h.title) || []);

      const { data: attendance } = await supabase.from('attendance').select('*').eq('user_id', user.id).order('date', { ascending: false });
      const { data: tasks } = await supabase.from('accomplishments').select('*').eq('user_id', user.id);

      const allDates = new Set([
        ...(attendance?.map(a => a.date) || []),
        ...(tasks?.map(t => t.date) || [])
      ]);
      const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const merged = sortedDates.map(date => {
        const att = attendance?.find(a => a.date === date);
        const taskList = tasks?.filter(t => t.date === date) || [];
        return {
            id: att?.id || `task-only-${date}`,
            date: date,
            clock_in: att?.clock_in || date,
            clock_out: att?.clock_out,
            status: att?.status || 'no-attendance',
            accomplishments: taskList
        };
      });

      const grouped = merged.reduce((acc: any, curr) => {
        const date = new Date(curr.date);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        const monthNum = date.getMonth() + 1;
        const monthStr = monthNum < 10 ? `0${monthNum}` : monthNum;

        let cutoffKey = "";
        let dateRange = {};
        let isCurrent = false;

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        if (day <= 15) {
            cutoffKey = `1st Cutoff ${month} ${year}`;
            dateRange = { start: `${year}-${monthStr}-01`, end: `${year}-${monthStr}-15` };
            if (currentYear === year && currentMonth === monthNum && currentDay <= 15) isCurrent = true;
        } else {
            cutoffKey = `2nd Cutoff ${month} ${year}`;
            const lastDay = new Date(year, monthNum, 0).getDate();
            dateRange = { start: `${year}-${monthStr}-16`, end: `${year}-${monthStr}-${lastDay}` };
            if (currentYear === year && currentMonth === monthNum && currentDay > 15) isCurrent = true;
        }

        const isGenerated = generatedTitles.has(cutoffKey);
        
        if (isCurrent || !isGenerated) {
            if (!acc[cutoffKey]) {
                acc[cutoffKey] = { 
                    title: cutoffKey, 
                    data: [], 
                    ...dateRange, 
                    isPending: !isCurrent && !isGenerated,
                    isCurrent // FIXED: Logic now has access to this property
                };
            }
            acc[cutoffKey].data.push(curr);
        }
        return acc;
      }, {});

      const sectionValues = Object.values(grouped);
      setSections(sectionValues);
      
      const isPending = sectionValues.some((s: any) => s.isPending);
      setPendingNotification(isPending);

      // --- AUTOMATIC NOTIFICATION LOGIC ---
      // Loop through sections to find finished cutoffs (not current) that are still pending generation
      for (const section of sectionValues as any[]) {
        if (section.isPending && !section.isCurrent) {
            // Unique key to prevent duplicate notifications
            const notifKey = `notified_${section.title.replace(/\s/g, '_')}`;
            const hasNotified = await AsyncStorage.getItem(notifKey);

            if (!hasNotified) {
                // Send Local Notification
                await sendLocalNotification(
                    'Cutoff Report Ready', 
                    `Your report for ${section.title} is ready to be generated.`, 
                    'cutoff'
                );
                // Mark as sent
                await AsyncStorage.setItem(notifKey, 'true');
            }
        }
      }

    } catch (e) { console.log(e); } finally { setRefreshing(false); }
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;

    setAlertConfig({
      visible: true,
      type: 'confirm',
      title: 'Delete Log',
      message: `Delete report for ${new Date(selectedId).toDateString()}?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        setLoadingAction(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if(user) {
                await supabase.from('attendance').delete().eq('user_id', user.id).eq('date', selectedId);
                await supabase.from('accomplishments').delete().eq('user_id', user.id).eq('date', selectedId);
                setSelectedId(null);
                await fetchReports(); 
                setFloatingAlert({ visible: true, message: 'Log deleted', type: 'success' });
            }
        } catch (error: any) { console.log(error); } finally { setLoadingAction(false); }
      }
    });
  };

  const onGenerateReport = async () => {
    setMenuVisible(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (user && menuTarget) {
        await supabase.from('report_history').insert({
            user_id: user.id,
            title: menuTarget.title,
            start_date: menuTarget.start,
            end_date: menuTarget.end
        });
    }
    router.push({ 
        pathname: '/reports/print', 
        params: { mode: 'cutoff', startDate: menuTarget.start, endDate: menuTarget.end, title: menuTarget.title } 
    });
    setTimeout(fetchReports, 1000); 
  };

  const onDeleteCutoff = () => {
    setMenuVisible(false);
    setAlertConfig({
        visible: true,
        type: 'confirm',
        title: 'Delete Cutoff',
        message: `Delete ALL logs from ${menuTarget.start} to ${menuTarget.end}?`,
        confirmText: 'Delete All',
        cancelText: 'Cancel',
        onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        onConfirm: async () => {
            setAlertConfig((prev: any) => ({ ...prev, visible: false }));
            setLoadingAction(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                await supabase.from('attendance').delete().eq('user_id', user.id).gte('date', menuTarget.start).lte('date', menuTarget.end);
                await supabase.from('accomplishments').delete().eq('user_id', user.id).gte('date', menuTarget.start).lte('date', menuTarget.end);
                await fetchReports();
                setFloatingAlert({ visible: true, message: 'Cutoff cleared', type: 'success' });
            } catch (e: any) { console.log(e); } finally { setLoadingAction(false); }
        }
    });
  };

  const renderSectionHeader = ({ section }: any) => (
    <View className="flex-row justify-between items-center mt-6 mb-3 bg-[#F1F5F9] dark:bg-[#0B1120] py-2">
        <View className="flex-row items-center gap-2">
            {section.isPending && <View className="w-2 h-2 bg-red-500 rounded-full" />}
            <View>
                <Text className="text-xs font-bold tracking-widest uppercase text-slate-500">{section.title}</Text>
                <Text className="text-slate-400 text-[10px] mt-0.5">{section.data.length} Entries</Text>
            </View>
        </View>
        <TouchableOpacity onPress={(e) => { setMenuTarget(section); setMenuPosition({ top: e.nativeEvent.pageY + 10, right: 20 }); setMenuVisible(true); }} className="p-1 bg-white border rounded-full shadow-sm dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={20} color="#64748b" />
        </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: any) => {
    const isSelected = selectedId === item.date;
    const hasAttendance = item.status !== 'no-attendance';
    return (
        <TouchableOpacity onPress={() => isSelected ? setSelectedId(null) : router.push({ pathname: '/reports/details', params: { date: item.date } })} onLongPress={() => setSelectedId(isSelected ? null : item.date)} activeOpacity={0.7} className={`p-5 rounded-[24px] mb-3 flex-row items-center justify-between border ${isSelected ? 'bg-red-50 border-red-500 dark:bg-red-900/20' : 'bg-white border-slate-100 dark:bg-slate-800 dark:border-slate-700/50'}`}>
            <View className="flex-1">
                <Text className={`text-lg font-bold font-sans ${isSelected ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{new Date(item.date).toDateString()}</Text>
                <Text className="mt-1 text-xs font-medium text-slate-500">{item.accomplishments.length} Accomplishments • {hasAttendance ? new Date(item.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'No Time In'}</Text>
            </View>
            {isSelected ? <View className="items-center justify-center w-6 h-6 bg-red-500 border-2 border-red-500 rounded-full"><HugeiconsIcon icon={Tick02Icon} size={14} color="white" /></View> : <View className={`w-10 h-10 rounded-full items-center justify-center ${item.status === 'completed' ? 'bg-green-100 dark:bg-green-900/20' : hasAttendance ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-slate-100 dark:bg-slate-700'}`}>{hasAttendance ? <HugeiconsIcon icon={File02Icon} size={20} color={item.status === 'completed' ? '#22c55e' : '#f97316'} /> : <HugeiconsIcon icon={AlertCircleIcon} size={20} color="#94a3b8" />}</View>}
        </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9' }} edges={['top']}>
      <ModernAlert {...alertConfig} />
      <FloatingAlert visible={floatingAlert.visible} message={floatingAlert.message} type={floatingAlert.type} onHide={() => setFloatingAlert({...floatingAlert, visible: false})} />
      
      {/* Loading Overlay */}
      <LoadingOverlay visible={loadingAction} message="Processing..." />
      
      {/* Header */}
      <View style={styles.header}>
          {selectedId ? (
              <View className="flex-row items-center justify-between w-full"><Text className="text-xl font-bold text-red-600">1 Selected</Text><TouchableOpacity onPress={handleDeleteSelected} className="p-2 bg-red-100 rounded-full dark:bg-red-900/30"><HugeiconsIcon icon={Delete02Icon} size={24} color="#ef4444" /></TouchableOpacity></View>
          ) : (
              <>
                <View>
                    <Text style={styles.headerTitle}>Reports</Text>
                    {pendingNotification && <Text className="mt-1 text-xs font-bold text-red-500">● Pending</Text>}
                </View>
                <TouchableOpacity onPress={() => router.push('/reports/history')} style={styles.iconBtn}>
                    <HugeiconsIcon icon={Clock01Icon} size={24} color="#64748b" />
                </TouchableOpacity>
              </>
          )}
      </View>

      <ActionMenu visible={menuVisible} onClose={() => setMenuVisible(false)} actions={[{ label: 'Generate & Print', icon: PrinterIcon, onPress: onGenerateReport, color: '#6366f1' }, { label: 'Delete Cutoff', icon: Delete02Icon, onPress: onDeleteCutoff, color: '#ef4444' }]} position={menuPosition} />
      <View className="flex-1 px-6"><SectionList sections={sections} keyExtractor={(item) => item.id} renderItem={renderItem} renderSectionHeader={renderSectionHeader} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} />} ListEmptyComponent={<View className="items-center justify-center mt-20"><View className="items-center justify-center w-16 h-16 mb-4 rounded-full bg-slate-200 dark:bg-slate-800"><HugeiconsIcon icon={Search01Icon} size={32} color="#94a3b8" /></View><Text className="font-bold text-slate-400">No active reports.</Text></View>} /></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#F1F5F9', // Matches Profile
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9' 
    },
    headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
    iconBtn: {
        padding: 12, backgroundColor: 'white', borderRadius: 999, borderWidth: 1, borderColor: '#e2e8f0',
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2,
    }
});