import {
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
  GestureResponderEvent,
  StatusBar,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Components
import ActionMenu from '../../components/ActionMenu';
import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | undefined>(undefined);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('report_history').select('*').eq('user_id', user.id).order('generated_at', { ascending: false });
      if (data) setHistory(data);
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const handleMenu = (event: GestureResponderEvent, item: any) => {
    const { pageX, pageY } = event.nativeEvent;
    // Offset Y by 20 to clear the icon height
    setMenuAnchor({ x: pageX, y: pageY + 20 });
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const handleReprint = () => {
    setMenuVisible(false);
    router.push({ pathname: '/reports/print', params: { mode: 'cutoff', startDate: selectedItem.start_date, endDate: selectedItem.end_date, title: selectedItem.title } });
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setAlertConfig({
        visible: true, type: 'confirm', title: 'Delete Record',
        message: 'This will remove the item from your history list.',
        confirmText: 'Delete', cancelText: 'Cancel',
        onConfirm: async () => {
            setAlertConfig((prev: any) => ({ ...prev, visible: false }));
            setLoadingAction(true);
            try {
                await supabase.from('report_history').delete().eq('id', selectedItem.id);
                await fetchHistory();
            } catch (e) { console.log(e); } finally { setLoadingAction(false); }
        },
        onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false }))
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <ModernAlert {...alertConfig} />
      
      {loadingAction && (
        <View style={{ position: 'absolute', inset: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}

      <Header title="Report History" />

      <ActionMenu 
        visible={menuVisible} onClose={() => setMenuVisible(false)} anchor={menuAnchor}
        actions={[
            { label: 'Reprint', icon: PrinterIcon, onPress: handleReprint },
            { label: 'Delete Record', icon: Delete02Icon, onPress: handleDelete, color: theme.colors.danger }
        ]}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Loading History...</Text>
        </View>
      ) : (
        <FlatList
            data={history}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 24 }}
            ListEmptyComponent={<Text style={{ marginTop: 40, textAlign: 'center', color: theme.colors.textSecondary }}>No history found.</Text>}
            renderItem={({ item }) => (
                <View style={{ backgroundColor: theme.colors.card, padding: 20, borderRadius: 24, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border }}>
                    <View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.text }}>{item.title}</Text>
                        <Text style={{ marginTop: 4, fontSize: 12, color: theme.colors.textSecondary }}>Generated: {new Date(item.generated_at).toDateString()}</Text>
                    </View>
                    <TouchableOpacity onPress={(e) => handleMenu(e, item)} style={{ padding: 8 }}>
                        <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={20} color={theme.colors.icon} />
                    </TouchableOpacity>
                </View>
            )}
        />
      )}
    </SafeAreaView>
  );
}