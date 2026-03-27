// filepath: app/reports/saved-reports.tsx
import { ArrowDown01Icon, ArrowUp01Icon, Calendar02Icon, CloudDownloadIcon, Delete02Icon, Download04Icon, File01Icon, File02Icon, Files01Icon, FilterHorizontalIcon, MoreVerticalIcon, Pdf01Icon, Search01Icon, Share08Icon, SortByDown01Icon, SortByUp01Icon, TextIcon, TypeCursorIcon, Xls01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../../components/ActionMenu';
import FilePropertiesModal from '../../components/FilePropertiesModal';
import Header from '../../components/Header';
import InputModal from '../../components/InputModal';
import LoadingScreen from '../../components/LoadingScreen';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { deleteReportLocal, markReportReadLocal, queueSyncItem, renameReportLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { deleteReportFile, exportReportFileToDevice, getReportFileExtension, getReportMimeType, getSafeFileInfo, renameReportFileOffline, saveReportFileOffline } from '../../lib/report-storage';
import { normalizeReportFormat, parseSavedReportMetadata, reconcileStoredReportFiles, serializeSavedReportMetadata } from '../../lib/reporting';

const iconPdf = require('../../assets/icons/custom-icons/pdf.png');
const iconXlsx = require('../../assets/icons/custom-icons/xlsx.png');

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export default function SavedReportsScreen() {
    const theme = useAppTheme();
    const { user } = useAuth();
    const { triggerSync } = useSync();
    
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [backupingId, setBackupingId] = useState<string | null>(null);
    const [backupProgress, setBackupProgress] = useState<Record<string, number>>({});
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [searchQuery, setSearchQuery] = useState('');

    const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [sortMenuVisible, setSortMenuVisible] = useState(false);
    const [sortMenuAnchor, setSortMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const sortIconRef = useRef<View>(null);

    const [fileFilter, setFileFilter] = useState<'all' | 'pdf' | 'xlsx'>('all');
    const [filterMenuVisible, setFilterMenuVisible] = useState(false);
    const [filterMenuAnchor, setFilterMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const filterIconRef = useRef<View>(null);

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [propertiesModalVisible, setPropertiesModalVisible] = useState(false);
    const [renameModalVisible, setRenameModalVisible] = useState(false);

    const fetchReports = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const verifiedData = await reconcileStoredReportFiles(user.id);
            setReports(verifiedData.filter((report) => report.isLocal || report.remote_url || report.file_url || report.public_url));

        } catch (error) {
            console.error('Failed to fetch saved reports', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

    const filteredReports = useMemo(() => {
        const base = reports.filter((report) => {
            const normalizedType = normalizeReportFormat(report.file_type);
            if (fileFilter === 'pdf') return normalizedType === 'pdf';
            if (fileFilter === 'xlsx') return normalizedType === 'xlsx';
            return true;
        });

        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return base;

        return base.filter((report) => {
            const meta = parseSavedReportMetadata(report.metadata);
            const haystack = [
                report.title,
                report.period_key,
                meta.reportDate,
                meta.periodLabel,
                meta.company,
                meta.department,
                meta.generatedBy,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(needle);
        });
    }, [reports, fileFilter, searchQuery]);

    const sortedReports = useMemo(() => {
        const sorted = [...filteredReports].sort((a, b) => {
            let res = 0;
            if (sortBy === 'name') {
                res = (a.title || '').localeCompare(b.title || '');
            } else if (sortBy === 'date') {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                res = dateA - dateB;
            } else if (sortBy === 'size') {
                res = (a.file_size || 0) - (b.file_size || 0);
            }
            return sortOrder === 'asc' ? res : -res;
        });
        return sorted;
    }, [filteredReports, sortBy, sortOrder]);

    const openSortMenu = () => {
        if (sortIconRef.current) {
            sortIconRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                setSortMenuAnchor({ x: pageX + width, y: pageY + height });
                setSortMenuVisible(true);
            });
        }
    };

    const openFilterMenu = () => {
        if (filterIconRef.current) {
            filterIconRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                setFilterMenuAnchor({ x: pageX, y: pageY + height });
                setFilterMenuVisible(true);
            });
        }
    };

    const openMenu = (event: any, report: any) => {
        event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
            setMenuAnchor({ x: pageX + width, y: pageY + height });
            setSelectedReport(report);
            setMenuVisible(true);
        });
    };

    const resolveShareableUri = async (report: any) => {
        const localPath = report?.localPath;
        if (!localPath) {
            throw new Error('MISSING_LOCAL_FILE');
        }

        const fileInfo = await getSafeFileInfo(localPath);
        if (!fileInfo.exists || fileInfo.size === 0) {
            throw new Error('CORRUPTED');
        }

        if (!localPath.startsWith('content://')) {
            return localPath;
        }

        const extension = getReportFileExtension(report.file_type);
        const shareDir = `${FileSystem.cacheDirectory}shared-reports/`;
        const shareName = `${(report.title || 'report').replace(/[<>:\"/\\\\|?*\u0000-\u001F]/g, '_')}-${report.id}.${extension}`;
        const shareUri = `${shareDir}${shareName}`;

        const dirInfo = await FileSystem.getInfoAsync(shareDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(shareDir, { intermediates: true });
        }

        await FileSystem.deleteAsync(shareUri, { idempotent: true });
        const base64Data = await FileSystem.readAsStringAsync(localPath, { encoding: 'base64' });
        await FileSystem.writeAsStringAsync(shareUri, base64Data, { encoding: 'base64' });

        const sharedInfo = await getSafeFileInfo(shareUri);
        if (!sharedInfo.exists || sharedInfo.size === 0) {
            throw new Error('SHARE_COPY_FAILED');
        }

        return shareUri;
    };

    const executeDelete = async (report: any) => {
        try {
            const fileInfo = await getSafeFileInfo(report.localPath);
            if (fileInfo.exists && report.localPath) {
                await deleteReportFile(report.localPath);
            }

            await deleteReportLocal(report.id);
            fetchReports();
        } catch (error) { 
            console.error("Delete error:", error); 
        }
    };

    const cacheRemoteReportLocally = useCallback(async (report: any) => {
        const fileUrl = report.file_url || report.remote_url || report.public_url;
        if (!fileUrl) {
            throw new Error('REMOTE_MISSING');
        }

        const extension = getReportFileExtension(report.file_type);
        const tempUri = `${FileSystem.cacheDirectory}temp_download_${Date.now()}.${extension}`;
        await FileSystem.downloadAsync(fileUrl, tempUri);

        const preferredName =
            (() => {
                const meta = parseSavedReportMetadata(report.metadata);
                if (meta?.fileName) return meta.fileName;
                const safeTitle = (report.title || `Saved_Report_${Date.now()}`).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_');
                return safeTitle.toLowerCase().endsWith(`.${extension}`) ? safeTitle : `${safeTitle}.${extension}`;
            })();

        const savedFile = await saveReportFileOffline({
            sourceUri: tempUri,
            fileName: preferredName,
            fileType: report.file_type,
        });
        await FileSystem.deleteAsync(tempUri, { idempotent: true });

        const db = await getDB();
        await db.runAsync(
            'UPDATE saved_reports SET file_path = ?, file_size = ?, metadata = ?, updated_at = ? WHERE id = ?',
            [
                savedFile.filePath,
                savedFile.fileSize || report.file_size || 0,
                serializeSavedReportMetadata({
                    ...parseSavedReportMetadata(report.metadata),
                    fileName: preferredName,
                }),
                new Date().toISOString(),
                report.id,
            ],
        );

        const nextReport = { ...report, file_path: savedFile.filePath, file_size: savedFile.fileSize || report.file_size || 0, isLocal: true, localPath: savedFile.filePath };
        setReports(prev => prev.map(r => r.id === report.id ? nextReport : r));
        return nextReport;
    }, []);

    const handleOpen = async (report: any) => {
        setMenuVisible(false);
        try {
            const readyReport = report.isLocal ? report : await cacheRemoteReportLocally(report);
            const fileInfo = await getSafeFileInfo(readyReport.localPath);
            if (!fileInfo.exists || fileInfo.size === 0) {
                throw new Error("CORRUPTED");
            }

        const extension = getReportFileExtension(readyReport.file_type);
        const isPdf = extension === 'pdf';
        const mimeType = getReportMimeType(readyReport.file_type);
        const uti = isPdf ? 'com.adobe.pdf' : 'com.microsoft.excel.xls';

            if (Platform.OS === 'android') {
                try {
                    let uriToOpen = readyReport.localPath;
                    if (!uriToOpen.startsWith('content://')) {
                        uriToOpen = await FileSystem.getContentUriAsync(uriToOpen);
                    }
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                        data: uriToOpen,
                        flags: 1,
                        type: mimeType
                    });
                } catch {
                    await Sharing.shareAsync(readyReport.localPath, { dialogTitle: 'Open File', mimeType, UTI: uti });
                }
            } else {
                await Sharing.shareAsync(readyReport.localPath, { dialogTitle: 'Open File', UTI: uti });
            }

        } catch (error: any) { 
            console.error('Open error:', error); 
            setAlertConfig({
                visible: true, type: 'error', title: 'File Unavailable', 
                message: 'This file is missing or corrupted. It was likely deleted outside of the app. Would you like to remove this entry from your list?', 
                confirmText: 'Remove Entry', cancelText: 'Cancel',
                onConfirm: async () => {
                    setAlertConfig({ visible: false });
                    setLoading(true);
                    await executeDelete(report);
                    setLoading(false);
                },
                onCancel: () => setAlertConfig({ visible: false })
            });
        }
    };

    const handleShare = async (report: any) => {
        setMenuVisible(false);
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            const readyReport = report.isLocal ? report : await cacheRemoteReportLocally(report);
            if (isAvailable && readyReport.localPath) {
                const extension = getReportFileExtension(readyReport.file_type);
                const isPdf = extension === 'pdf';
                const mimeType = getReportMimeType(readyReport.file_type);
                const uti = isPdf ? 'com.adobe.pdf' : 'com.microsoft.excel.xls';
                const shareUri = await resolveShareableUri(readyReport);

                await Sharing.shareAsync(shareUri, { dialogTitle: 'Share File', mimeType, UTI: uti });
            } else {
                setAlertConfig({ visible: true, type: 'error', title: 'Share Unavailable', message: 'This report could not be prepared for sharing.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
            }
        } catch (error) { 
            console.error('Share error:', error); 
            setAlertConfig({
                visible: true, type: 'error', title: 'File Unavailable', 
                message: 'This file is missing or corrupted. It was likely deleted outside of the app. Would you like to remove this entry from your list?', 
                confirmText: 'Remove Entry', cancelText: 'Cancel',
                onConfirm: async () => {
                    setAlertConfig({ visible: false });
                    setLoading(true);
                    await executeDelete(report);
                    setLoading(false);
                },
                onCancel: () => setAlertConfig({ visible: false })
            });
        }
    };

    const handleDownload = async (report: any) => {
        setDownloadingId(report.id);
        try {
            return await cacheRemoteReportLocally(report);
        } catch (error) {
            console.error(error);
            setAlertConfig({ visible: true, type: 'error', title: 'Download Failed', message: 'Failed to restore the report to app storage. Please check your connection.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
            return null;
        } finally {
            setDownloadingId(null);
        }
    };

    const handleSaveToDevice = async (report: any) => {
        setMenuVisible(false);
        setDownloadingId(report.id);
        try {
            const readyReport = report.isLocal ? report : await cacheRemoteReportLocally(report);
            const meta = parseSavedReportMetadata(readyReport.metadata);
            await exportReportFileToDevice({
                sourceUri: readyReport.localPath,
                fileName: meta.fileName || `${readyReport.title}.${getReportFileExtension(readyReport.file_type)}`,
                fileType: readyReport.file_type,
            });

            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Saved to Device',
                message: 'A copy of this report was exported to Documents/DART/Reports.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
        } catch (error) {
            console.error('Save to device error:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Save to Device Failed',
                message: 'Could not export this report to Documents/DART/Reports.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const handleBackup = async (report: any) => {
        setMenuVisible(false);

        if (!report?.isLocal || !report?.localPath) {
            setAlertConfig({
                visible: true,
                type: 'info',
                title: 'Already Backed Up',
                message: 'This report already exists online. Download it to this device only if you need a local copy.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
            return;
        }

        if (report.is_synced === 1 && (report.remote_url || report.file_url || report.public_url)) {
            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Already Backed Up',
                message: 'This report already has an online backup.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
            return;
        }

        try {
            setBackupingId(report.id);
            setBackupProgress((prev) => ({ ...prev, [report.id]: 15 }));

            const db = await getDB();
            const currentReport: any = await db.getFirstAsync('SELECT * FROM saved_reports WHERE id = ?', [report.id]);
            if (!currentReport) {
                throw new Error('REPORT_NOT_FOUND');
            }

            setBackupProgress((prev) => ({ ...prev, [report.id]: 40 }));
            await queueSyncItem('saved_reports', report.id, 'UPSERT', currentReport);

            setBackupProgress((prev) => ({ ...prev, [report.id]: 65 }));
            const synced = await triggerSync();

            setBackupProgress((prev) => ({ ...prev, [report.id]: synced ? 100 : 0 }));
            await fetchReports();

            if (!synced) {
                throw new Error('BACKUP_FAILED');
            }

            setAlertConfig({
                visible: true,
                type: 'success',
                title: 'Backup Complete',
                message: 'This report was uploaded to online backup storage.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
        } catch (error) {
            console.error('Backup error:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Backup Failed',
                message: 'Could not back up this report right now. Please check your connection and try again.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
        } finally {
            const reportId = report?.id;
            setBackupingId(null);
            if (reportId) {
                setTimeout(() => {
                    setBackupProgress((prev) => {
                        const next = { ...prev };
                        delete next[reportId];
                        return next;
                    });
                }, 1200);
            }
        }
    };

    const handleCardPress = async (report: any) => {
        if (!report.is_read || report.is_read === 0) {
            try {
                await markReportReadLocal(report.id);
                setReports(prev => prev.map(r => r.id === report.id ? { ...r, is_read: 1 } : r));
            } catch (e) {
                console.error("Failed marking read", e);
            }
        }

        if (report.isLocal) {
            handleOpen(report);
        } else {
            const restored = await handleDownload(report);
            if (restored) {
                await handleOpen(restored);
            }
        }
    };

    const handleDelete = (report: any) => {
        setMenuVisible(false);
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete File', message: 'Are you sure you want to permanently delete this report from app storage and remove it from Saved Reports?',
            confirmText: 'Delete', cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig({ visible: false });
                setLoading(true);
                await executeDelete(report);
                setLoading(false);
            },
            onCancel: () => setAlertConfig({ visible: false })
        });
    };

    const handleRenameRequest = (report: any) => {
        setMenuVisible(false);
        if (!report?.isLocal || !report?.localPath) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Rename Unavailable',
                message: 'Download the file to your device first before renaming it.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
            return;
        }
        setSelectedReport(report);
        setRenameModalVisible(true);
    };

    const handleRenameConfirm = async (value: string) => {
        if (!selectedReport) return;
        const nextName = value.trim();
        if (!nextName) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Missing File Name',
                message: 'Please enter a file name.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
            return;
        }

        try {
            setLoading(true);
            const renamed = await renameReportFileOffline({
                currentUri: selectedReport.localPath,
                nextFileName: nextName,
                fileType: selectedReport.file_type,
            });

            const nextTitle = renamed.fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
            await renameReportLocal(selectedReport.id, nextTitle || selectedReport.title, {
                newPath: renamed.filePath,
                fileSize: renamed.fileSize || selectedReport.file_size || 0,
                metadata: serializeSavedReportMetadata({
                    ...parseSavedReportMetadata(selectedReport.metadata),
                    fileName: renamed.fileName,
                }),
            });

            setRenameModalVisible(false);
            await fetchReports();
        } catch (error) {
            console.error('Rename error:', error);
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Rename Failed',
                message: 'The file could not be renamed. Please try again.',
                confirmText: 'OK',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const extension = getReportFileExtension(item.file_type);
        const isPdf = extension === 'pdf';
        const fileIcon = isPdf ? iconPdf : iconXlsx;
        const iconBg = isPdf ? theme.colors.danger + '12' : theme.colors.success + '12';
        
        const isUnread = !item.is_read || item.is_read === 0;
        const isDownloading = downloadingId === item.id;

        const meta = parseSavedReportMetadata(item.metadata);
        
        const reportDateStr = meta.reportDate || item.period_key || format(new Date(item.created_at), 'MMM dd, yyyy');
        const activeBackupProgress = backupProgress[item.id];
        const statusLabel =
            typeof activeBackupProgress === 'number'
                ? `Backing Up ${activeBackupProgress}%`
                : item.isLocal
                    ? (item.is_synced ? 'Saved & Backed Up' : 'Saved To Device')
                    : 'Backed Up';
        const statusColor =
            typeof activeBackupProgress === 'number'
                ? theme.colors.primary
                : item.isLocal
                    ? (item.is_synced ? theme.colors.success : theme.colors.warning)
                    : theme.colors.primary;
        
        const ext = extension === 'pdf' ? '.pdf' : '.xlsx';
        const displayTitle = (item.title || '').toLowerCase().endsWith(ext) ? item.title : `${item.title}${ext}`;

        return (
            <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => handleCardPress(item)} 
                style={[styles.fileCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
            >
                <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
                    <Image source={fileIcon} style={styles.fileIcon} resizeMode="contain" />
                </View>

                <View style={styles.fileDetails}>
                    <Text 
                        style={[
                            styles.fileName, 
                            { color: isUnread ? theme.colors.text : theme.colors.textSecondary }
                        ]} 
                        numberOfLines={2} 
                        ellipsizeMode="tail"
                    >
                        {displayTitle}
                    </Text>
                    
                    <View style={styles.fileMetaRow}>
                        <Text style={[styles.fileMetaText, { color: theme.colors.textSecondary }]}>
                            {reportDateStr}
                        </Text>
                        <View style={[styles.metaDot, { backgroundColor: theme.colors.textSecondary }]} />
                        <Text style={[styles.fileMetaText, { color: theme.colors.textSecondary }]}>
                            {formatBytes(item.file_size)}
                        </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: statusColor + '15' }]}>
                        <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                </View>

                <View style={styles.actionZone}>
                    {isDownloading || backupingId === item.id ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 12 }} />
                    ) : !item.isLocal ? (
                        <View style={styles.cloudBadge}>
                            <HugeiconsIcon icon={CloudDownloadIcon} size={20} color={theme.colors.primary} />
                        </View>
                    ) : null}

                    {isUnread && item.isLocal && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
                    
                    <TouchableOpacity onPress={(event) => openMenu(event, item)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} style={styles.moreBtn}>
                        <HugeiconsIcon icon={MoreVerticalIcon} size={22} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <ModernAlert {...alertConfig} />

            {propertiesModalVisible && selectedReport && (
                <FilePropertiesModal
                    visible={propertiesModalVisible}
                    onClose={() => setPropertiesModalVisible(false)}
                    report={selectedReport}
                />
            )}

            <InputModal
                visible={renameModalVisible}
                onClose={() => setRenameModalVisible(false)}
                onConfirm={handleRenameConfirm}
                title="Rename File"
                initialValue={selectedReport?.title || ''}
                placeholder="Enter new file name"
                confirmLabel="Rename"
            />
            
            <Header 
                title="Saved Reports" 
                rightElement={
                    <View ref={sortIconRef} collapsable={false}>
                        <TouchableOpacity onPress={openSortMenu} style={{ padding: 8 }}>
                            <HugeiconsIcon icon={FilterHorizontalIcon} size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                }
            />

            <ActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                actions={[
                    { label: 'View Details', icon: File02Icon, color: theme.colors.textSecondary, onPress: () => { setMenuVisible(false); setTimeout(() => setPropertiesModalVisible(true), 150); } },
                    { label: 'Back Up Online', icon: CloudDownloadIcon, color: selectedReport?.isLocal && selectedReport?.is_synced !== 1 ? theme.colors.success : theme.colors.textSecondary, onPress: () => handleBackup(selectedReport) },
                    { label: 'Rename', icon: TypeCursorIcon, color: selectedReport?.isLocal ? theme.colors.warning : theme.colors.textSecondary, onPress: () => handleRenameRequest(selectedReport) },
                    { label: 'Share', icon: Share08Icon, color: selectedReport?.isLocal ? theme.colors.primary : theme.colors.textSecondary, onPress: () => handleShare(selectedReport) },
                    { label: 'Export to Device', icon: Download04Icon, color: theme.colors.primary, onPress: () => handleSaveToDevice(selectedReport) },
                    { label: 'Delete Report', icon: Delete02Icon, color: theme.colors.danger, destructive: true, onPress: () => handleDelete(selectedReport) }
                ]}
            />

            <ActionMenu
                visible={sortMenuVisible}
                onClose={() => setSortMenuVisible(false)}
                anchor={sortMenuAnchor}
                actions={[
                    { label: 'Sort by Name', icon: TextIcon, isActive: sortBy === 'name', color: theme.colors.text, onPress: () => setSortBy('name') },
                    { label: 'Sort by Date', icon: Calendar02Icon, isActive: sortBy === 'date', color: theme.colors.text, onPress: () => setSortBy('date') },
                    { label: 'Sort by Size', icon: File01Icon, isActive: sortBy === 'size', color: theme.colors.text, onPress: () => setSortBy('size') },
                    { isDivider: true },
                    { label: 'Ascending', icon: SortByDown01Icon, isActive: sortOrder === 'asc', color: theme.colors.text, onPress: () => setSortOrder('asc') },
                    { label: 'Descending', icon: SortByUp01Icon, isActive: sortOrder === 'desc', color: theme.colors.text, onPress: () => setSortOrder('desc') }
                ]}
            />

            <ActionMenu
                visible={filterMenuVisible}
                onClose={() => setFilterMenuVisible(false)}
                anchor={filterMenuAnchor}
                actions={[
                    { label: 'All Files', icon: Files01Icon, isActive: fileFilter === 'all', color: theme.colors.text, onPress: () => { setFileFilter('all'); setFilterMenuVisible(false); } },
                    { label: 'PDF Documents', icon: Pdf01Icon, isActive: fileFilter === 'pdf', color: theme.colors.danger, onPress: () => { setFileFilter('pdf'); setFilterMenuVisible(false); } },
                    { label: 'Excel Spreadsheets', icon: Xls01Icon, isActive: fileFilter === 'xlsx', color: theme.colors.success, onPress: () => { setFileFilter('xlsx'); setFilterMenuVisible(false); } },
                ]}
            />

            {loading ? (
                <LoadingScreen variant="reports" message="Loading saved reports..." />
            ) : (
                <FlatList
                    data={sortedReports}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        reports.length > 0 ? (
                            <View>
                                <View style={[styles.searchBar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <HugeiconsIcon icon={Search01Icon} size={18} color={theme.colors.textSecondary} />
                                    <TextInput
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholder="Search reports or date..."
                                        placeholderTextColor={theme.colors.textSecondary}
                                        style={[styles.searchInput, { color: theme.colors.text }]}
                                    />
                                </View>
                                <View style={styles.listHeader}>
                                    <View ref={filterIconRef} collapsable={false}>
                                        <TouchableOpacity onPress={openFilterMenu} style={styles.filterBtn}>
                                            <Text style={[styles.listHeaderTitle, { color: theme.colors.textSecondary }]}>
                                                {fileFilter === 'all' ? 'ALL FILES' : fileFilter === 'pdf' ? 'PDF FILES' : 'EXCEL FILES'}
                                            </Text>
                                            <HugeiconsIcon icon={filterMenuVisible ? ArrowUp01Icon : ArrowDown01Icon} size={16} color={theme.colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={[styles.listHeaderCount, { color: theme.colors.textSecondary }]}>
                                        {sortedReports.length} {sortedReports.length === 1 ? 'item' : 'items'}
                                    </Text>
                                </View>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <HugeiconsIcon icon={Search01Icon} size={32} color={theme.colors.textSecondary} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Files Found</Text>
                            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>Generated reports will appear here for easy access and sharing.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 50, marginBottom: 16 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
    
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
    filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    listHeaderTitle: { fontSize: 13, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    listHeaderCount: { fontSize: 13, fontFamily: 'Nunito_700Bold' },

    fileCard: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12, borderRadius: 18, borderWidth: 1, minHeight: 96 },
    iconContainer: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14, marginTop: 2 },
    fileIcon: { width: 24, height: 24 },
    
    fileDetails: { flex: 1, justifyContent: 'center', paddingRight: 10, minWidth: 0 },
    fileName: { fontSize: 15, fontFamily: 'Nunito_700Bold', letterSpacing: -0.2, marginBottom: 8, lineHeight: 21 },
    
    fileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    fileMetaText: { fontSize: 12, fontFamily: 'Nunito_700Bold', lineHeight: 16, flexShrink: 1 },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, opacity: 0.5 },
    statusPill: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    statusPillText: { fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.4, textTransform: 'uppercase' },
    
    actionZone: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4, paddingTop: 4, alignSelf: 'stretch' },
    cloudBadge: { marginRight: 10, opacity: 0.8, marginTop: 8 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8, marginTop: 12 },
    moreBtn: { padding: 4, marginTop: 4 },

    emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 30 },
    emptyIconContainer: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: -0.3 },
    emptySubtitle: { fontSize: 14, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22 }
});

