import {
    ArrowLeft01Icon,
    Download01Icon,
    File02Icon,
    RefreshIcon,
    Share01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { differenceInMinutes, format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';
import { exportToExcel } from '../../utils/csvExporter';
import { generateReport } from '../../utils/reportGenerator';

export default function PreviewReportScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { data, config } = useLocalSearchParams();
    
    const [fileUri, setFileUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    const reportData = data ? JSON.parse(data as string) : [];
    const options = config ? JSON.parse(config as string) : {};

    useEffect(() => {
        generateFile();
    }, []);

    const generateFile = async () => {
        setLoading(true);
        try {
            // 1. Process Data
            const processedData = reportData.map((item: any) => {
                let durationTxt = '--';
                if (item.clockIn && item.clockOut) {
                    const start = new Date(item.clockIn);
                    const end = new Date(item.clockOut);
                    let diff = differenceInMinutes(end, start);
                    
                    if (options.roundHours) {
                        const remainder = diff % 15;
                        if (remainder >= 8) diff += (15 - remainder);
                        else diff -= remainder;
                    }
                    
                    const h = Math.floor(diff / 60);
                    const m = diff % 60;
                    durationTxt = `${h}h ${m > 0 ? `${m}m` : ''}`;
                }

                return {
                    ...item,
                    clockIn: item.clockIn ? format(new Date(item.clockIn), 'h:mm a') : '--:--',
                    clockOut: item.clockOut ? format(new Date(item.clockOut), 'h:mm a') : '--:--',
                    duration: durationTxt,
                    // Handle images
                    summary: options.includeDocs ? item.tasks : item.tasks.map((t:any) => ({ ...t, image_url: null }))
                };
            });

            const meta = {
                userName: options.meta.name,
                userTitle: options.meta.title,
                reportTitle: 'ACCOMPLISHMENT REPORT',
                period: options.meta.period,
                signatureUri: options.meta.signature,
                style: options.style,
                paperSize: options.paperSize,
                columns: options.columns
            };

            let uri = '';
            if (options.format === 'pdf') {
                uri = await generateReport({ ...meta, data: processedData });
            } else {
                uri = await exportToExcel({ ...meta, data: processedData, fileName: `Report_${options.meta.period.replace(/ /g, '_')}` });
            }
            
            setFileUri(uri);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (fileUri) {
            // On Android, this opens the system dialog which allows "Open with..." or "Save to..."
            await Sharing.shareAsync(fileUri, {
                mimeType: options.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Report Options'
            });
        }
    };

    // Helper to render the placeholder for Android PDF or Excel
    const renderPlaceholder = (type: 'pdf' | 'xlsx') => (
        <View style={styles.center}>
            <View style={[styles.iconCircle, { backgroundColor: type === 'pdf' ? theme.colors.primary : theme.colors.success }]}>
                <HugeiconsIcon icon={type === 'pdf' ? File02Icon : Download01Icon} size={48} color="#fff" />
            </View>
            <Text style={[styles.successTitle, { color: theme.colors.text }]}>
                {type === 'pdf' ? 'PDF Document Ready' : 'Excel File Ready'}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 }}>
                {type === 'pdf' 
                    ? "Tap 'Share / Save' below to view, print, or send this document."
                    : "Spreadsheets cannot be previewed here. Tap 'Share / Save' to open."}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <Header 
                title="Preview" 
                leftElement={
                    <TouchableOpacity onPress={() => router.back()} style={{padding: 8}}>
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                }
            />

            <View style={styles.content}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>Generating File...</Text>
                    </View>
                ) : (
                    <>
                        {/* PREVIEW CONTAINER */}
                        <View style={[styles.previewFrame, { backgroundColor: '#f2f2f2' }]}>
                            {/* iOS can render PDF in WebView. Android/Excel uses placeholder */}
                            {options.format === 'pdf' && Platform.OS === 'ios' && fileUri ? (
                                <WebView 
                                    source={{ uri: fileUri }} 
                                    style={{ flex: 1 }} 
                                    originWhitelist={['*']}
                                    scalesPageToFit={true}
                                />
                            ) : (
                                renderPlaceholder(options.format)
                            )}
                        </View>

                        {/* ACTIONS */}
                        <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
                            <TouchableOpacity onPress={() => router.back()} style={[styles.btn, { borderColor: theme.colors.border, borderWidth: 1 }]}>
                                <HugeiconsIcon icon={RefreshIcon} size={20} color={theme.colors.text} />
                                <Text style={[styles.btnText, { color: theme.colors.text }]}>Edit Settings</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity onPress={handleShare} style={[styles.btn, { backgroundColor: theme.colors.primary, flex: 1 }]}>
                                <HugeiconsIcon icon={Share01Icon} size={20} color="#fff" />
                                <Text style={[styles.btnText, { color: '#fff' }]}>Share / Save</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    previewFrame: { flex: 1, margin: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0' },
    footer: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1 },
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, gap: 8 },
    btnText: { fontWeight: '700', fontSize: 15 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    successTitle: { fontSize: 20, fontWeight: '800' }
});