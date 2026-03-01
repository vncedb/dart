// filepath: app/reports/sync.tsx
import {
    Alert01Icon,
    ArrowLeft01Icon,
    CloudSavingDone01Icon,
    Refresh01Icon
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "../../components/Header";
import { useAppTheme } from "../../constants/theme";
import { useSync } from "../../context/SyncContext";

export default function SyncScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { 
    syncStatus, 
    lastSyncedAt, 
    pendingCount, 
    failedCount, 
    conflictCount, 
    isOffline, 
    triggerSync 
  } = useSync();

  const handleManualSync = async () => {
    await triggerSync();
  };

  const getStatusDisplay = () => {
     if (isOffline) return { title: 'Offline', color: theme.colors.textSecondary, icon: Alert01Icon, desc: 'Waiting for internet connection' };
     if (syncStatus === 'syncing') return { title: 'Syncing...', color: theme.colors.primary, icon: Refresh01Icon, desc: 'Uploading and downloading changes' };
     if (syncStatus === 'error' || failedCount > 0) return { title: 'Sync Error', color: theme.colors.danger, icon: Alert01Icon, desc: 'Some items failed to sync' };
     return { title: 'Up to date', color: '#107C41', icon: CloudSavingDone01Icon, desc: 'All changes saved to cloud' };
  };

  const status = getStatusDisplay();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
        <Header
            title="Sync Status"
            leftElement={
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={theme.colors.text} />
                </TouchableOpacity>
            }
        />
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={[styles.iconBox, { backgroundColor: status.color + '15' }]}>
                    {syncStatus === 'syncing' ? (
                        <ActivityIndicator color={status.color} size="large" />
                    ) : (
                        <HugeiconsIcon icon={status.icon} size={32} color={status.color} />
                    )}
                </View>
                <View style={styles.cardContent}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>{status.title}</Text>
                    <Text style={[styles.desc, { color: theme.colors.textSecondary }]}>{status.desc}</Text>
                </View>
            </View>

            <View style={[styles.detailsContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }]}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Pending Items</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text }]}>{pendingCount}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }]}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Failed Items</Text>
                    <Text style={[styles.detailValue, { color: failedCount > 0 ? theme.colors.danger : theme.colors.text }]}>{failedCount}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomColor: theme.colors.border, borderBottomWidth: 1 }]}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Conflicts</Text>
                    <Text style={[styles.detailValue, { color: conflictCount > 0 ? '#F59E0B' : theme.colors.text }]}>{conflictCount}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Last Synced</Text>
                    <Text style={[styles.detailValue, { color: theme.colors.text, fontSize: 14 }]}>
                        {lastSyncedAt && lastSyncedAt !== "1970-01-01T00:00:00.000Z" 
                            ? new Date(lastSyncedAt).toLocaleString() 
                            : 'Never'}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                onPress={handleManualSync}
                disabled={syncStatus === 'syncing' || isOffline}
                style={[
                    styles.syncBtn,
                    { backgroundColor: (syncStatus === 'syncing' || isOffline) ? theme.colors.border : theme.colors.primary }
                ]}
            >
                <Text style={styles.syncBtnText}>
                    {syncStatus === 'syncing' ? 'Syncing in background...' : 'Sync Now'}
                </Text>
            </TouchableOpacity>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16, borderWidth: 1, gap: 16 },
    iconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    cardContent: { flex: 1, gap: 4 },
    title: { fontSize: 20, fontFamily: 'Nunito_700Bold' },
    desc: { fontSize: 14, fontFamily: 'Nunito_500Medium' },
    detailsContainer: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    detailLabel: { fontSize: 16, fontFamily: 'Nunito_500Medium' },
    detailValue: { fontSize: 16, fontFamily: 'Nunito_700Bold' },
    syncBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    syncBtnText: { color: 'white', fontSize: 16, fontFamily: 'Nunito_700Bold' },
});