import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    MagicWand01Icon,
    PrinterIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { generateReport } from '../../utils/reportGenerator';

// Note: In production, move this to an env variable
const GEMINI_API_KEY = "AIzaSyDJ7w3NHM8q08XropEN1LS0HfbT3qDc86g"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function PrintScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { mode, date, startDate, endDate, title, jobId } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Data for PDF
  const [reportData, setReportData] = useState<any[]>([]);
  
  // Settings
  const [paperSize, setPaperSize] = useState<'Letter' | 'A4' | 'Legal'>('Letter');
  const [reportStyle, setReportStyle] = useState<'corporate' | 'creative' | 'minimal'>('corporate');

  useEffect(() => { fetchDataAndGenerate(); }, []);

  const fetchDataAndGenerate = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Get Profile
    const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(userProfile);

    // 2. Get Accomplishments
    let query = supabase.from('accomplishments').select('*').eq('user_id', user.id);
    if (jobId) query = query.eq('job_id', jobId);
    
    if (mode === 'single' && date) query = query.eq('date', date);
    else if (mode === 'cutoff' && startDate && endDate) query = query.gte('date', startDate).lte('date', endDate).order('date', { ascending: true });

    const { data: tasks } = await query;
    
    // 3. Get Attendance (for Time In/Out)
    let attQuery = supabase.from('attendance').select('*').eq('user_id', user.id);
    if (jobId) attQuery = attQuery.eq('job_id', jobId);
    if (mode === 'single' && date) attQuery = attQuery.eq('date', date);
    else if (mode === 'cutoff' && startDate && endDate) attQuery = attQuery.gte('date', startDate).lte('date', endDate);
    
    const { data: attendance } = await attQuery;

    // 4. Merge Data
    const grouped: any = {};
    tasks?.forEach((t: any) => {
        if (!grouped[t.date]) grouped[t.date] = { tasks: [], rawTasks: [] };
        grouped[t.date].tasks.push(t.description);
        grouped[t.date].rawTasks.push(t.description);
    });

    // Ensure all attendance days are present even if no tasks
    attendance?.forEach((a: any) => {
        if (!grouped[a.date]) grouped[a.date] = { tasks: [], rawTasks: [] };
        grouped[a.date].clockIn = a.clock_in ? new Date(a.clock_in).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--';
        grouped[a.date].clockOut = a.clock_out ? new Date(a.clock_out).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--';
    });

    const finalData = Object.keys(grouped).sort().map(d => ({
        date: d,
        summary: grouped[d].tasks.join(". "), // Default summary is just concatenation
        tasks: grouped[d].rawTasks,
        clockIn: grouped[d].clockIn || '--',
        clockOut: grouped[d].clockOut || '--'
    }));

    setReportData(finalData);
    setLoading(false);

    // 5. Trigger AI Summary if tasks exist
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
            You are an executive assistant. Summarize the daily tasks for a professional report.
            Return a JSON object where keys are dates (YYYY-MM-DD) and values are a single, concise professional sentence summarizing the work.
            Input Data: ${JSON.stringify(input)}
        `;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Clean JSON string
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
            paperSize: paperSize
        });
    } catch (e) {
        Alert.alert("Error", "Failed to generate PDF");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <Header title="Print Preview" />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Preparing Report...</Text>
        </View>
      ) : (
        <>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                
                {/* Options Card */}
                <View style={{ backgroundColor: theme.colors.card, padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 }}>Settings</Text>
                    
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                        {['Letter', 'A4', 'Legal'].map((size: any) => (
                            <TouchableOpacity 
                                key={size} 
                                onPress={() => setPaperSize(size)} 
                                style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: paperSize === size ? theme.colors.primary : theme.colors.border, backgroundColor: paperSize === size ? theme.colors.primary + '10' : 'transparent' }}
                            >
                                <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: paperSize === size ? theme.colors.primary : theme.colors.textSecondary }}>{size}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        {['corporate', 'creative', 'minimal'].map((style: any) => (
                            <TouchableOpacity 
                                key={style} 
                                onPress={() => setReportStyle(style)} 
                                style={{ flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: reportStyle === style ? theme.colors.primary : theme.colors.border, backgroundColor: reportStyle === style ? theme.colors.primary + '10' : 'transparent' }}
                            >
                                <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: reportStyle === style ? theme.colors.primary : theme.colors.textSecondary, textTransform: 'capitalize' }}>{style}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* AI Status */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: generatingAI ? theme.colors.warningLight : theme.colors.successLight, marginBottom: 20, borderWidth: 1, borderColor: generatingAI ? theme.colors.warning : theme.colors.success }}>
                    {generatingAI ? <ActivityIndicator size="small" color={theme.colors.warning} /> : <HugeiconsIcon icon={MagicWand01Icon} size={20} color={theme.colors.success} />}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: generatingAI ? theme.colors.warning : theme.colors.success }}>
                        {generatingAI ? "AI is summarizing tasks..." : "Summaries ready. You can edit below."}
                    </Text>
                </View>

                {/* Content Editor */}
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.text, marginBottom: 16 }}>Review Summaries</Text>
                {reportData.map((day, idx) => (
                    <View key={idx} style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                             <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary }}>{day.date} • {new Date(day.date).toLocaleDateString('en-US', {weekday: 'short'})}</Text>
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
                            style={{ backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border, color: theme.colors.text, minHeight: 60, fontSize: 14, lineHeight: 20 }}
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