import { GoogleGenerativeAI } from "@google/generative-ai";
import {
    ArrowLeft02Icon,
    MagicWand01Icon,
    PrinterIcon,
    RefreshIcon // Added for regenerate
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
import { supabase } from '../../lib/supabase';

// --- CONFIG ---
const GEMINI_API_KEY = "AIzaSyDJ7w3NHM8q08XropEN1LS0HfbT3qDc86g"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export default function PrintScreen() {
  const router = useRouter();
  const { mode, date, startDate, endDate, title } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [dailySummaries, setDailySummaries] = useState<{date: string, text: string, originalTasks: string[]}[]>([]);
  
  const [config, setConfig] = useState({ paperSize: 'Letter', rounding: 'exact' });

  useEffect(() => {
    fetchDataAndGenerate();
  }, []);

  const fetchDataAndGenerate = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase.from('accomplishments').select('*').eq('user_id', user.id);

    if (mode === 'single' && date) {
        query = query.eq('date', date);
    } else if (mode === 'cutoff' && startDate && endDate) {
        query = query.gte('date', startDate).lte('date', endDate).order('date', { ascending: true });
    }

    const { data: tasks } = await query;

    // Group tasks by date
    const grouped: any = {};
    tasks?.forEach((t: any) => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t.description);
    });

    // Prepare data structure
    const initialData = Object.keys(grouped).map(d => ({
        date: d,
        text: grouped[d].join(". "), // Default fallback
        originalTasks: grouped[d]
    }));

    setDailySummaries(initialData);
    setLoading(false);

    // Trigger AI Generation immediately
    if (initialData.length > 0) {
        generateAISummaries(initialData);
    }
  };

  const generateAISummaries = async (dataToProcess: any[]) => {
    setGeneratingAI(true);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Construct a bulk prompt to save tokens/time
        const promptInput = dataToProcess.map(d => ({
            date: d.date,
            tasks: d.originalTasks
        }));

        const prompt = `
        You are a professional daily report writer.
        I will provide a JSON list of dates and raw tasks.
        For each date, summarize the tasks into a single, professional, concise paragraph (1-2 sentences) written in the first person ("I completed...", "Managed...").
        Do not add introductory text or markdown formatting (like **). Return ONLY a valid JSON array.
        
        Input: ${JSON.stringify(promptInput)}
        
        Expected Output Format:
        [
            { "date": "YYYY-MM-DD", "summary": "Summarized text here." }
        ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if Gemini adds them
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResults = JSON.parse(cleanJson);

        // Merge AI results back into state
        setDailySummaries(prev => prev.map(item => {
            const aiMatch = aiResults.find((ai: any) => ai.date === item.date);
            return aiMatch ? { ...item, text: aiMatch.summary } : item;
        }));

    } catch (error) {
        console.log("Gemini Error:", error);
        Alert.alert("AI Error", "Could not auto-generate summaries. Using raw tasks instead.");
    } finally {
        setGeneratingAI(false);
    }
  };

  const handlePrint = () => {
    Alert.alert("Print", "Generating PDF...", [{ text: "OK", onPress: () => router.back() }]);
    // Add your PDF generation call here passing 'dailySummaries' and 'config'
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F1F5F9] dark:bg-[#0B1120]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-slate-50 dark:bg-slate-800">
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color="#64748b" />
        </TouchableOpacity>
        <Text className="font-sans text-xl font-bold text-slate-900 dark:text-white">
            Print {mode === 'cutoff' ? 'Cutoff' : 'Report'}
        </Text>
        <View className="w-10" />
      </View>

      {loading ? (
        <View className="items-center justify-center flex-1"><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24 }}>
            
            {/* Config Section */}
            <View className="bg-white dark:bg-slate-800 p-6 rounded-[24px] mb-6 shadow-sm">
                <Text className="mb-4 text-xs font-bold uppercase text-slate-400">Paper Settings</Text>
                <View className="flex-row gap-3 mb-6">
                    {['Letter', 'A4', 'Legal'].map(size => (
                        <TouchableOpacity key={size} onPress={() => setConfig({...config, paperSize: size})} className={`flex-1 p-3 rounded-xl border ${config.paperSize === size ? 'bg-indigo-50 border-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}>
                            <Text className={`text-center font-bold ${config.paperSize === size ? 'text-indigo-600' : 'text-slate-500'}`}>{size}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {/* Rounding Toggles... (Same as before) */}
            </View>

            {/* AI Status Banner */}
            <View className={`flex-row items-center gap-2 mb-4 p-3 rounded-xl border ${generatingAI ? 'bg-orange-50 border-orange-200' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900'}`}>
                {generatingAI ? <ActivityIndicator size="small" color="#f97316" /> : <HugeiconsIcon icon={MagicWand01Icon} size={20} color="#6366f1" />}
                <Text className={`font-bold text-xs flex-1 ${generatingAI ? 'text-orange-600' : 'text-indigo-600'}`}>
                    {generatingAI ? "Gemini AI is summarizing your tasks..." : "AI summaries generated. You can edit them below."}
                </Text>
                {!generatingAI && (
                    <TouchableOpacity onPress={() => generateAISummaries(dailySummaries)}>
                        <HugeiconsIcon icon={RefreshIcon} size={16} color="#6366f1" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Content Editor */}
            <Text className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Review Content</Text>
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
                        className="p-4 leading-6 bg-white border shadow-sm dark:bg-slate-800 rounded-xl border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                    />
                </View>
            ))}
        </ScrollView>
      )}

      <View className="p-6 bg-white border-t dark:bg-slate-900 border-slate-100 dark:border-slate-800">
        <TouchableOpacity onPress={handlePrint} className="flex-row items-center justify-center gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30">
            <HugeiconsIcon icon={PrinterIcon} size={20} color="white" />
            <Text className="text-lg font-bold text-white">Generate PDF</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}