// filepath: app/reports/saved-reports.tsx
import { ArrowDown01Icon, ArrowUp01Icon, Calendar02Icon, CloudDownloadIcon, Delete02Icon, File01Icon, File02Icon, Files01Icon, FilterHorizontalIcon, Folder01Icon, MoreVerticalIcon, Pdf01Icon, Search01Icon, Share08Icon, SortByDown01Icon, SortByUp01Icon, TextIcon, ViewIcon, Xls01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../../components/ActionMenu';
import Button from '../../components/Button';
import FilePropertiesModal from '../../components/FilePropertiesModal';
import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { ensureDartReportsDirectory } from '../../lib/saf-directory';

const iconPdf = require('../../assets/icons/custom-icons/pdf.png');
const iconXlsx = require('../../assets/icons/custom-icons/xlsx.png');

const REPORTS_DIR = `${FileSystem.documentDirectory}DART/Reports/`;

const ensureReportsDirExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(REPORTS_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
    }
};

// Safe File Checker: Prevents crashing when Android SAF throws an IOException on deleted files
const getSafeFileInfo = async (uri: string | null) => {
    if (!uri) return { exists: false, size: 0 };
    try {
        const info = await FileSystem.getInfoAsync(uri);
        return { exists: info.exists, size: info.exists ? info.size : 0 };
    } catch {
        return { exists: false, size: 0 };
    }
};

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
    
    const [hasStoragePermission, setHasStoragePermission] = useState(Platform.OS === 'ios');
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

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

    useEffect(() => {
        if (Platform.OS === 'android') {
            AsyncStorage.getItem('reports_directory_uri').then(uri => {
                if (uri) setHasStoragePermission(true);
            });
        }
    }, []);

    const requestPermission = async () => {
        try {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
                const finalUri = await ensureDartReportsDirectory(permissions.directoryUri);
                await AsyncStorage.setItem('reports_directory_uri', finalUri);
                setHasStoragePermission(true);
                fetchReports();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const syncReportsToCloud = useCallback(async () => {
        if (!user) return;
        const state = await NetInfo.fetch();
        if (!state.isConnected) return;

        try {
            const db = await getDB();
            const pendingReports: any[] = await db.getAllAsync('SELECT * FROM saved_reports WHERE user_id = ? AND is_synced = 0 AND deleted_at IS NULL AND file_path IS NOT NULL', [user.id]);
            
            for (const report of pendingReports) {
                if (report.file_url) {
                    await db.runAsync('UPDATE saved_reports SET is_synced = 1 WHERE id = ?', [report.id]);
                    continue;
                }

                const fileInfo = await getSafeFileInfo(report.file_path);
                if (fileInfo.exists) {
                    let uploadUri = report.file_path;
                    let isTemp = false;

                    if (uploadUri.startsWith('content://')) {
                        const tempUri = `${FileSystem.cacheDirectory}upload_temp_${Date.now()}.pdf`;
                        const b64 = await FileSystem.readAsStringAsync(uploadUri, { encoding: 'base64' });
                        await FileSystem.writeAsStringAsync(tempUri, b64, { encoding: 'base64' });
                        uploadUri = tempUri;
                        isTemp = true;
                    }

                    const response = await fetch(uploadUri);
                    const arrayBuffer = await response.arrayBuffer();
                    
                    const fileExt = report.file_type === 'pdf' || report.file_type === 'application/pdf' ? 'pdf' : 'xlsx';
                    const match = report.file_path.match(/ACCOMPLISHMENT_REPORT_(\d{13})/);
                    const cleanName = match ? match[0] : `${report.id}_${Date.now()}`;
                    const fileName = `${user.id}/${cleanName}.${fileExt}`;
                    
                    const { error: uploadError } = await supabase.storage.from('generated_reports').upload(fileName, arrayBuffer, { contentType: `application/${fileExt}`, upsert: true });
                    
                    if (isTemp) {
                        await FileSystem.deleteAsync(uploadUri, { idempotent: true });
                    }

                    if (!uploadError) {
                        const { data } = supabase.storage.from('generated_reports').getPublicUrl(fileName);
                        const newUrl = data.publicUrl;
                        
                        try {
                            await db.runAsync('UPDATE saved_reports SET file_url = ?, remote_url = ?, is_synced = 1 WHERE id = ?', [newUrl, newUrl, report.id]);
                        } catch (dbError: any) {
                            if (dbError?.message?.includes('no such column: file_url')) {
                                await db.runAsync('UPDATE saved_reports SET remote_url = ?, is_synced = 1 WHERE id = ?', [newUrl, report.id]);
                            } else {
                                throw dbError;
                            }
                        }
                        await queueSyncItem('saved_reports', report.id, 'UPDATE', { file_url: newUrl, remote_url: newUrl, is_synced: 1 });
                        
                        setReports(prev => prev.map(r => r.id === report.id ? { ...r, file_url: newUrl, remote_url: newUrl, is_synced: 1 } : r));
                    }
                }
            }
        } catch (error) {
            console.error("Cloud Sync Error:", error);
        }
    }, [user]);

    const fetchReports = useCallback(async () => {
        if (!user) return;
        try {
            await ensureReportsDirExists();
            const db = await getDB();
            const data: any[] = await db.getAllAsync('SELECT * FROM saved_reports WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [user.id]);
            
            const verifiedData = await Promise.all(data.map(async (report) => {
                let isLocal = false;
                const fileInfo = await getSafeFileInfo(report.file_path);
                if (fileInfo.exists) {
                    isLocal = true;
                }
                return { ...report, isLocal, localPath: report.file_path };
            }));

            setReports(verifiedData);
            syncReportsToCloud();

        } catch (error) {
            console.error('Failed to fetch saved reports', error);
        } finally {
            setLoading(false);
        }
    }, [user, syncReportsToCloud]);

    useFocusEffect(useCallback(() => { if(hasStoragePermission) fetchReports(); }, [fetchReports, hasStoragePermission]));

    const filteredReports = useMemo(() => {
        if (fileFilter === 'all') return reports;
        if (fileFilter === 'pdf') return reports.filter(r => r.file_type === 'pdf' || r.file_type === 'application/pdf');
        if (fileFilter === 'xlsx') return reports.filter(r => r.file_type === 'xlsx' || r.file_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return reports;
    }, [reports, fileFilter]);

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

    const executeDelete = async (report: any) => {
        try {
            const db = await getDB();
            
            const fileUrl = report.file_url || report.remote_url || report.public_url;
            if (fileUrl) {
                const bucketMatch = fileUrl.match(/\/object\/public\/([^/]+)\/(.+)$/);
                if (bucketMatch) {
                    const bucket = bucketMatch[1];
                    const path = bucketMatch[2].split('?')[0]; 
                    const { error } = await supabase.storage.from(bucket).remove([path]);
                    if (error) console.error("Failed to delete from storage:", error);
                }
            }

            const fileInfo = await getSafeFileInfo(report.localPath);
            if (fileInfo.exists && report.localPath) {
                await FileSystem.deleteAsync(report.localPath, { idempotent: true });
            }

            await db.runAsync('DELETE FROM saved_reports WHERE id = ?', [report.id]);
            await queueSyncItem('saved_reports', report.id, 'DELETE');
            
            fetchReports();
        } catch (error) { 
            console.error("Delete error:", error); 
        }
    };

    const handleOpen = async (report: any) => {
        setMenuVisible(false);
        try {
            const fileInfo = await getSafeFileInfo(report.localPath);
            if (!fileInfo.exists || fileInfo.size === 0) {
                throw new Error("CORRUPTED");
            }

            const isPdf = report.file_type === 'pdf' || report.file_type === 'application/pdf';
            const mimeType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const uti = isPdf ? 'com.adobe.pdf' : 'com.microsoft.excel.xls';

            if (Platform.OS === 'android') {
                try {
                    let uriToOpen = report.localPath;
                    if (!uriToOpen.startsWith('content://')) {
                        uriToOpen = await FileSystem.getContentUriAsync(uriToOpen);
                    }
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                        data: uriToOpen,
                        flags: 1,
                        type: mimeType
                    });
                } catch {
                    await Sharing.shareAsync(report.localPath, { dialogTitle: 'Open File', mimeType, UTI: uti });
                }
            } else {
                await Sharing.shareAsync(report.localPath, { dialogTitle: 'Open File', UTI: uti });
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
            if (isAvailable && report.isLocal && report.localPath) {
                const fileInfo = await getSafeFileInfo(report.localPath);
                if (!fileInfo.exists || fileInfo.size === 0) {
                    throw new Error("CORRUPTED");
                }
                const isPdf = report.file_type === 'pdf' || report.file_type === 'application/pdf';
                const mimeType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                const uti = isPdf ? 'com.adobe.pdf' : 'com.microsoft.excel.xls';

                await Sharing.shareAsync(report.localPath, { dialogTitle: 'Share File', mimeType, UTI: uti });
            } else {
                setAlertConfig({ visible: true, type: 'error', title: 'File Missing', message: 'File must be downloaded to your device before sharing.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
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
        const fileUrl = report.file_url || report.remote_url || report.public_url;
        
        if (!fileUrl) {
            setAlertConfig({ 
                visible: true, 
                type: 'error', 
                title: 'File Unavailable', 
                message: 'This file was deleted from your device storage before it could be backed up to the cloud. It cannot be recovered.\n\nWould you like to remove this entry from your list?', 
                confirmText: 'Remove Entry', 
                cancelText: 'Keep',
                onConfirm: async () => {
                    setAlertConfig({ visible: false });
                    setLoading(true);
                    await executeDelete(report);
                    setLoading(false);
                },
                onCancel: () => setAlertConfig({ visible: false }) 
            });
            return;
        }

        setDownloadingId(report.id);
        try {
            await ensureReportsDirExists();
            const extension = report.file_type === 'pdf' || report.file_type === 'application/pdf' ? '.pdf' : '.xlsx';
            
            const match = fileUrl.match(/ACCOMPLISHMENT_REPORT_(\d{13})/);
            const safeTitle = match ? match[0] : `ACCOMPLISHMENT_REPORT_${Date.now()}`;
            let destPath = `${REPORTS_DIR}${safeTitle}${extension}`;

            const safUri = await AsyncStorage.getItem('reports_directory_uri');
            if (Platform.OS === 'android' && safUri) {
                const mimeType = report.file_type === 'pdf' || report.file_type === 'application/pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                const newUri = await FileSystem.StorageAccessFramework.createFileAsync(safUri, safeTitle, mimeType);
                
                const tempUri = `${FileSystem.cacheDirectory}temp_download_${Date.now()}${extension}`;
                await FileSystem.downloadAsync(fileUrl, tempUri);
                const b64 = await FileSystem.readAsStringAsync(tempUri, { encoding: 'base64' });
                await FileSystem.writeAsStringAsync(newUri, b64, { encoding: 'base64' });
                destPath = newUri;
            } else {
                const { uri } = await FileSystem.downloadAsync(fileUrl, destPath);
                destPath = uri;
            }

            const db = await getDB();
            await db.runAsync('UPDATE saved_reports SET file_path = ? WHERE id = ?', [destPath, report.id]);

            setReports(prev => prev.map(r => r.id === report.id ? { ...r, file_path: destPath, isLocal: true, localPath: destPath } : r));
            
        } catch (error) {
            console.error(error);
            setAlertConfig({ visible: true, type: 'error', title: 'Download Failed', message: 'Failed to download the file from the cloud. Please check your connection.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
        } finally {
            setDownloadingId(null);
        }
    };

    const handleCardPress = async (report: any) => {
        if (!report.is_read || report.is_read === 0) {
            try {
                const db = await getDB();
                await db.runAsync('UPDATE saved_reports SET is_read = 1 WHERE id = ?', [report.id]);
                setReports(prev => prev.map(r => r.id === report.id ? { ...r, is_read: 1 } : r));
            } catch (e) {
                console.error("Failed marking read", e);
            }
        }

        if (report.isLocal) {
            handleOpen(report);
        } else {
            handleDownload(report);
        }
    };

    const handleDelete = (report: any) => {
        setMenuVisible(false);
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete File', message: 'Are you sure you want to permanently delete this file from your device and cloud storage?',
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

    if (!hasStoragePermission) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
                <Header title="Saved Reports" />
                <View style={styles.permissionContainer}>
                    <View style={[styles.permissionIconBox, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}>
                        <HugeiconsIcon icon={Folder01Icon} size={48} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.permissionTitle, { color: theme.colors.text }]}>Storage Access Required</Text>
                    <Text style={[styles.permissionDesc, { color: theme.colors.textSecondary }]}>
                        To save reports directly to your device and make them accessible in your &quot;Documents&quot; folder, please grant directory access.
                    </Text>
                    <Button title="Choose Folder" onPress={requestPermission} style={{ width: '80%', marginTop: 24 }} />
                </View>
            </SafeAreaView>
        );
    }

    const renderItem = ({ item }: { item: any }) => {
        const isPdf = item.file_type === 'pdf' || item.file_type === 'application/pdf';
        const fileIcon = isPdf ? iconPdf : iconXlsx;
        const iconBg = isPdf ? theme.colors.danger + '12' : theme.colors.success + '12';
        
        const isUnread = !item.is_read || item.is_read === 0;
        const isDownloading = downloadingId === item.id;

        const metaStr = item.metadata || '{}';
        let meta: any = {};
        try { meta = JSON.parse(metaStr); } catch { }
        
        const reportDateStr = meta.reportDate || item.period_key || format(new Date(item.created_at), 'MMM dd, yyyy');
        
        const ext = isPdf ? '.pdf' : '.xlsx';
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
                        numberOfLines={1} 
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
                </View>

                <View style={styles.actionZone}>
                    {isDownloading ? (
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
                    { label: 'Properties', icon: File02Icon, color: theme.colors.text, onPress: () => { setMenuVisible(false); setTimeout(() => setPropertiesModalVisible(true), 150); } },
                    { label: 'Open File', icon: ViewIcon, color: selectedReport?.isLocal ? theme.colors.text : theme.colors.textSecondary, onPress: () => handleOpen(selectedReport) },
                    { label: 'Share File', icon: Share08Icon, color: selectedReport?.isLocal ? theme.colors.text : theme.colors.textSecondary, onPress: () => handleShare(selectedReport) },
                    { label: 'Delete File', icon: Delete02Icon, color: theme.colors.danger, destructive: true, onPress: () => handleDelete(selectedReport) }
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
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={sortedReports}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        reports.length > 0 ? (
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
    
    permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: -40 },
    permissionIconBox: { width: 100, height: 100, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    permissionTitle: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', marginBottom: 12, textAlign: 'center', letterSpacing: -0.3 },
    permissionDesc: { fontSize: 15, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 24 },

    listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },
    
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
    filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    listHeaderTitle: { fontSize: 13, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    listHeaderCount: { fontSize: 13, fontFamily: 'Nunito_700Bold' },

    fileCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, marginBottom: 12, borderRadius: 16, borderWidth: 1, height: 70 },
    iconContainer: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    fileIcon: { width: 24, height: 24 },
    
    fileDetails: { flex: 1, justifyContent: 'center', paddingRight: 8 },
    fileName: { fontSize: 15, fontFamily: 'Nunito_700Bold', letterSpacing: -0.2, marginBottom: 8 },
    
    fileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fileMetaText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, opacity: 0.5 },
    
    actionZone: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
    cloudBadge: { marginRight: 12, opacity: 0.8 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    moreBtn: { padding: 4 },

    emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 30 },
    emptyIconContainer: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: -0.3 },
    emptySubtitle: { fontSize: 14, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22 }
});

