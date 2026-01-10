import {
    AlertCircleIcon,
    Clock01Icon,
    Delete02Icon,
    MoreVerticalCircle01Icon,
    PrinterIcon,
    Search01Icon,
    Task01Icon,
    Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    SectionList,
    StatusBar,
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
import TabHeader from '../../components/TabHeader'; // <--- IMPORTED
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

export default function ReportsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  
  const [sections, setSections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTarget, setMenuTarget] = useState<any>(null); 
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 20 });

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false, type: 'confirm', title: '', message: '', onConfirm: () => {}, onCancel: () => {} });
  const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });
  const [pendingNotification, setPendingNotification] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        if (loadingAction) {
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'warning', title: 'Process Running', message: 'Please wait for the current operation to finish.',
                confirmText: 'Okay', onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        }
    });
    return unsubscribe;
  }, [navigation, loadingAction]);

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
      const db = await getDB();

      const attendance = await db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC', [user.id]);
      const tasks = await db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ?', [user.id]);
      
      const { data: historyData } = await supabase.from('report_history').select('title').eq('user_id', user.id);
      const generatedTitles = new Set(historyData?.map(h => h.title) || []);

      const allDates = new Set([
        ...(attendance?.map((a: any) => a.date) || []),
        ...(tasks?.map((t: any) => t.date) || [])
      ]);
      const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const merged = sortedDates.map(date => {
        const att: any = attendance?.find((a: any) => a.date === date);
        const taskList: any = tasks?.filter((t: any) => t.date === date) || [];
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
                    title: cutoffKey, data: [], ...dateRange, 
                    isPending: !isCurrent && !isGenerated, isCurrent 
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

    } catch (e) { console.log(e); } finally { 
        setRefreshing(false); 
        setIsLoading(false);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    setAlertConfig({
      visible: true,
      type: 'confirm',
      title: 'Delete Log',
      message: `Delete report for ${new Date(selectedId).toDateString()}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        setLoadingAction(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if(user) {
                const db = await getDB();
                const attToDelete = await db.getAllAsync('SELECT id FROM attendance WHERE user_id = ? AND date = ?', [user.id, selectedId]);
                const tasksToDelete = await db.getAllAsync('SELECT id FROM accomplishments WHERE user_id = ? AND date = ?', [user.id, selectedId]);
                
                for (const row of attToDelete as any[]) {
                    await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['attendance', row.id, 'DELETE']);
                }
                for (const row of tasksToDelete as any[]) {
                    await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['accomplishments', row.id, 'DELETE']);
                }

                await db.runAsync('DELETE FROM attendance WHERE user_id = ? AND date = ?', [user.id, selectedId]);
                await db.runAsync('DELETE FROM accomplishments WHERE user_id = ? AND date = ?', [user.id, selectedId]);

                setSelectedId(null);
                await fetchReports(); 
                triggerSync();
                setFloatingAlert({ visible: true, message: 'Log deleted', type: 'success' });
            }
        } catch (error: any) { console.log(error); } finally { setLoadingAction(false); }
      }
    });
  };

  const onDeleteCutoff = () => {
    setMenuVisible(false);
    setAlertConfig({
        visible: true, type: 'confirm', title: 'Delete Cutoff', message: `Are you sure you want to delete ALL logs from ${menuTarget.start} to ${menuTarget.end}?`,
        confirmText: 'Delete All', cancelText: 'Cancel',
        onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        onConfirm: async () => {
            setAlertConfig((prev: any) => ({ ...prev, visible: false }));
            setLoadingAction(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const db = await getDB();
                
                const attToDelete = await db.getAllAsync('SELECT id FROM attendance WHERE user_id = ? AND date >= ? AND date <= ?', [user.id, menuTarget.start, menuTarget.end]);
                const tasksToDelete = await db.getAllAsync('SELECT id FROM accomplishments WHERE user_id = ? AND date >= ? AND date <= ?', [user.id, menuTarget.start, menuTarget.end]);

                for (const row of attToDelete as any[]) {
                     await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['attendance', row.id, 'DELETE']);
                }
                for (const row of tasksToDelete as any[]) {
                     await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['accomplishments', row.id, 'DELETE']);
                }

                await db.runAsync('DELETE FROM attendance WHERE user_id = ? AND date >= ? AND date <= ?', [user.id, menuTarget.start, menuTarget.end]);
                await db.runAsync('DELETE FROM accomplishments WHERE user_id = ? AND date >= ? AND date <= ?', [user.id, menuTarget.start, menuTarget.end]);

                await fetchReports();
                triggerSync();
                setFloatingAlert({ visible: true, message: 'Cutoff cleared', type: 'success' });
            } catch (e: any) { console.log(e); } finally { setLoadingAction(false); }
        }
    });
  };

  const onGenerateReport = async () => {
    setMenuVisible(false);
    setLoadingAction(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && menuTarget) {
            await supabase.from('report_history').insert({ user_id: user.id, title: menuTarget.title, start_date: menuTarget.start, end_date: menuTarget.end });
        }
        router.push({ pathname: '/reports/print', params: { mode: 'cutoff', startDate: menuTarget.start, endDate: menuTarget.end, title: menuTarget.title } });
        setTimeout(fetchReports, 1000); 
    } catch(e) { console.log(e); }
    finally { setLoadingAction(false); }
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={{ backgroundColor: theme.colors.background }} className="flex-row items-center justify-between px-1 py-2 mt-6 mb-3">
        <View className="flex-row items-center gap-2">
            {section.isPending && <View className="w-2 h-2 bg-red-500 rounded-full" />}
            <View>
                <Text style={{ color: theme.colors.textSecondary }} className="text-xs font-bold tracking-widest uppercase">{section.title}</Text>
                <Text style={{ color: theme.colors.icon }} className="text-[10px] mt-0.5 font-medium">{section.data.length} Entries</Text>
            </View>
        </View>
        <TouchableOpacity 
            onPress={(e) => { setMenuTarget(section); setMenuPosition({ top: e.nativeEvent.pageY + 10, right: 20 }); setMenuVisible(true); }} 
            style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
            className="p-1 border rounded-full shadow-sm"
        >
            <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={20} color={theme.colors.icon} />
        </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }: any) => {
    const isSelected = selectedId === item.date;
    const hasAttendance = item.status !== 'no-attendance';
    const dateObj = new Date(item.date);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = dateObj.getDate();

    return (
        <TouchableOpacity 
            onPress={() => isSelected ? setSelectedId(null) : router.push({ pathname: '/reports/details', params: { date: item.date } })} 
            onLongPress={() => setSelectedId(isSelected ? null : item.date)} 
            activeOpacity={0.7} 
            style={[styles.reportItem, { backgroundColor: isSelected ? theme.colors.dangerLight : theme.colors.card, borderColor: isSelected ? theme.colors.danger : theme.colors.border }]}
        >
            <View style={[styles.dateBox, { backgroundColor: theme.colors.background }]}>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{dayName}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>{dayNum}</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.primary} />
                    <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>
                        {hasAttendance ? new Date(item.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'No Time In'}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                     <HugeiconsIcon icon={Task01Icon} size={14} color={theme.colors.textSecondary} />
                     <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
                        {item.accomplishments.length} Task{item.accomplishments.length !== 1 ? 's' : ''} Recorded
                     </Text>
                </View>
            </View>
            {isSelected ? (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                    <HugeiconsIcon icon={Tick02Icon} size={14} color="#fff" />
                </View>
            ) : (
                <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: item.status === 'completed' ? theme.colors.successLight : hasAttendance ? theme.colors.warningLight : theme.colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <HugeiconsIcon icon={item.status === 'completed' ? Tick02Icon : hasAttendance ? Clock01Icon : AlertCircleIcon} size={16} color={item.status === 'completed' ? theme.colors.success : hasAttendance ? theme.colors.warning : theme.colors.icon} />
                </View>
            )}
        </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <ModernAlert {...alertConfig} />
      <FloatingAlert visible={floatingAlert.visible} message={floatingAlert.message} type={floatingAlert.type} onHide={() => setFloatingAlert({...floatingAlert, visible: false})} />
      <LoadingOverlay visible={loadingAction} message="Processing..." />
      
      {/* HEADER REFACTORED */}
      {selectedId ? (
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
              <View className="flex-row items-center justify-between w-full">
                  <Text style={{ color: theme.colors.danger, fontSize: 24, fontWeight: '800' }}>1 Selected</Text>
                  <TouchableOpacity onPress={handleDeleteSelected} style={{ backgroundColor: theme.colors.dangerLight }} className="p-2 rounded-full">
                      <HugeiconsIcon icon={Delete02Icon} size={24} color={theme.colors.danger} />
                  </TouchableOpacity>
              </View>
          </View>
      ) : (
          <TabHeader 
             title="Reports" 
             rightIcon={Clock01Icon} 
             onRightPress={() => router.push('/reports/history')}
             subtitle={pendingNotification ? <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '700' }}>● Pending Actions</Text> : undefined}
          />
      )}

      <ActionMenu visible={menuVisible} onClose={() => setMenuVisible(false)} actions={[{ label: 'Generate & Print', icon: PrinterIcon, onPress: onGenerateReport, color: '#6366f1' }, { label: 'Delete Cutoff', icon: Delete02Icon, onPress: onDeleteCutoff, color: '#ef4444' }]} position={menuPosition} />
      
      <View style={{ flex: 1 }}>
        {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        ) : (
            <SectionList 
                sections={sections} 
                keyExtractor={(item) => item.id} 
                renderItem={renderItem} 
                renderSectionHeader={renderSectionHeader} 
                contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 24 }} 
                showsVerticalScrollIndicator={false} 
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} tintColor={theme.colors.primary} />} 
                ListEmptyComponent={
                    <View className="items-center justify-center mt-20">
                        <View style={{ backgroundColor: theme.colors.iconBg }} className="items-center justify-center w-16 h-16 mb-4 rounded-full">
                            <HugeiconsIcon icon={Search01Icon} size={32} color={theme.colors.icon} />
                        </View>
                        <Text style={{ color: theme.colors.textSecondary }} className="font-bold">No active reports.</Text>
                    </View>
                } 
            />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    reportItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, marginBottom: 10, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2 },
    dateBox: { width: 50, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
    // Only keeping this header style for the Selection Mode override
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        zIndex: 10,
    }
});