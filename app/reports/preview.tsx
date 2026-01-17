import {
    ArrowLeft01Icon,
    CheckmarkCircle03Icon,
    Download01Icon,
    File02Icon,
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

import Button from '../../components/Button';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { ReportService } from '../../services/ReportService';
import { exportToExcel } from '../../utils/csvExporter';
import { generateReport } from '../../utils/reportGenerator';

export default function PreviewReportScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { startDate, endDate, date, config } = useLocalSearchParams();
    
    const [fileUri, setFileUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    const options = config ? JSON.parse(config as string) : {};

    useEffect(() => {
        generateFile();
    }, []);

    const generateFile = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) return;

            const job = await ReportService.getActiveJob(userId);
            let items: any = { attendance: [], tasks: [] };

            if (startDate && endDate) {
                items = await ReportService.getReportRange(userId, job?.id, startDate as string, endDate as string);
            } else if (date) {
                const res = await ReportService.getDailyReport(userId, date as string);
                items = { attendance: res.attendance ? [res.attendance] : [], tasks: res.tasks };
            }

            const dates = new Set([...(items.attendance||[]).map((a:any) => a.date), ...(items.tasks||[]).map((t:any) => t.date)]);
            
            const processedData = Array.from(dates).sort().map(d => {
                const att = (items.attendance||[]).find((a:any) => a.date === d);
                
                const dayTasks = (items.tasks||[]).filter((t:any) => t.date === d).map((t: any) => {
                    let images: string[] = [];
                    if (options.includeDocs && t.image_url) {
                        try {
                            const raw = t.image_url.trim();
                            if (raw.startsWith('[')) {
                                const parsed = JSON.parse(raw);
                                images = Array.isArray(parsed) ? parsed : [raw];
                            } else {
                                images = [raw];
                            }
                        } catch {
                            images = [t.image_url];
                        }
                    }
                    return { ...t, images };
                });

                let durationTxt = '--';
                if (att?.clock_in && att?.clock_out) {
                    const start = new Date(att.clock_in);
                    const end = new Date(att.clock_out);
                    let diff = differenceInMinutes(end, start);
                    
                    if (options.timeFormat === 'round_15') diff = Math.round(diff / 15) * 15;
                    else if (options.timeFormat === 'round_30') diff = Math.round(diff / 30) * 30;
                    else if (options.timeFormat === 'round_60') diff = Math.round(diff / 60) * 60;

                    if (options.timeFormat === 'decimal') durationTxt = (diff / 60).toFixed(2) + 'h';
                    else {
                        const h = Math.floor(diff / 60);
                        const m = diff % 60;
                        durationTxt = `${h}h ${m > 0 ? `${m}m` : ''}`;
                    }
                }

                const dateObj = new Date(d);
                let formattedDate = d;
                try {
                    formattedDate = format(dateObj, options.dateFormat || 'MM/dd/yyyy');
                    if (options.includeDay) {
                        formattedDate += `\n${format(dateObj, 'EEEE')}`;
                    }
                } catch (e) { formattedDate = d; }

                return {
                    date: formattedDate,
                    clockIn: att?.clock_in ? format(new Date(att.clock_in), 'h:mm a') : '--:--',
                    clockOut: att?.clock_out ? format(new Date(att.clock_out), 'h:mm a') : '--:--',
                    duration: durationTxt,
                    status: att?.status,
                    remarks: att?.remarks,
                    summary: dayTasks 
                };
            });

            const meta = {
                userName: options.meta.name,
                userTitle: options.meta.title,
                company: options.meta.company, // Passed
                department: options.includeDept ? options.meta.department : undefined, // Check toggle
                reportTitle: 'ACCOMPLISHMENT REPORT',
                period: options.meta.period,
                signatureUri: options.meta.signature,
                style: options.style,
                paperSize: options.paperSize,
                columns: options.columns,
                dateFormat: options.dateFormat
            };

            let uri = '';
            if (options.format === 'pdf') {
                uri = await generateReport({ ...meta, data: processedData });
            } else {
                uri = await exportToExcel({ ...meta, data: processedData, fileName: `Report_${options.meta.period.replace(/ /g, '_')}` });
            }
            
            setFileUri(uri);

        } catch (e) {
            console.error("Preview Generation Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (fileUri) {
            await Sharing.shareAsync(fileUri, {
                mimeType: options.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                dialogTitle: 'Report Options'
            });
        }
    };

    const handleDone = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('report_history').insert({
                    user_id: user.id,
                    title: options.meta.period,
                    start_date: startDate || date,
                    end_date: endDate || date,
                    generated_at: new Date().toISOString()
                });
            }
            router.dismissAll();
            router.push('/(tabs)/reports');
        } catch (e) {
            console.log("Error saving history:", e);
            router.push('/(tabs)/reports');
        }
    };

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
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
            <Header 
                title="Preview" 
                leftElement={
                    <TouchableOpacity onPress={() => router.back()} style={{padding: 8}}>
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                }
                rightElement={
                    <TouchableOpacity onPress={handleDone} style={{padding: 8, opacity: loading ? 0.5 : 1}} disabled={loading}>
                        <HugeiconsIcon icon={CheckmarkCircle03Icon} size={24} color={theme.colors.primary} />
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
                    <View style={[styles.previewFrame, { backgroundColor: '#f2f2f2' }]}>
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
                )}
            </View>

            <Footer>
                <Button 
                    title="Share / Save" 
                    onPress={handleShare} 
                    variant="primary"
                    disabled={loading || !fileUri}
                    icon={<HugeiconsIcon icon={Share01Icon} size={20} color="#fff" />}
                    style={{width: '100%'}}
                />
            </Footer>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    previewFrame: { flex: 1, margin: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0' },
    footer: { flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    successTitle: { fontSize: 20, fontWeight: '800' }
});