// filepath: app/reports/ai-summary.tsx
import {
  Activity01Icon,
  Alert01Icon,
  ArrowLeft01Icon,
  Key01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import Header from "../../components/Header";
import { useAppTheme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useActiveJob } from "../../hooks/useActiveJob";
import {
  fetchAISummaryData,
  generateAnalyticsInsights,
  generateWeeklyReview,
  isAIAvailable
} from "../../lib/ai";

export default function AISummaryScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { user } = useAuth();
    
    // Fix: Get activeJob from the hook, then extract the ID
    const { activeJob } = useActiveJob();
    const activeJobId = activeJob?.id;
    
    const params = useLocalSearchParams();

    // Determine target dates (default to current month if not provided)
    const startDate = (params.startDate as string) || format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const endDate = (params.endDate as string) || format(endOfMonth(new Date()), 'yyyy-MM-dd');

    const [hasKey, setHasKey] = useState<boolean | null>(null);
    const [generating, setGenerating] = useState(false);
    const [reviewContent, setReviewContent] = useState<string | null>(null);
    const [insightsContent, setInsightsContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkKeyAndLoad();
    }, []);

    const checkKeyAndLoad = async () => {
        const available = await isAIAvailable();
        setHasKey(available);
    };

    const handleGenerate = async () => {
        if (!user || !activeJobId) {
            setError("No active user or job found.");
            return;
        }

        setGenerating(true);
        setError(null);
        
        try {
            const data = await fetchAISummaryData(user.id, activeJobId, startDate, endDate);
            if (!data) throw new Error("Failed to fetch local data for AI.");
            
            if (data.attendance.length === 0 && data.accomplishments.length === 0) {
                throw new Error("No attendance or tasks logged in this period to generate a summary.");
            }

            // Run generations concurrently
            const [review, insights] = await Promise.all([
                generateWeeklyReview(data),
                generateAnalyticsInsights(data)
            ]);

            setReviewContent(review);
            setInsightsContent(insights);
        } catch (err: any) {
            console.error("AI Gen Error:", err);
            setError(err.message || "An error occurred while generating the summary.");
        } finally {
            setGenerating(false);
        }
    };

    // Very simple Markdown parser for Bold (**text**) and basic structure
    const renderMarkdown = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, index) => {
            if (line.trim() === '') return <View key={index} style={{ height: 8 }} />;
            
            let isHeader = false;
            let isBullet = false;
            let content = line;

            if (line.startsWith('### ')) { isHeader = true; content = line.replace('### ', ''); }
            else if (line.startsWith('## ')) { isHeader = true; content = line.replace('## ', ''); }
            else if (line.startsWith('# ')) { isHeader = true; content = line.replace('# ', ''); }
            else if (line.startsWith('* ') || line.startsWith('- ')) { isBullet = true; content = line.substring(2); }
            else if (line.match(/^\d+\.\s/)) { isBullet = true; } // Numbered list

            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedLine = parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <Text key={i} style={{ fontFamily: 'Nunito_800ExtraBold', color: theme.colors.text }}>{part.slice(2, -2)}</Text>;
                }
                return <Text key={i} style={{ fontFamily: isHeader ? 'Nunito_800ExtraBold' : 'Nunito_500Medium', color: isHeader ? theme.colors.text : theme.colors.textSecondary }}>{part}</Text>;
            });

            return (
                <View key={index} style={{ 
                    flexDirection: isBullet ? 'row' : 'column', 
                    marginBottom: isHeader ? 8 : 4,
                    marginTop: isHeader ? 16 : 0,
                    paddingLeft: isBullet ? 12 : 0
                }}>
                    {isBullet && <Text style={{ color: theme.colors.textSecondary, marginRight: 8, fontSize: 16 }}>•</Text>}
                    <Text style={{ 
                        flex: isBullet ? 1 : undefined,
                        fontSize: isHeader ? 18 : 15,
                        lineHeight: isHeader ? 26 : 22,
                    }}>
                        {renderedLine}
                    </Text>
                </View>
            );
        });
    };

    if (hasKey === null) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
                <Header title="AI Summary" />
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!hasKey) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
                <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
                <Header title="AI Summary" />

                <View style={[styles.centerContainer, { paddingHorizontal: 32 }]}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + "15", marginBottom: 24 }]}>
                        <HugeiconsIcon icon={Key01Icon} size={48} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.title, { color: theme.colors.text }]}>API Key Required</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
                        To use the AI generation features, you need to provide your free Google Gemini API key.
                    </Text>
                    
                    <View style={{ width: '100%', marginTop: 32 }}>
                        <Button title="Go to Settings" onPress={() => router.push('/settings/gemini')} />
                        <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={{ marginTop: 12 }} />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>AI Insights</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                <View style={[styles.infoCard, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '25' }]}>
                    <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + '20' }]}>
                        <HugeiconsIcon icon={SparklesIcon} size={20} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTitle, { color: theme.colors.primary }]}>AI-Powered Review</Text>
                        <Text style={[styles.infoDesc, { color: theme.colors.textSecondary }]}>
                            Generate an intelligent performance review and analytics insights based on your logged hours and tasks from {format(new Date(startDate), 'MMM d')} to {format(new Date(endDate), 'MMM d, yyyy')}.
                        </Text>
                    </View>
                </View>

                {error && (
                    <Animated.View entering={FadeInDown} style={[styles.errorCard, { backgroundColor: theme.colors.danger + '10', borderColor: theme.colors.danger + '30' }]}>
                        <HugeiconsIcon icon={Alert01Icon} size={20} color={theme.colors.danger} />
                        <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
                    </Animated.View>
                )}

                {!reviewContent && !generating && (
                    <Button 
                        title="Generate Summary" 
                        icon={<HugeiconsIcon icon={SparklesIcon} size={20} color="#fff" />} 
                        onPress={handleGenerate} 
                        style={{ marginTop: 12 }} 
                    />
                )}

                {generating && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 16 }} />
                        <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>Analyzing your data...</Text>
                        <Text style={[styles.loadingDesc, { color: theme.colors.textSecondary }]}>Gemini is drafting your performance review.</Text>
                    </View>
                )}

                {reviewContent && !generating && (
                    <Animated.View entering={FadeInDown.duration(500)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 16 }}>
                            <HugeiconsIcon icon={Activity01Icon} size={20} color={theme.colors.text} />
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Review</Text>
                        </View>
                        <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            {renderMarkdown(reviewContent)}
                        </View>

                        {insightsContent && (
                            <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 24 }}>
                                    <HugeiconsIcon icon={SparklesIcon} size={20} color={theme.colors.text} />
                                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Smart Insights</Text>
                                </View>
                                <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    {renderMarkdown(insightsContent)}
                                </View>
                            </>
                        )}

                        <Button 
                            title="Regenerate" 
                            variant="secondary" 
                            icon={<HugeiconsIcon icon={SparklesIcon} size={20} color={theme.colors.text} />} 
                            onPress={handleGenerate} 
                            style={{ marginTop: 24, marginBottom: 20 }} 
                        />
                    </Animated.View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3 },
    scrollContent: { padding: 24, paddingBottom: 60 },
    
    centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    iconContainer: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', lineHeight: 22 },
    
    infoCard: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, gap: 16, marginBottom: 24 },
    iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    infoTitle: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', marginBottom: 4 },
    infoDesc: { fontSize: 13, fontFamily: 'Nunito_500Medium', lineHeight: 20 },

    errorCard: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12, marginBottom: 24, alignItems: 'center' },
    errorText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', flex: 1 },

    loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    loadingTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', marginBottom: 6 },
    loadingDesc: { fontSize: 14, fontFamily: 'Nunito_500Medium' },

    sectionTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3 },
    contentCard: { padding: 20, borderRadius: 20, borderWidth: 1 },
});