import {
  Delete02Icon,
  Download01Icon,
  File02Icon,
  MoreVerticalCircle01Icon,
  Pdf01Icon,
  PencilEdit02Icon,
  Search01Icon,
  Share01Icon,
  Xls01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  GestureResponderEvent,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ActionMenu from "../../components/ActionMenu";
import FloatingAlert, {
  AlertPosition,
  AlertType,
} from "../../components/FloatingAlert";
import Header from "../../components/Header";
import InputModal from "../../components/InputModal";
import LoadingOverlay from "../../components/LoadingOverlay";
import ModernAlert from "../../components/ModernAlert";
import { useAppTheme } from "../../constants/theme";
import { useSync } from "../../context/SyncContext";
import {
  deleteReportLocal,
  queueSyncItem,
  renameReportLocal,
  saveReportLocal,
} from "../../lib/database";
import { getDB } from "../../lib/db-client";
import { supabase } from "../../lib/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SavedReportsScreen() {
  const theme = useAppTheme();
  const { triggerSync } = useSync();

  const [reports, setReports] = useState<any[]>([]);
  const [filteredReports, setFilteredReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [menuAnchor, setMenuAnchor] = useState<
    { x: number; y: number } | undefined
  >(undefined);

  const [renameModalVisible, setRenameModalVisible] = useState(false);

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [floatingAlert, setFloatingAlert] = useState<{
    visible: boolean;
    message: string;
    type: AlertType;
    position: AlertPosition;
    actionLabel?: string;
    onAction?: () => void;
    duration?: number;
  }>({ visible: false, message: "", type: "success", position: "bottom" });

  // Refs for Undo Logic
  const deletedItemRef = useRef<any>(null);
  // FIXED: Proper type for timer ref
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const db = await getDB();
      const data = await db.getAllAsync(
        "SELECT * FROM saved_reports WHERE user_id = ? ORDER BY created_at DESC",
        [user.id],
      );
      setReports(data as any[]);
      if (!searchQuery) {
        setFilteredReports(data as any[]);
      } else {
        setFilteredReports(
          (data as any[]).filter((r) =>
            r.title.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
        );
      }
    } catch {
      /* ignored */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text) {
      setFilteredReports(
        reports.filter((r) =>
          r.title.toLowerCase().includes(text.toLowerCase()),
        ),
      );
    } else {
      setFilteredReports(reports);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleMenu = (event: GestureResponderEvent, item: any) => {
    const { pageY, locationY } = event.nativeEvent;
    const anchorX = SCREEN_WIDTH - 20;
    const buttonHeight = 32;
    const anchorY = pageY - locationY + buttonHeight;

    setMenuAnchor({ x: anchorX, y: anchorY });
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const prepareFileForShare = async (item: any) => {
    const fileInfo = await FileSystem.getInfoAsync(item.file_path);

    let sourceUri = item.file_path;
    if (!fileInfo.exists) {
      if (item.remote_url) {
        setFloatingAlert({
          visible: true,
          message: "Downloading file...",
          type: "info",
          position: "top",
        });
        const downloadRes = await FileSystem.downloadAsync(
          item.remote_url,
          item.file_path,
        );
        sourceUri = downloadRes.uri;
        setFloatingAlert((prev) => ({ ...prev, visible: false }));
      } else {
        throw new Error("File not found");
      }
    }

    const extension = item.file_type === "pdf" ? "pdf" : "xlsx";
    const safeTitle =
      item.title.replace(/[^a-zA-Z0-9 \-_]/g, "").trim() || "Report";
    const fileName = `${safeTitle}.${extension}`;
    const tempPath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.copyAsync({ from: sourceUri, to: tempPath });

    return tempPath;
  };

  const openFile = async (item: any) => {
    try {
      const uriToOpen = await prepareFileForShare(item);
      const mimeType =
        item.file_type === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      await Sharing.shareAsync(uriToOpen, {
        mimeType,
        UTI:
          item.file_type === "pdf"
            ? "com.adobe.pdf"
            : "com.microsoft.excel.xls",
        dialogTitle: item.title,
      });
    } catch {
      setFloatingAlert({
        visible: true,
        message: "Could not open file.",
        type: "error",
        position: "top",
      });
    }
  };

  const handleShare = async () => {
    setMenuVisible(false);
    if (!selectedItem) return;

    try {
      const uriToShare = await prepareFileForShare(selectedItem);
      await Sharing.shareAsync(uriToShare, { dialogTitle: selectedItem.title });
    } catch {
      setFloatingAlert({
        visible: true,
        message: "File not available to share.",
        type: "warning",
        position: "top",
      });
    }
  };

  const finalizeDeletion = async (item: any) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(item.file_path);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(item.file_path, { idempotent: true });
      }
      if (item.remote_url) {
        await queueSyncItem("saved_reports", item.id, "DELETE", {
          remote_url: item.remote_url,
        });
        await triggerSync();
      }
    } catch (e) {
      console.log("Error finalizing deletion", e);
    }
  };

  const performUndo = async () => {
    const itemToRestore = deletedItemRef.current;
    if (!itemToRestore) return;

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    try {
      setFloatingAlert((prev) => ({ ...prev, visible: false }));
      await saveReportLocal(itemToRestore);
      deletedItemRef.current = null;
      fetchReports();

      setTimeout(() => {
        setFloatingAlert({
          visible: true,
          message: "Report restored.",
          type: "success",
          position: "top",
        });
      }, 300);
    } catch (e) {
      console.error("Undo failed", e);
      setFloatingAlert({
        visible: true,
        message: "Failed to restore.",
        type: "error",
        position: "top",
      });
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setAlertConfig({
      visible: true,
      type: "confirm",
      title: "Delete Report",
      message: "Are you sure you want to delete this report?",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        if (!selectedItem) return;

        setIsDeleting(true);
        const itemToDelete = { ...selectedItem };
        deletedItemRef.current = itemToDelete;

        try {
          await deleteReportLocal(itemToDelete.id);
          await fetchReports();

          setIsDeleting(false);

          const duration = 4000;
          deleteTimerRef.current = setTimeout(() => {
            finalizeDeletion(itemToDelete);
            deletedItemRef.current = null;
          }, duration);

          setFloatingAlert({
            visible: true,
            message: "Report deleted.",
            type: "success",
            position: "bottom",
            actionLabel: "Undo",
            onAction: performUndo,
            duration: duration,
          });
        } catch (e) {
          console.log(e);
          setIsDeleting(false);
          setFloatingAlert({
            visible: true,
            message: "Delete failed.",
            type: "error",
            position: "top",
          });
        }
      },
      onCancel: () =>
        setAlertConfig((prev: any) => ({ ...prev, visible: false })),
    });
  };

  const saveRename = async (newName: string) => {
    if (!selectedItem) return;
    try {
      await renameReportLocal(selectedItem.id, newName);
      await queueSyncItem("saved_reports", selectedItem.id, "UPDATE", {
        title: newName,
      });
      await triggerSync();
      fetchReports();
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isPdf = item.file_type === "pdf";
    return (
      <TouchableOpacity
        onPress={() => openFile(item)}
        activeOpacity={0.7}
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.iconBox,
            { backgroundColor: isPdf ? "#D9151910" : "#107C4110" },
          ]}
        >
          <HugeiconsIcon
            icon={isPdf ? Pdf01Icon : Xls01Icon}
            size={24}
            color={isPdf ? "#D91519" : "#107C41"}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={[styles.cardTitle, { color: theme.colors.text }]}
          >
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <Text
              style={[styles.metaText, { color: theme.colors.textSecondary }]}
            >
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
            <Text
              style={[styles.metaText, { color: theme.colors.textSecondary }]}
            >
              •
            </Text>
            <Text
              style={[styles.metaText, { color: theme.colors.textSecondary }]}
            >
              {formatSize(item.file_size)}
            </Text>
            {!item.file_path && item.remote_url && (
              <HugeiconsIcon
                icon={Download01Icon}
                size={12}
                color={theme.colors.primary}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={(e) => handleMenu(e, item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 4 }}
        >
          <HugeiconsIcon
            icon={MoreVerticalCircle01Icon}
            size={20}
            color={theme.colors.icon}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={isDeleting} message="Deleting..." />

      <FloatingAlert
        visible={floatingAlert.visible}
        message={floatingAlert.message}
        type={floatingAlert.type}
        position={floatingAlert.position}
        actionLabel={floatingAlert.actionLabel}
        onAction={floatingAlert.onAction}
        onHide={() => setFloatingAlert((prev) => ({ ...prev, visible: false }))}
        duration={floatingAlert.duration}
      />

      <Header title="Saved Reports" />

      <InputModal
        visible={renameModalVisible}
        onClose={() => setRenameModalVisible(false)}
        onConfirm={saveRename}
        title="Rename Report"
        initialValue={selectedItem?.title || ""}
        placeholder="Enter report name"
        confirmLabel="Save"
      />

      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        anchor={menuAnchor}
        actions={[
          { label: "Share", icon: Share01Icon, onPress: handleShare },
          {
            label: "Rename",
            icon: PencilEdit02Icon,
            onPress: () => {
              setMenuVisible(false);
              setRenameModalVisible(true);
            },
          },
          {
            label: "Delete",
            icon: Delete02Icon,
            onPress: handleDelete,
            color: theme.colors.danger,
            destructive: true,
          },
        ]}
      />

      <View
        style={[
          styles.searchContainer,
          { borderBottomColor: theme.colors.border },
        ]}
      >
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <HugeiconsIcon
            icon={Search01Icon}
            size={20}
            color={theme.colors.textSecondary}
          />
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search reports..."
            placeholderTextColor={theme.colors.textSecondary}
            style={{
              flex: 1,
              fontSize: 15,
              color: theme.colors.text,
              paddingHorizontal: 10,
              height: "100%",
            }}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.colors.border + "30" },
                ]}
              >
                <HugeiconsIcon
                  icon={File02Icon}
                  size={40}
                  color={theme.colors.textSecondary}
                />
              </View>
              <Text style={[styles.emptyText, { color: theme.colors.text }]}>
                No reports found
              </Text>
              <Text
                style={[styles.emptySub, { color: theme.colors.textSecondary }]}
              >
                Generated reports will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchContainer: { padding: 16, paddingBottom: 12, borderBottomWidth: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    gap: 14,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, fontWeight: "500" },
  emptyContainer: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14 },
});
