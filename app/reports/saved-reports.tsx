// filepath: app/reports/saved-reports.tsx
import { ArrowDown01Icon, ArrowUp01Icon, Delete02Icon, File02Icon, Group01Icon, MoreVerticalIcon, Pdf01Icon, Search01Icon, Share08Icon, Xls01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { endOfWeek, format, getWeek, startOfWeek } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, SectionList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../../components/ActionMenu';
import FilePropertiesModal from '../../components/FilePropertiesModal';
import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';

// Local custom icons
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
    
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Modals & Menus State
    const [groupBy, setGroupBy] = useState<'period' | 'month' | 'week'>('month');
    const [groupMenuVisible, setGroupMenuVisible] = useState(false);
    const [groupMenuAnchor, setGroupMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const groupIconRef = useRef<View>(null);

    const [fileFilter, setFileFilter] = useState<'all' | 'pdf' | 'xlsx'>('all');
    const [filterMenuVisible, setFilterMenuVisible] = useState(false);
    const [filterMenuAnchor, setFilterMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const filterIconRef = useRef<View>(null);

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const [selectedReport, setSelectedReport] = useState<any>(null);
    const [propertiesModalVisible, setPropertiesModalVisible] = useState(false);

    const fetchReports = useCallback(async () => {
        if (!user) return;
        try {
            const db = await getDB();
            const data = await db.getAllAsync('SELECT * FROM saved_reports WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [user.id]);
            
            // Mark all unread reports as read
            await db.runAsync('UPDATE saved_reports SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND deleted_at IS NULL', [user.id]);
            
            setReports(data as any[]);
        } catch (error) {
            console.error('Failed to fetch saved reports', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

    const filteredReports = useMemo(() => {
        if (fileFilter === 'all') return reports;
        if (fileFilter === 'pdf') return reports.filter(r => r.file_type === 'pdf' || r.file_type === 'application/pdf');
        if (fileFilter === 'xlsx') return reports.filter(r => r.file_type === 'xlsx' || r.file_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return reports;
    }, [reports, fileFilter]);

    const groupedReports = useMemo(() => {
        if (!filteredReports.length) return [];
        
        const groups: Record<string, any[]> = {};
        
        filteredReports.forEach(report => {
            const metaStr = report.metadata || '{}';
            let meta: any = {};
            try { meta = JSON.parse(metaStr); } catch { }
            
            const targetDate = meta.startDate ? new Date(meta.startDate) : new Date(report.created_at);
            let key = '';
            
            if (groupBy === 'month') {
                key = format(targetDate, 'MMMM yyyy');
            } else if (groupBy === 'week') {
                const start = startOfWeek(targetDate, { weekStartsOn: 1 });
                const end = endOfWeek(targetDate, { weekStartsOn: 1 });
                key = `Week ${getWeek(targetDate)} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`;
            } else if (groupBy === 'period') {
                const month = format(targetDate, 'MMMM');
                const year = targetDate.getFullYear();
                if (targetDate.getDate() <= 15) {
                    key = `1st Cutoff ${month} ${year}`;
                } else {
                    key = `2nd Cutoff ${month} ${year}`;
                }
            }
            
            if (!groups[key]) groups[key] = [];
            groups[key].push(report);
        });
        
        return Object.keys(groups).map(key => ({ title: key, data: groups[key] }));
    }, [filteredReports, groupBy]);

    // Menus
    const openGroupMenu = () => {
        if (groupIconRef.current) {
            groupIconRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                setGroupMenuAnchor({ x: pageX + width, y: pageY + height });
                setGroupMenuVisible(true);
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

    const handleShare = async (report: any) => {
        setMenuVisible(false);
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable && report.file_path) {
                await Sharing.shareAsync(report.file_path, { dialogTitle: 'Share File' });
            } else {
                setAlertConfig({ visible: true, type: 'error', title: 'Share Failed', message: 'File is missing or sharing is unavailable.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
            }
        } catch (error) { console.log(error); }
    };

    const handleDelete = (report: any) => {
        setMenuVisible(false);
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete File', message: 'Are you sure you want to permanently delete this file?',
            confirmText: 'Delete', cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig({ visible: false });
                try {
                    const db = await getDB();
                    const now = new Date().toISOString();
                    await db.runAsync('UPDATE saved_reports SET deleted_at = ?, is_synced = 0 WHERE id = ?', [now, report.id]);
                    await queueSyncItem('saved_reports', report.id, 'UPDATE', { deleted_at: now });
                    fetchReports();
                } catch (error) { console.log(error); }
            },
            onCancel: () => setAlertConfig({ visible: false })
        });
    };

    const renderItem = ({ item }: { item: any }) => {
        const isPdf = item.file_type === 'pdf' || item.file_type === 'application/pdf';
        const fileIcon = isPdf ? iconPdf : iconXlsx;
        const iconBg = isPdf ? theme.colors.danger + '12' : theme.colors.success + '12';
        
        const isUnread = !item.is_read || item.is_read === 0;

        const metaStr = item.metadata || '{}';
        let meta: any = {};
        try { meta = JSON.parse(metaStr); } catch { }
        
        const reportDateStr = meta.reportDate || format(new Date(item.created_at), 'MMM dd, yyyy');

        let styleType = 'Sheet';
        let pillColor = { bg: '#16a34a15', text: '#16a34a' }; 

        if (isPdf) {
            if (item.title.includes('Corporate')) {
                styleType = 'Corporate';
                pillColor = { bg: '#2563eb15', text: '#2563eb' };
            } else if (item.title.includes('Creative')) {
                styleType = 'Creative';
                pillColor = { bg: '#4f46e515', text: '#4f46e5' };
            } else if (item.title.includes('Minimal')) {
                styleType = 'Minimal';
                pillColor = { bg: '#17171715', text: '#171717' };
            } else {
                styleType = 'PDF';
                pillColor = { bg: '#ef444415', text: '#ef4444' }; 
            }
        }
        
        return (
            <TouchableOpacity 
                activeOpacity={0.7} 
                onPress={() => handleShare(item)} 
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
                        {item.title}
                    </Text>
                    
                    <View style={styles.fileMetaRow}>
                        <View style={[styles.tagBadge, { backgroundColor: pillColor.bg }]}>
                            <Text style={[styles.tagText, { color: pillColor.text }]}>{styleType}</Text>
                        </View>

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
                    {isUnread && <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />}
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

            {/* File Properties Modal */}
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
                    <View ref={groupIconRef} collapsable={false}>
                        <TouchableOpacity onPress={openGroupMenu} style={{ padding: 8, marginRight: -8 }}>
                            <HugeiconsIcon icon={Group01Icon} size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                }
            />

            {/* Action Menu for File Configuration */}
            <ActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                actions={[
                    { label: 'Properties', icon: File02Icon, color: theme.colors.text, onPress: () => { setMenuVisible(false); setTimeout(() => setPropertiesModalVisible(true), 150); } },
                    { label: 'Share File', icon: Share08Icon, color: theme.colors.text, onPress: () => handleShare(selectedReport) },
                    { label: 'Delete File', icon: Delete02Icon, color: theme.colors.danger, destructive: true, onPress: () => handleDelete(selectedReport) }
                ]}
            />

            {/* Action Menu for Grouping Selection */}
            <ActionMenu
                visible={groupMenuVisible}
                onClose={() => setGroupMenuVisible(false)}
                anchor={groupMenuAnchor}
                actions={[
                    { label: 'Group by Period', isActive: groupBy === 'period', color: groupBy === 'period' ? theme.colors.primary : theme.colors.text, onPress: () => { setGroupBy('period'); setGroupMenuVisible(false); } },
                    { label: 'Group by Month', isActive: groupBy === 'month', color: groupBy === 'month' ? theme.colors.primary : theme.colors.text, onPress: () => { setGroupBy('month'); setGroupMenuVisible(false); } },
                    { label: 'Group by Week', isActive: groupBy === 'week', color: groupBy === 'week' ? theme.colors.primary : theme.colors.text, onPress: () => { setGroupBy('week'); setGroupMenuVisible(false); } }
                ]}
            />

            {/* Action Menu for Filtering Selection */}
            <ActionMenu
                visible={filterMenuVisible}
                onClose={() => setFilterMenuVisible(false)}
                anchor={filterMenuAnchor}
                actions={[
                    { label: 'All Files', isActive: fileFilter === 'all', color: fileFilter === 'all' ? theme.colors.primary : theme.colors.text, onPress: () => { setFileFilter('all'); setFilterMenuVisible(false); } },
                    { label: 'PDF Documents', icon: Pdf01Icon, isActive: fileFilter === 'pdf', color: fileFilter === 'pdf' ? theme.colors.primary : theme.colors.text, onPress: () => { setFileFilter('pdf'); setFilterMenuVisible(false); } },
                    { label: 'Excel Spreadsheets', icon: Xls01Icon, isActive: fileFilter === 'xlsx', color: fileFilter === 'xlsx' ? theme.colors.primary : theme.colors.text, onPress: () => { setFileFilter('xlsx'); setFilterMenuVisible(false); } },
                ]}
            />

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <SectionList
                    sections={groupedReports}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{title}</Text>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={true}
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
                                    {filteredReports.length} {filteredReports.length === 1 ? 'item' : 'items'}
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
    listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 100 },
    
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
    filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    listHeaderTitle: { fontSize: 13, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    listHeaderCount: { fontSize: 13, fontFamily: 'Nunito_700Bold' },

    sectionHeader: { paddingVertical: 12, marginBottom: 8 },
    sectionTitle: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 1 },

    fileCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12, borderRadius: 16, borderWidth: 1, height: 86 },
    iconContainer: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    fileIcon: { width: 26, height: 26 },
    
    fileDetails: { flex: 1, justifyContent: 'center', paddingRight: 8 },
    fileName: { fontSize: 15, fontFamily: 'Nunito_700Bold', letterSpacing: -0.2, marginBottom: 8 },
    
    fileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tagBadge: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    tagText: { fontSize: 9, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    fileMetaText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, opacity: 0.5 },
    
    actionZone: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    moreBtn: { padding: 4 },

    emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 30 },
    emptyIconContainer: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, letterSpacing: -0.3 },
    emptySubtitle: { fontSize: 14, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22 }
});