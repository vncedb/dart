// filepath: components/FilePropertiesModal.tsx
import { Cancel01Icon, DocumentValidationIcon, File02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import React from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface FilePropertiesModalProps {
    visible: boolean;
    onClose: () => void;
    report: any;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export default function FilePropertiesModal({ visible, onClose, report }: FilePropertiesModalProps) {
    const theme = useAppTheme();

    if (!visible || !report) return null;

    const isPdf = report.file_type === 'pdf' || report.file_type === 'application/pdf';
    
    let meta: any = {};
    try {
        if (report.metadata) meta = JSON.parse(report.metadata);
    } catch { }

    const reportDate = meta.reportDate || report.period_key || format(new Date(report.created_at), 'MMM dd, yyyy');

    // Add Extension to Title
    const extension = isPdf ? '.pdf' : '.xlsx';
    const fullFileName = report.title?.toLowerCase().endsWith(extension) 
        ? report.title 
        : `${report.title}${extension}`;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.bottomSheetOverlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.floatingSheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.header}>
                                <View style={styles.headerLeft}>
                                    <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                        <HugeiconsIcon icon={File02Icon} size={20} color={theme.colors.primary} />
                                    </View>
                                    <Text style={[styles.title, { color: theme.colors.text }]}>File Properties</Text>
                                </View>
                                <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}>
                                    <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.content}>
                                <View style={styles.propertyRow}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>File Name</Text>
                                    <Text numberOfLines={3} style={[styles.value, { color: theme.colors.text, flex: 2, textAlign: 'right' }]}>
                                        {fullFileName}
                                    </Text>
                                </View>

                                <View style={styles.propertyRow}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>File Type</Text>
                                    <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                                        <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                                            {isPdf ? 'PDF Document' : 'Excel Spreadsheet'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.propertyRow}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Report Date</Text>
                                    <Text style={[styles.value, { color: theme.colors.text }]}>{reportDate}</Text>
                                </View>

                                <View style={styles.propertyRow}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Generated On</Text>
                                    <Text style={[styles.value, { color: theme.colors.text }]}>
                                        {format(new Date(report.created_at), "MMM d, yyyy • h:mm a")}
                                    </Text>
                                </View>

                                <View style={styles.propertyRow}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>File Size</Text>
                                    <Text style={[styles.value, { color: theme.colors.text }]}>{formatBytes(report.file_size)}</Text>
                                </View>
                                
                                <View style={[styles.propertyRow, { borderBottomWidth: 0, marginBottom: 0 }]}>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Status</Text>
                                    <View style={styles.statusRow}>
                                        <HugeiconsIcon icon={DocumentValidationIcon} size={14} color={theme.colors.success} />
                                        <Text style={[styles.statusText, { color: theme.colors.success }]}>Saved to Device</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    bottomSheetOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.4)', 
        justifyContent: 'flex-end',
        paddingHorizontal: 20 
    },
    floatingSheet: { 
        width: '100%', 
        marginBottom: Platform.OS === 'ios' ? 40 : 24, 
        borderRadius: 24, 
        borderWidth: 1,
        padding: 20,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    content: { gap: 2 },
    propertyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(150, 150, 150, 0.15)' },
    label: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', flex: 1 },
    value: { fontSize: 14, fontFamily: 'Nunito_700Bold', lineHeight: 20 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statusText: { fontSize: 14, fontFamily: 'Nunito_700Bold' }
});