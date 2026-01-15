import {
    Calendar03Icon,
    Clock01Icon,
    Delete02Icon,
    MoreVerticalCircle01Icon,
    PencilEdit02Icon,
    PrinterIcon,
    Task01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Components
import ActionMenu from '../../components/ActionMenu';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function ReportDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const { date } = useLocalSearchParams();
  
  const [report, setReport] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      fetchReportDetails();
    }, [date])
  );

  const fetchReportDetails = async () => {
    // setInitialLoading(true); // Optional: re-enable if you want spinner on refocus
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !date) return;

    try {
        const { data: attendance } = await supabase.from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .single();

        const { data: tasks } = await supabase.from('accomplishments')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date);

        setReport({
        date: date,
        clockIn: attendance ? new Date(attendance.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--',
        clockOut: attendance?.clock_out ? new Date(attendance.clock_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--',
        status: attendance?.status || 'pending',
        accomplishments: tasks || []
        });
    } catch (e) {
        console.log(e);
    } finally {
        setInitialLoading(false);
    }
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
        message: 'This will delete the attendance record and all tasks for this day. This action cannot be undone.',
        confirmText: 'Delete Forever',
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={loadingAction} message="Deleting..." />

      <Header 
        title="Daily Report" 
        rightElement={
            <TouchableOpacity onPress={(e) => {
                // Ensure anchor is below the header container
                setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY + 20 });
                setMenuVisible(true);
            }}>
                <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
        }
      />

      <ActionMenu 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
        actions={[
            { label: 'Edit Report', icon: PencilEdit02Icon, onPress: handleEdit },
            { label: 'Print PDF', icon: PrinterIcon, onPress: handlePrint, color: '#f97316' },
            { label: 'Delete Day', icon: Delete02Icon, onPress: handleDelete, color: theme.colors.danger },
        ]}
        anchor={menuAnchor}
      />

      {initialLoading ? (
         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Loading Report...</Text>
         </View>
      ) : !report ? (
         <View style={{ flex: 1 }} />
      ) : (
         <>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                
                {/* Date Card */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 32, fontWeight: '800', color: theme.colors.text }}>
                        {new Date(report.date as string).toLocaleDateString('en-US', { weekday: 'long' })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                        <HugeiconsIcon icon={Calendar03Icon} size={16} color={theme.colors.primary} />
                        <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary, marginLeft: 6 }}>
                            {new Date(report.date as string).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>
                </View>

                {/* Attendance Stats */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
                    <View style={{ flex: 1, backgroundColor: theme.colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.success + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                            <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.success} />
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Time In</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 4 }}>{report.clockIn}</Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: theme.colors.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.warning + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                            <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.warning} />
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Time Out</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 4 }}>{report.clockOut}</Text>
                    </View>
                </View>

                {/* Accomplishments Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                     <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text }}>Accomplishments</Text>
                     <View style={{ backgroundColor: theme.colors.iconBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                         <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary }}>{report.accomplishments.length} Tasks</Text>
                     </View>
                </View>

                {/* List */}
                <View style={{ gap: 16 }}>
                  {report.accomplishments.length === 0 ? (
                    <View style={{ alignItems: 'center', padding: 40, opacity: 0.5 }}>
                        <HugeiconsIcon icon={Task01Icon} size={48} color={theme.colors.icon} />
                        <Text style={{ marginTop: 12, fontWeight: '500', color: theme.colors.textSecondary }}>No tasks recorded.</Text>
                    </View>
                  ) : report.accomplishments.map((acc: any) => (
                    <View key={acc.id} style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ marginTop: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                 <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', lineHeight: 24, color: theme.colors.text }}>{acc.description}</Text>
                                {acc.remarks && (
                                    <Text style={{ marginTop: 8, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>{acc.remarks}</Text>
                                )}
                            </View>
                        </View>
                        {acc.image_url && (
                            <View style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
                                <Image source={{ uri: acc.image_url }} style={{ width: '100%', aspectRatio: 4/3 }} resizeMode="cover" />
                            </View>
                        )}
                    </View>
                  ))}
                </View>
            </ScrollView>

            <Footer>
                <TouchableOpacity onPress={handleEdit} className="flex-row items-center justify-center bg-indigo-600 shadow-sm h-14 rounded-2xl">
                    <HugeiconsIcon icon={PencilEdit02Icon} size={20} color="white" />
                    <Text className="ml-2 text-lg font-bold text-white">Edit Report</Text>
                </TouchableOpacity>
            </Footer>
         </>
      )}
    </SafeAreaView>
  );
}