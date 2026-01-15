import { GoogleGenerativeAI } from "@google/generative-ai";
import { Download01Icon, MagicWand01Icon, PencilEdit02Icon, PrinterIcon } from '@hugeicons/core-free-icons'; // Added Icons
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Footer from '../../components/Footer';
import Header from '../../components/Header';
import SignatureModal from '../../components/SignatureModal'; // New Component
import { useAppTheme } from '../../constants/theme';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { ReportService } from '../../services/ReportService'; // New Service
import { exportToExcel } from '../../utils/csvExporter'; // New Utility
import { generateReport } from '../../utils/reportGenerator';

const GEMINI_API_KEY = "AIzaSyDJ7w3NHM8q08XropEN1LS0HfbT3qDc86g"; // Ideally move to ENV
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function PrintScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { mode, date, startDate, endDate, title, jobId } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  const [reportData, setReportData] = useState<any[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  
  const [paperSize, setPaperSize] = useState<'Letter' | 'A4' | 'Legal'>('Letter');
  const [reportStyle, setReportStyle] = useState<'corporate' | 'creative' | 'minimal'>('corporate');

  useEffect(() => { fetchDataAndGenerate(); }, []);

  const fetchDataAndGenerate = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Get Profile (Local DB for offline safety)
    const db = await getDB();
    const userProfile = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [user.id]);
    setProfile(userProfile);

    // 2. Fetch Data using Service
    let tasks: any[] = [];
    let attendance: any[] = [];

    if (mode === 'single' && date) {
        const data = await ReportService.getDailyReport(user.id, date as string);
        tasks = data.tasks;
        attendance = data.attendance ? [data.attendance] : [];
    } else if (mode === 'cutoff' && startDate && endDate && jobId) {
        const data = await ReportService.getReportRange(user.id, jobId as string, startDate as string, endDate as string);
        tasks = data.tasks;
        attendance = data.attendance;
    }

    // 3. Merge Data
    const grouped: any = {};
    tasks?.forEach((t: any) => {
        if (!grouped[t.date]) grouped[t.date] = { tasks: [], rawTasks: [] };
        grouped[t.date].tasks.push(t.description);
        grouped[t.date].rawTasks.push(t.description);
    });

    attendance?.forEach((a: any) => {
        if (!grouped[a.date]) grouped[a.date] = { tasks: [], rawTasks: [] };
        grouped[a.date].clockIn = a.clock_in ? new Date(a.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--';
        grouped[a.date].clockOut = a.clock_out ? new Date(a.clock_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--';
    });

    const finalData = Object.keys(grouped).sort().map(d => ({
        date: d,
        summary: grouped[d].tasks.join(". "),
        tasks: grouped[d].rawTasks,
        clockIn: grouped[d].clockIn || '--',
        clockOut: grouped[d].clockOut || '--'
    }));

    setReportData(finalData);
    setLoading(false);

    // 4. Trigger AI Summary (if online)
    if (finalData.length > 0 && finalData.some(d => d.tasks.length > 0)) {
        generateAISummaries(finalData);
    }
  };

  const generateAISummaries = async (data: any[]) => {
    setGeneratingAI(true);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const input = data.filter(d => d.tasks.length > 0).map(d => ({ date: d.date, tasks: d.tasks }));
        if (input.length === 0) return;

        const prompt = `
            You are an executive assistant. Summarize the daily tasks.
            Return a JSON object where keys are dates (YYYY-MM-DD) and values are a single, concise professional sentence.
            Input Data: ${JSON.stringify(input)}
        `;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const summaries = JSON.parse(jsonStr);

        setReportData(prev => prev.map(item => ({
            ...item,
            summary: summaries[item.date] || item.summary
        })));

    } catch (error) { console.log("AI Summary Error", error); } finally { setGeneratingAI(false); }
  };

  const handlePrint = async () => {
    try {
        await generateReport({
            userName: profile?.full_name || 'Employee',
            userTitle: profile?.title || 'Staff',
            reportTitle: title as string || 'Accomplishment Report',
            period: mode === 'cutoff' ? `${startDate} to ${endDate}` : (date as string),
            data: reportData,
            style: reportStyle,
            paperSize: paperSize,
            signatureUri: signature // Pass signature
        });
    } catch (e) {
        Alert.alert("Error", "Failed to generate PDF");
    }
  };

  const handleExportCSV = async () => {
      try {
          const exportData = reportData.map(r => ({
              Date: r.date,
              Clock_In: r.clockIn,
              Clock_Out: r.clockOut,
              Tasks: r.summary
          }));
          await exportToExcel(exportData, `Report_${startDate || date}`);
      } catch(e) { Alert.alert("Export Failed", "Could not save file."); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <Header title="Print Preview" />
      <SignatureModal 
          visible={signatureModalVisible} 
          onClose={() => setSignatureModalVisible(false)} 
          onOK={setSignature} 
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Preparing Report...</Text>
        </View>
      ) : (
        <>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                
                {/* Options */}
                <View style={{ backgroundColor: theme.colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 }}>Settings</Text>
                    
                    {/* Size Selectors ... (Same as before) ... */}
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                        {['Letter', 'A4', 'Legal'].map((size: any) => (
                            <TouchableOpacity key={size} onPress={() => setPaperSize(size)} style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: paperSize === size ? theme.colors.primary : theme.colors.border, backgroundColor: paperSize === size ? theme.colors.primary + '10' : 'transparent' }}>
                                <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: paperSize === size ? theme.colors.primary : theme.colors.textSecondary }}>{size}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* New Buttons: Signature & Export */}
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                         <TouchableOpacity onPress={() => setSignatureModalVisible(true)} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                             <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                             <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>{signature ? 'Edit Signature' : 'Add Signature'}</Text>
                         </TouchableOpacity>
                         
                         <TouchableOpacity onPress={handleExportCSV} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.colors.success + '15', borderWidth: 1, borderColor: theme.colors.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                             <HugeiconsIcon icon={Download01Icon} size={16} color={theme.colors.success} />
                             <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.success }}>Export Excel</Text>
                         </TouchableOpacity>
                    </View>

                    {signature && (
                        <View style={{ marginTop: 12, alignItems: 'center' }}>
                            <Image source={{ uri: signature }} style={{ width: 150, height: 60, resizeMode: 'contain' }} />
                        </View>
                    )}
                </View>

                {/* Summaries Editor */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: generatingAI ? theme.colors.warningLight : theme.colors.successLight, marginBottom: 20, borderWidth: 1, borderColor: generatingAI ? theme.colors.warning : theme.colors.success }}>
                    {generatingAI ? <ActivityIndicator size="small" color={theme.colors.warning} /> : <HugeiconsIcon icon={MagicWand01Icon} size={20} color={theme.colors.success} />}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: generatingAI ? theme.colors.warning : theme.colors.success }}>
                        {generatingAI ? "AI is summarizing tasks..." : "Summaries ready. You can edit below."}
                    </Text>
                </View>

                {reportData.map((day, idx) => (
                    <View key={idx} style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                             <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary }}>{day.date}</Text>
                             <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>{day.clockIn} - {day.clockOut}</Text>
                        </View>
                        <TextInput 
                            multiline
                            value={day.summary}
                            onChangeText={(t) => {
                                const newData = [...reportData];
                                newData[idx].summary = t;
                                setReportData(newData);
                            }}
                            style={{ backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text, minHeight: 60 }}
                        />
                    </View>
                ))}
            </ScrollView>

            <Footer>
                <TouchableOpacity onPress={handlePrint} className="flex-row items-center justify-center gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl">
                    <HugeiconsIcon icon={PrinterIcon} size={20} color="white" />
                    <Text className="text-lg font-bold text-white">Generate PDF</Text>
                </TouchableOpacity>
            </Footer>
        </>
      )}
    </SafeAreaView>
  );
}