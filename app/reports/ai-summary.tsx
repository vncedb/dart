import {
    Activity01Icon,
    Alert01Icon,
    Calendar03Icon,
    Key01Icon,
    Settings01Icon,
    SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import Header from "../../components/Header";
import LoadingScreen from "../../components/LoadingScreen";
import ModernAlert from "../../components/ModernAlert";
import { useAppTheme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useActiveJob } from "../../hooks/useActiveJob";
import {
    fetchAISummaryData,
    generateAISummaryBundle,
    isAIAvailable,
    type AIProvider,
} from "../../lib/ai";
import { requireOnlineFeature } from "../../lib/offline-access";

export default function AISummaryScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { user } = useAuth();

    const { activeJob } = useActiveJob();
    const activeJobId = activeJob?.id;

    const params = useLocalSearchParams();
    const startDate = (params.startDate as string) || format(startOfMonth(new Date()), "yyyy-MM-dd");
    const endDate = (params.endDate as string) || format(endOfMonth(new Date()), "yyyy-MM-dd");

    const [hasKey, setHasKey] = useState<boolean | null>(null);
    const [generating, setGenerating] = useState(false);
    const [reviewContent, setReviewContent] = useState<string | null>(null);
    const [insightsContent, setInsightsContent] = useState<string | null>(null);
    const [providerUsed, setProviderUsed] = useState<AIProvider | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const pulseValue = useSharedValue(1);
    const glowOpacity = useSharedValue(0.3);

    useFocusEffect(
        useCallback(() => {
            const checkKey = async () => {
                const available = await isAIAvailable();
                setHasKey(available);
            };
            checkKey();
        }, [])
    );

    useEffect(() => {
        if (generating) {
            pulseValue.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                false
            );
            glowOpacity.value = withRepeat(
                withSequence(withTiming(0.8, { duration: 1000 }), withTiming(0.3, { duration: 1000 })),
                -1,
                false
            );
        } else {
            pulseValue.value = withTiming(1);
            glowOpacity.value = withTiming(0.3);
        }
    }, [generating, glowOpacity, pulseValue]);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseValue.value }],
    }));

    const animatedGlowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const providerLabel = providerUsed === "openai" ? "OpenAI" : providerUsed === "gemini" ? "Gemini" : null;

    const getFriendlyErrorMessage = (rawError: string) => {
        const errLower = rawError.toLowerCase();

        if (errLower.includes("quota") || errLower.includes("429") || errLower.includes("exhausted")) {
            return "You exceeded your current API quota. Please check billing or quota limits and try again.";
        }
        if (errLower.includes("no attendance or tasks")) {
            return "No time logs or accomplishments were found for this date range.";
        }
        if (
            errLower.includes("api key") ||
            errLower.includes("configured") ||
            errLower.includes("provider") ||
            errLower.includes("401")
        ) {
            return "Your AI provider or API key is missing/invalid. Update Settings > API Keys.";
        }
        if (errLower.includes("network") || errLower.includes("fetch") || errLower.includes("timeout")) {
            return "Network connection failed. Please check your internet and try again.";
        }

        return "Failed to generate your AI summary. Please try again.";
    };

    const handleGenerate = async () => {
        if (!user || !activeJobId) {
            setError("Please log in and select an active job before generating.");
            return;
        }

        const canProceed = await requireOnlineFeature("ai_summary", setAlertConfig);
        if (!canProceed) {
            setError("You're offline. Reconnect to generate AI summaries.");
            return;
        }

        setGenerating(true);
        setError(null);

        try {
            const data = await fetchAISummaryData(user.id, activeJobId, startDate, endDate);
            if (!data) throw new Error("Failed to fetch local data");

            if (data.attendance.length === 0 && data.accomplishments.length === 0) {
                throw new Error("No attendance or tasks");
            }

            const summary = await generateAISummaryBundle(data);
            setReviewContent(summary.review);
            setInsightsContent(summary.insights);
            setProviderUsed(summary.provider);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err?.message || "unknown"));
        } finally {
            setGenerating(false);
        }
    };

    const renderMarkdown = (text: string) => {
        const lines = text.split("\n");
        return lines.map((line, index) => {
            if (line.trim() === "") return <View key={index} style={{ height: 12 }} />;

            let isHeader = false;
            let isBullet = false;
            let content = line;

            if (line.startsWith("### ")) {
                isHeader = true;
                content = line.replace("### ", "");
            } else if (line.startsWith("## ")) {
                isHeader = true;
                content = line.replace("## ", "");
            } else if (line.startsWith("# ")) {
                isHeader = true;
                content = line.replace("# ", "");
            } else if (line.startsWith("* ") || line.startsWith("- ")) {
                isBullet = true;
                content = line.substring(2);
            } else if (line.match(/^\d+\.\s/)) {
                isBullet = true;
                content = line.replace(/^\d+\.\s/, "");
            }

            const parts = content.split(/(\*\*.*?\*\*)/g);
            const renderedLine = parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                        <Text key={i} style={{ fontFamily: "Nunito_800ExtraBold", color: theme.colors.text }}>
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                return (
                    <Text
                        key={i}
                        style={{
                            fontFamily: isHeader ? "Nunito_800ExtraBold" : "Nunito_500Medium",
                            color: isHeader ? theme.colors.text : theme.colors.textSecondary,
                        }}
                    >
                        {part}
                    </Text>
                );
            });

            return (
                <View
                    key={index}
                    style={{
                        flexDirection: isBullet ? "row" : "column",
                        marginBottom: isHeader ? 12 : 6,
                        marginTop: isHeader ? 20 : 0,
                        paddingLeft: isBullet ? 8 : 0,
                        alignItems: isBullet ? "flex-start" : "stretch",
                    }}
                >
                    {isBullet ? (
                        <View
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: theme.colors.primary,
                                marginTop: 8,
                                marginRight: 12,
                            }}
                        />
                    ) : null}
                    <Text
                        style={{
                            flex: isBullet ? 1 : undefined,
                            fontSize: isHeader ? 18 : 15,
                            lineHeight: isHeader ? 26 : 24,
                            letterSpacing: isHeader ? -0.3 : 0,
                        }}
                    >
                        {renderedLine}
                    </Text>
                </View>
            );
        });
    };

    if (hasKey === null) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
                <ModernAlert {...alertConfig} />
                <Header title="Report Summary" />
                <LoadingScreen message="Checking AI settings..." />
            </SafeAreaView>
        );
    }

    if (!hasKey) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
                <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
                <Header title="Report Summary" />

                <Animated.View entering={FadeInDown.duration(600)} style={[styles.centerContainer, { paddingHorizontal: 32 }]}>
                    <View style={styles.heroGlowContainer}>
                        <View style={[styles.staticGlowRing, { backgroundColor: theme.colors.primary + "15" }]} />
                        <View style={[styles.fallbackIconContainer, { backgroundColor: theme.colors.primary + "20" }]}>
                            <HugeiconsIcon icon={Key01Icon} size={42} color={theme.colors.primary} />
                        </View>
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text }]}>Unlock AI Insights</Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        Connect your OpenAI and/or Gemini API key to generate performance reviews and smart analytics.
                    </Text>

                    <View style={{ width: "100%", marginTop: 40, gap: 12 }}>
                        <Button
                            title="Open API Key Settings"
                            icon={<HugeiconsIcon icon={Settings01Icon} size={20} color="#fff" />}
                            onPress={() => router.push("/settings/apikey")}
                        />
                        <Button title="Maybe Later" variant="secondary" onPress={() => router.back()} />
                    </View>
                </Animated.View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <ModernAlert {...alertConfig} />

            <Header
                title="Report Summary"
                rightElement={
                    <TouchableOpacity onPress={() => router.push("/settings/apikey")} style={styles.headerRightBtn}>
                        <HugeiconsIcon icon={Key01Icon} size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                }
            />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.duration(600)} style={styles.heroSection}>
                    <View style={styles.heroGlowContainer}>
                        <Animated.View
                            style={[styles.staticGlowRing, { backgroundColor: theme.colors.primary }, animatedGlowStyle]}
                        />

                        <Animated.View style={[styles.lottieContainer, animatedIconStyle]}>
                            <LottieView
                                source={
                                    theme.dark
                                        ? require("../../assets/animated-icons/ai-darkmode_lottie.json")
                                        : require("../../assets/animated-icons/ai-lightmode_lottie.json")
                                }
                                autoPlay
                                loop
                                speed={generating ? 2 : 1}
                                style={{ width: 200, height: 200 }}
                            />
                        </Animated.View>
                    </View>

                    <Text style={[styles.title, { color: theme.colors.text }]}>
                        {generating ? "Analyzing Data..." : reviewContent ? "Your Insights Are Ready" : "Generate Insights"}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        {generating
                            ? "Your AI provider is analyzing attendance and accomplishments for this period."
                            : "Based on your activity records from:"}
                    </Text>

                    {!generating ? (
                        <View style={[styles.dateHighlight, { backgroundColor: theme.colors.primary + "15" }]}>
                            <HugeiconsIcon icon={Calendar03Icon} size={16} color={theme.colors.primary} />
                            <Text style={[styles.dateHighlightText, { color: theme.colors.primary }]}>
                                {format(new Date(startDate), "MMM d")} - {format(new Date(endDate), "MMM d, yyyy")}
                            </Text>
                        </View>
                    ) : null}

                    {providerLabel && !generating ? (
                        <View style={[styles.providerBadge, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <Text style={[styles.providerBadgeText, { color: theme.colors.textSecondary }]}>Powered by {providerLabel}</Text>
                        </View>
                    ) : null}
                </Animated.View>

                {error ? (
                    <Animated.View
                        entering={FadeInDown}
                        exiting={FadeOut}
                        style={[
                            styles.errorCard,
                            {
                                backgroundColor: theme.colors.danger + "10",
                                borderColor: theme.colors.danger + "30",
                            },
                        ]}
                    >
                        <View style={[styles.errorIconBox, { backgroundColor: theme.colors.danger + "20" }]}>
                            <HugeiconsIcon icon={Alert01Icon} size={20} color={theme.colors.danger} />
                        </View>
                        <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
                    </Animated.View>
                ) : null}

                {!reviewContent && !generating ? (
                    <Animated.View entering={FadeInDown.delay(200)}>
                        <TouchableOpacity
                            onPress={handleGenerate}
                            activeOpacity={0.8}
                            style={[styles.generateBtn, { backgroundColor: theme.colors.primary }]}
                        >
                            <HugeiconsIcon icon={SparklesIcon} size={22} color="#fff" />
                            <Text style={styles.generateBtnText}>Generate My AI Summary</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : null}

                {generating ? (
                    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.loadingContainer}>
                        <View style={styles.loadingInner}>
                            {[0, 1].map((section) => (
                                <View
                                    key={section}
                                    style={[
                                        styles.loadingCard,
                                        {
                                            backgroundColor: theme.colors.card,
                                            borderColor: theme.colors.border,
                                        },
                                    ]}
                                >
                                    <View style={styles.loadingSectionHeader}>
                                        <View style={[styles.loadingIconBox, { backgroundColor: theme.colors.primary + "12" }]}>
                                            <HugeiconsIcon
                                                icon={section === 0 ? Activity01Icon : SparklesIcon}
                                                size={18}
                                                color={theme.colors.primary}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>
                                                {section === 0 ? "Reviewing activity records" : "Generating insight summary"}
                                            </Text>
                                            <Text style={[styles.loadingSubtitle, { color: theme.colors.textSecondary }]}>
                                                {section === 0
                                                    ? "Attendance, tasks, and work patterns are being analyzed."
                                                    : "Your AI summary is being composed and refined."}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.loadingMessageRow, { backgroundColor: theme.colors.background }]}>
                                        <ActivityIndicator size="small" color={theme.colors.primary} />
                                        <Text style={[styles.loadingMessageText, { color: theme.colors.textSecondary }]}>
                                            {section === 0 ? "Collecting relevant report context..." : "Writing a concise analysis..."}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </Animated.View>
                ) : null}

                {reviewContent && !generating ? (
                    <Animated.View entering={FadeInDown.duration(600).delay(100)}>
                        <View style={styles.sectionHeader}>
                            <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primary + "15" }]}>
                                <HugeiconsIcon icon={Activity01Icon} size={18} color={theme.colors.primary} />
                            </View>
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Performance Review</Text>
                        </View>

                        <View style={[styles.contentCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            {renderMarkdown(reviewContent)}
                        </View>

                        {insightsContent ? (
                            <Animated.View entering={FadeInDown.duration(600).delay(300)}>
                                <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                                    <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primary + "15" }]}>
                                        <HugeiconsIcon icon={SparklesIcon} size={18} color={theme.colors.primary} />
                                    </View>
                                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Smart Insights</Text>
                                </View>
                                <View
                                    style={[
                                        styles.contentCard,
                                        {
                                            backgroundColor: theme.colors.card,
                                            borderColor: theme.colors.border,
                                        },
                                    ]}
                                >
                                    {renderMarkdown(insightsContent)}
                                </View>
                            </Animated.View>
                        ) : null}

                        <TouchableOpacity
                            onPress={handleGenerate}
                            activeOpacity={0.7}
                            style={[
                                styles.regenerateBtn,
                                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                            ]}
                        >
                            <HugeiconsIcon icon={SparklesIcon} size={18} color={theme.colors.text} />
                            <Text style={[styles.regenerateText, { color: theme.colors.text }]}>Regenerate Insights</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerRightBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -8 },
    scrollContent: { padding: 24, paddingBottom: 60 },
    centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },

    heroSection: { alignItems: "center", marginBottom: 32, marginTop: 12 },

    heroGlowContainer: {
        width: 200,
        height: 200,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    staticGlowRing: {
        position: "absolute",
        width: 120,
        height: 120,
        borderRadius: 60,
        filter: "blur(35px)",
    },
    lottieContainer: {
        position: "absolute",
        width: 200,
        height: 200,
        alignItems: "center",
        justifyContent: "center",
    },
    fallbackIconContainer: {
        position: "absolute",
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: "center",
        justifyContent: "center",
    },

    title: {
        fontSize: 24,
        fontFamily: "Nunito_800ExtraBold",
        marginBottom: 12,
        textAlign: "center",
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        fontFamily: "Nunito_500Medium",
        lineHeight: 24,
        textAlign: "center",
        paddingHorizontal: 12,
    },

    dateHighlight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        marginTop: 12,
    },
    dateHighlightText: { fontSize: 14, fontFamily: "Nunito_800ExtraBold", letterSpacing: 0.2 },

    providerBadge: {
        marginTop: 12,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    providerBadgeText: { fontSize: 12, fontFamily: "Nunito_700Bold" },

    generateBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 60,
        borderRadius: 20,
        marginTop: 16,
    },
    generateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Nunito_800ExtraBold", letterSpacing: 0.3 },

    errorCard: {
        flexDirection: "row",
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        gap: 14,
        marginBottom: 24,
        alignItems: "center",
    },
    errorIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    errorText: { fontSize: 14, fontFamily: "Nunito_600SemiBold", flex: 1, lineHeight: 22 },

    loadingContainer: { paddingVertical: 24 },
    loadingInner: { width: "100%", gap: 24 },
    loadingSectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    loadingCard: {
        borderWidth: 1,
        borderRadius: 24,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.03,
        shadowRadius: 16,
        elevation: 2,
    },
    loadingIconBox: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    loadingTitle: {
        fontSize: 16,
        fontFamily: "Nunito_800ExtraBold",
        letterSpacing: -0.2,
    },
    loadingSubtitle: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "Nunito_600SemiBold",
    },
    loadingMessageRow: {
        minHeight: 48,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    loadingMessageText: {
        flex: 1,
        fontSize: 13,
        fontFamily: "Nunito_700Bold",
        lineHeight: 20,
    },

    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    sectionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    sectionTitle: { fontSize: 18, fontFamily: "Nunito_800ExtraBold", letterSpacing: -0.3 },

    contentCard: {
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
    },

    regenerateBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 32,
        marginBottom: 20,
    },
    regenerateText: { fontSize: 15, fontFamily: "Nunito_700Bold" },
});
