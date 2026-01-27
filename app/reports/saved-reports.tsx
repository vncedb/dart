import {
  Cancel01Icon,
  Delete02Icon,
  Download01Icon,
  File02Icon,
  MoreVerticalCircle01Icon,
  PencilEdit02Icon,
  Search01Icon,
  Share01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  GestureResponderEvent,
  Image,
  Keyboard,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
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
  markReportRead,
  queueSyncItem,
  renameReportLocal,
  saveReportLocal,
} from "../../lib/database";
import { getDB } from "../../lib/db-client";
import { supabase } from "../../lib/supabase";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SavedReportsScreen() {
  const theme = useAppTheme();
  const { triggerSync } = useSync();

  const [reports, setReports] = useState<any[]>([]);
  const [filteredReports, setFilteredReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const deletedItemRef = useRef<any>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);

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

  const toggleSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery("");
      setFilteredReports(reports);
      Keyboard.dismiss();
    } else {
      setIsSearching(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // --- Header Renderers ---
  const renderHeaderTitle = () => {
    if (isSearching) {
      return (
        <View style={styles.searchHeaderContainer}>
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search reports..."
            placeholderTextColor={theme.colors.textSecondary}
            textAlignVertical="center"
            style={[
              styles.searchInput,
              { color: theme.colors.text, backgroundColor: theme.colors.card },
            ]}
          />
        </View>
      );
    }
    if (selectionMode) {
      return `${selectedIds.size} Selected`;
    }
    return "Saved Reports";
  };

  const renderLeftElement = () => {
    if (isSearching) return null;
    if (selectionMode) {
      return (
        <TouchableOpacity
          onPress={cancelSelection}
          style={styles.headerIconButton}
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={24}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderRightElement = () => {
    if (isSearching) {
      return (
        <TouchableOpacity onPress={toggleSearch} style={styles.headerIconButton}>
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={24}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      );
    }
    if (selectionMode) {
      return (
        <TouchableOpacity
          onPress={handleBulkDelete}
          style={styles.headerIconButton}
        >
          <HugeiconsIcon
            icon={Delete02Icon}
            size={24}
            color={theme.colors.danger}
          />
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity onPress={toggleSearch} style={styles.headerIconButton}>
        <HugeiconsIcon
          icon={Search01Icon}
          size={24}
          color={theme.colors.text}
        />
      </TouchableOpacity>
    );
  };

  // --- ACTIONS ---
  const handleMenu = (event: GestureResponderEvent, item: any) => {
    const { pageY, locationY } = event.nativeEvent;
    const anchorX = SCREEN_WIDTH - 20;
    const anchorY = pageY - locationY + 32;
    setMenuAnchor({ x: anchorX, y: anchorY });
    setSelectedItem(item);
    setMenuVisible(true);
  };

  const toggleSelection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
      if (newSet.size === 0) setSelectionMode(false);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const activateSelection = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
    setIsSearching(false);
  };

  const cancelSelection = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const prepareFileLocal = async (item: any) => {
    const safeFilename = item.title.replace(/[^a-zA-Z0-9 _-]/g, "_");
    const ext = item.file_type === "pdf" ? "pdf" : "xlsx";
    const expectedPath = `${FileSystem.documentDirectory}reports/${safeFilename}.${ext}`;

    if (item.file_path && item.file_path.startsWith("file://")) {
      const dbFileInfo = await FileSystem.getInfoAsync(item.file_path);
      if (dbFileInfo.exists) return item.file_path;
    }

    const expectedInfo = await FileSystem.getInfoAsync(expectedPath);
    if (expectedInfo.exists) {
      if (item.file_path !== expectedPath) {
        const db = await getDB();
        await db.runAsync(
          "UPDATE saved_reports SET file_path = ? WHERE id = ?",
          [expectedPath, item.id],
        );
      }
      return expectedPath;
    }

    if (!item.remote_url)
      throw new Error("File missing locally and no remote URL.");

    setFloatingAlert({
      visible: true,
      message: "Downloading file...",
      type: "info",
      position: "top",
    });

    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}reports/`,
      { intermediates: true },
    );

    const { uri } = await FileSystem.downloadAsync(
      item.remote_url,
      expectedPath,
    );

    try {
      const db = await getDB();
      await db.runAsync(
        "UPDATE saved_reports SET file_path = ? WHERE id = ?",
        [uri, item.id],
      );
      fetchReports();
    } catch {
      /* ignore */
    }

    setFloatingAlert((prev) => ({ ...prev, visible: false }));
    return uri;
  };

  const openReport = async (item: any) => {
    if (openingId) return;
    setOpeningId(item.id);

    try {
      if (!item.is_read) {
        await markReportRead(item.id);
        const updateRead = (r: any) =>
          r.id === item.id ? { ...r, is_read: 1 } : r;
        setReports((prev) => prev.map(updateRead));
        setFilteredReports((prev) => prev.map(updateRead));
      }

      const uri = await prepareFileLocal(item);
      const mimeType =
        item.file_type === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      if (Platform.OS === "android") {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
      } else {
        await Sharing.shareAsync(uri, {
          UTI:
            item.file_type === "pdf"
              ? "com.adobe.pdf"
              : "com.microsoft.excel.xls",
          mimeType,
          dialogTitle: item.title,
        });
      }
    } catch (e) {
      console.log("Open Error", e);
      setFloatingAlert({
        visible: true,
        message: "Could not open file.",
        type: "error",
        position: "top",
      });
    } finally {
      setOpeningId(null);
    }
  };

  const handleShare = async () => {
    setMenuVisible(false);
    if (!selectedItem) return;
    try {
      const uriToShare = await prepareFileLocal(selectedItem);
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
      if (item.file_path && item.file_path.startsWith("file://")) {
        const fileInfo = await FileSystem.getInfoAsync(item.file_path);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(item.file_path, { idempotent: true });
        }
      }
      if (item.remote_url) {
        await queueSyncItem("saved_reports", item.id, "DELETE", {
          remote_url: item.remote_url,
        });
        await triggerSync();
      }
    } catch {
      /* ignore */
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
    } catch {
      setFloatingAlert({
        visible: true,
        message: "Failed to restore.",
        type: "error",
        position: "top",
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setAlertConfig({
      visible: true,
      type: "confirm",
      title: "Delete Reports",
      message: `Are you sure you want to delete ${selectedIds.size} selected items?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        setIsDeleting(true);
        try {
          const ids = Array.from(selectedIds);
          for (const id of ids) {
            const item = reports.find((r) => r.id === id);
            if (item) {
              await deleteReportLocal(id);
              if (item.file_path && item.file_path.startsWith("file://")) {
                const fileInfo = await FileSystem.getInfoAsync(item.file_path);
                if (fileInfo.exists)
                  await FileSystem.deleteAsync(item.file_path, {
                    idempotent: true,
                  });
              }
              if (item.remote_url) {
                await queueSyncItem("saved_reports", id, "DELETE", {
                  remote_url: item.remote_url,
                });
              }
            }
          }
          triggerSync();
          await fetchReports();
          cancelSelection();
          setFloatingAlert({
            visible: true,
            message: "Reports deleted.",
            type: "success",
            position: "bottom",
          });
        } catch {
          setFloatingAlert({
            visible: true,
            message: "Failed to delete reports.",
            type: "error",
            position: "top",
          });
        } finally {
          setIsDeleting(false);
        }
      },
      onCancel: () =>
        setAlertConfig((prev: any) => ({ ...prev, visible: false })),
    });
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
        } catch {
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
      const ext = selectedItem.file_type === "pdf" ? "pdf" : "xlsx";
      const safeName = newName.replace(/[^a-zA-Z0-9 _-]/g, "_");
      const newFileName = `${safeName}.${ext}`;
      const reportsDir = `${FileSystem.documentDirectory}reports/`;
      const newPath = `${reportsDir}${newFileName}`;
      const oldPath = selectedItem.file_path;

      if (oldPath && oldPath.startsWith("file://")) {
        const fileInfo = await FileSystem.getInfoAsync(oldPath);
        if (fileInfo.exists) {
           await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
           await FileSystem.moveAsync({ from: oldPath, to: newPath });
        }
      }

      await renameReportLocal(selectedItem.id, newName, newPath);
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
    const isUnread = !item.is_read;
    const isOpening = openingId === item.id;
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        onPress={() =>
          selectionMode ? toggleSelection(item.id) : openReport(item)
        }
        onLongPress={() => !selectionMode && activateSelection(item.id)}
        activeOpacity={0.7}
        disabled={isOpening}
        style={[
          styles.card,
          {
            backgroundColor: isSelected
              ? theme.colors.primary + "10"
              : theme.colors.card,
            borderColor: isSelected
              ? theme.colors.primary
              : theme.colors.border,
          },
        ]}
      >
        {selectionMode && (
          <View style={{ marginRight: 12 }}>
            {isSelected ? (
              <HugeiconsIcon
                icon={Tick02Icon}
                size={24}
                color={theme.colors.primary}
              />
            ) : (
              <View
                style={[
                  styles.checkbox,
                  { borderColor: theme.colors.textSecondary },
                ]}
              />
            )}
          </View>
        )}

        <View
          style={[
            styles.iconBox,
            { backgroundColor: isPdf ? "#D9151910" : "#107C4110" },
          ]}
        >
          {isOpening ? (
            <ActivityIndicator
              size="small"
              color={isPdf ? "#D91519" : "#107C41"}
            />
          ) : (
            // Changed to use custom images from assets
            <Image
                source={isPdf 
                    ? require("../../assets/icons/custom-icons/pdf.png") 
                    : require("../../assets/icons/custom-icons/xlsx.png")
                }
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
            />
          )}
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.titleRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.cardTitle,
                {
                  color: theme.colors.text,
                  fontWeight: isUnread ? "800" : "600",
                },
              ]}
            >
              {item.title}
            </Text>
            {isUnread && (
              <View
                style={[
                  styles.unreadDot,
                  { backgroundColor: theme.colors.primary },
                ]}
              />
            )}
          </View>

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

        {!selectionMode && (
          <TouchableOpacity
            onPress={(e) => handleMenu(e, item)}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={{ padding: 4 }}
          >
            <HugeiconsIcon
              icon={MoreVerticalCircle01Icon}
              size={20}
              color={theme.colors.icon}
            />
          </TouchableOpacity>
        )}
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

      <Header
        title={renderHeaderTitle()}
        leftElement={renderLeftElement()}
        rightElement={renderRightElement()}
      />

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
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    gap: 14,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "500",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySub: {
    fontSize: 14,
  },
  searchHeaderContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center", // Vertically center the input
    height: "100%", // Take up full header height
  },
  searchInput: {
    height: 40, // Fixed height for alignment
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    width: "100%",
    paddingVertical: 0, // Removes default Android top/bottom padding
  },
  headerIconButton: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});