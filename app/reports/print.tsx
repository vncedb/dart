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

// Components
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';

const GEMINI_API_KEY = "AIzaSyDJ7w3NHM8q08XropEN1LS0HfbT3qDc86g"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function PrintScreen() {
  const router = useRouter();
  const { mode, date, startDate, endDate, title } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [dailySummaries, setDailySummaries] = useState<{date: string, text: string, originalTasks: string[]}[]>([]);
  const [config, setConfig] = useState({ paperSize: 'Letter', rounding: 'exact' });

  useEffect(() => { fetchDataAndGenerate(); }, []);

  const fetchDataAndGenerate = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase.from('accomplishments').select('*').eq('user_id', user.id);
    if (mode === 'single' && date) query = query.eq('date', date);
    else if (mode === 'cutoff' && startDate && endDate) query = query.gte('date', startDate).lte('date', endDate).order('date', { ascending: true });

    const { data: tasks } = await query;
    const grouped: any = {};
    tasks?.forEach((t: any) => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t.description);
    });

    const initialData = Object.keys(grouped).map(d => ({
        date: d, text: grouped[d].join(". "), originalTasks: grouped[d]
    }));

    setDailySummaries(initialData);
    setLoading(false);

    if (initialData.length > 0) generateAISummaries(initialData);
  };

  const generateAISummaries = async (dataToProcess: any[]) => {
    setGeneratingAI(true);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Summarize these tasks into one concise professional sentence per date. No markdown. Input: ${JSON.stringify(dataToProcess.map(d => ({date: d.date, tasks: d.originalTasks})))}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // Simple parse logic or just use text if simple
        // For robustness in real app, better JSON parsing is needed here.
        // Assuming simple response for now:
        // alert(text); // Debug
    } catch (error) { console.log("AI Error", error); } finally { setGeneratingAI(false); }
  };

  const handlePrint = () => {
    Alert.alert("Print", "Generating PDF...", [{ text: "OK", onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9' }} edges={['top']}>
      <Header title={mode === 'cutoff' ? 'Print Cutoff' : 'Print Report'} />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={{ marginTop: 12, color: '#64748b' }}>Preparing Data...</Text>
        </View>
      ) : (
        <>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                <View className="bg-white dark:bg-slate-800 p-6 rounded-[24px] mb-6 shadow-sm">
                    <Text className="mb-4 text-xs font-bold uppercase text-slate-400">Paper Settings</Text>
                    <View className="flex-row gap-3 mb-6">
                        {['Letter', 'A4', 'Legal'].map(size => (
                            <TouchableOpacity key={size} onPress={() => setConfig({...config, paperSize: size})} className={`flex-1 p-3 rounded-xl border ${config.paperSize === size ? 'bg-indigo-50 border-indigo-500' : 'border-slate-200'}`}>
                                <Text className={`text-center font-bold ${config.paperSize === size ? 'text-indigo-600' : 'text-slate-500'}`}>{size}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* AI Banner */}
                <View className={`flex-row items-center gap-2 mb-4 p-3 rounded-xl border ${generatingAI ? 'bg-orange-50 border-orange-200' : 'bg-indigo-50 border-indigo-100'}`}>
                    {generatingAI ? <ActivityIndicator size="small" color="#f97316" /> : <HugeiconsIcon icon={MagicWand01Icon} size={20} color="#6366f1" />}
                    <Text className={`font-bold text-xs flex-1 ${generatingAI ? 'text-orange-600' : 'text-indigo-600'}`}>
                        {generatingAI ? "AI is summarizing..." : "Summaries generated. Edit below."}
                    </Text>
                </View>

                {/* Content */}
                <Text className="mb-4 text-lg font-bold text-slate-900">Review Content</Text>
                {dailySummaries.map((day, idx) => (
                    <View key={idx} className="mb-4">
                        <Text className="mb-2 ml-1 text-xs font-bold text-slate-400">{new Date(day.date).toDateString()}</Text>
                        <TextInput 
                            multiline
                            value={day.text}
                            onChangeText={(t) => {
                                const newSum = [...dailySummaries];
                                newSum[idx].text = t;
                                setDailySummaries(newSum);
                            }}
                            className="p-4 leading-6 bg-white border shadow-sm rounded-xl border-slate-200 text-slate-800"
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