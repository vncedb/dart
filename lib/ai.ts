import { GoogleGenAI } from "@google/genai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { getDB } from "./db-client";

const GEMINI_KEY_STORAGE = "gemini_api_key";
const OPENAI_KEY_STORAGE = "openai_api_key";
const AI_PROVIDER_STORAGE = "ai_provider_preference";

export type AIProvider = "gemini" | "openai";
export type AIProviderPreference = "auto" | AIProvider;

interface AISettings {
  providerPreference: AIProviderPreference;
  hasGeminiKey: boolean;
  hasOpenAIKey: boolean;
}

interface AttendanceRow {
  date: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
  remarks: string | null;
  title: string | null;
}

interface AccomplishmentRow {
  date: string;
  description: string;
  remarks: string | null;
}

export interface SummaryData {
  attendance: AttendanceRow[];
  accomplishments: AccomplishmentRow[];
  userName: string;
  jobTitle: string;
  company: string;
  department: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
}

interface GeneratedSummary {
  review: string;
  insights: string;
  provider: AIProvider;
}

const normalizeProviderPreference = (value: string | null): AIProviderPreference => {
  if (value === "openai" || value === "gemini" || value === "auto") return value;
  return "auto";
};

export const getStoredAIKeys = async () => {
  const [geminiApiKey, openAIApiKey] = await Promise.all([
    AsyncStorage.getItem(GEMINI_KEY_STORAGE),
    AsyncStorage.getItem(OPENAI_KEY_STORAGE),
  ]);

  return {
    geminiApiKey: geminiApiKey || "",
    openAIApiKey: openAIApiKey || "",
  };
};

export const getAISettings = async (): Promise<AISettings> => {
  const [providerRaw, keys] = await Promise.all([
    AsyncStorage.getItem(AI_PROVIDER_STORAGE),
    getStoredAIKeys(),
  ]);

  return {
    providerPreference: normalizeProviderPreference(providerRaw),
    hasGeminiKey: keys.geminiApiKey.trim().length > 0,
    hasOpenAIKey: keys.openAIApiKey.trim().length > 0,
  };
};

export const isAIAvailable = async () => {
  const settings = await getAISettings();
  return settings.hasGeminiKey || settings.hasOpenAIKey;
};

export const setAIProviderPreference = async (provider: AIProviderPreference) => {
  await AsyncStorage.setItem(AI_PROVIDER_STORAGE, provider);
};

export const setGeminiApiKey = async (apiKey: string) => {
  await AsyncStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim());
};

export const setOpenAIApiKey = async (apiKey: string) => {
  await AsyncStorage.setItem(OPENAI_KEY_STORAGE, apiKey.trim());
};

export const removeGeminiApiKey = async () => {
  await AsyncStorage.removeItem(GEMINI_KEY_STORAGE);
};

export const removeOpenAIApiKey = async () => {
  await AsyncStorage.removeItem(OPENAI_KEY_STORAGE);
};

const getProviderOrder = (
  preference: AIProviderPreference,
  hasOpenAIKey: boolean,
  hasGeminiKey: boolean
): AIProvider[] => {
  if (preference === "openai") return hasOpenAIKey ? ["openai"] : [];
  if (preference === "gemini") return hasGeminiKey ? ["gemini"] : [];

  const order: AIProvider[] = [];
  if (hasOpenAIKey) order.push("openai");
  if (hasGeminiKey) order.push("gemini");
  return order;
};

const buildPromptContext = (data: SummaryData): string => {
  const {
    attendance,
    accomplishments,
    userName,
    jobTitle,
    company,
    department,
    periodLabel,
    startDate,
    endDate,
  } = data;

  const totalDays = attendance.length;
  let totalMinutes = 0;
  let daysWithOvertime = 0;
  let incompleteDays = 0;

  for (const row of attendance) {
    if (row.clock_in && row.clock_out) {
      const cin = new Date(row.clock_in);
      const cout = new Date(row.clock_out);
      const mins = Math.max(0, (cout.getTime() - cin.getTime()) / 60000);
      totalMinutes += mins;
      if (mins > 480) daysWithOvertime++;
    } else {
      incompleteDays++;
    }
  }

  const avgHoursPerDay = totalDays > 0 ? (totalMinutes / 60 / totalDays).toFixed(1) : "0";
  const totalHours = (totalMinutes / 60).toFixed(1);

  const attendanceSummary = attendance
    .slice(0, 40)
    .map((a) => {
      const cin = a.clock_in ? format(new Date(a.clock_in), "h:mm a") : "--";
      const cout = a.clock_out ? format(new Date(a.clock_out), "h:mm a") : "Still active";
      return `- ${a.date}: ${cin} to ${cout}${a.remarks ? ` (${a.remarks})` : ""}`;
    })
    .join("\n");

  const tasksSummary = accomplishments
    .slice(0, 60)
    .map((t) => `- ${t.date}: ${t.description}${t.remarks ? ` - ${t.remarks}` : ""}`)
    .join("\n");

  return `
EMPLOYEE PERFORMANCE DATA
========================
Name: ${userName}
Title: ${jobTitle}
Company: ${company || "N/A"}
Department: ${department || "N/A"}
Period: ${periodLabel} (${startDate} to ${endDate})

STATISTICS
----------
Days Worked: ${totalDays}
Total Hours: ${totalHours}h
Average Hours/Day: ${avgHoursPerDay}h
Days with Overtime: ${daysWithOvertime}
Incomplete Clock-Outs: ${incompleteDays}

ATTENDANCE LOG
--------------
${attendanceSummary || "- No attendance records"}

DAILY ACCOMPLISHMENTS
---------------------
${tasksSummary || "- No accomplishments logged"}
`.trim();
};

const buildReviewPrompt = (context: string) => `You are a professional HR performance analyst writing a weekly performance review for an employee.

Based on the following data, write a concise, professional performance review summary. Use this structure:

1. **Overview** - A 2-3 sentence executive summary.
2. **Attendance & Punctuality** - Clock-in/out consistency and overtime patterns.
3. **Accomplishments & Productivity** - Key tasks completed and output quality.
4. **Areas of Strength** - 2-3 specific strengths.
5. **Recommendations** - 1-2 constructive suggestions.
6. **Overall Rating** - One of: Outstanding / Exceeds Expectations / Meets Expectations / Needs Improvement.

Rules:
- Keep tone constructive and professional.
- Use data points from the provided context.
- Keep total length under 400 words.
- Use markdown headers and concise bullets.
- If data is sparse, acknowledge it clearly.

${context}`;

const buildInsightsPrompt = (context: string) => `You are a workplace analytics assistant.

Analyze the employee data and provide exactly 4 to 5 bullet insights. Each insight must be:
- Data-driven
- Actionable or informative
- One sentence only

Focus on:
- Work pattern trends
- Productivity patterns
- Overtime behavior
- Task completion patterns
- Notable anomalies

${context}`;

const callGemini = async (prompt: string): Promise<string> => {
  const apiKey = await AsyncStorage.getItem(GEMINI_KEY_STORAGE);
  if (!apiKey) throw new Error("Gemini API key is missing.");

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  const text = (response.text || "").trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
};

const callOpenAI = async (prompt: string): Promise<string> => {
  const apiKey = await AsyncStorage.getItem(OPENAI_KEY_STORAGE);
  if (!apiKey) throw new Error("OpenAI API key is missing.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "You are a concise, professional workplace analytics assistant. Return markdown output only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
  }

  const message = (payload?.choices?.[0]?.message?.content || "").trim();
  if (!message) throw new Error("OpenAI returned an empty response.");

  return message;
};

const generateFromProvider = async (provider: AIProvider, prompt: string): Promise<string> => {
  if (provider === "openai") return callOpenAI(prompt);
  return callGemini(prompt);
};

const resolveProviderOrder = async (
  forceProvider?: AIProvider
): Promise<{ order: AIProvider[]; preference: AIProviderPreference }> => {
  const settings = await getAISettings();

  if (forceProvider) {
    const forcedOrder = getProviderOrder(
      forceProvider,
      settings.hasOpenAIKey,
      settings.hasGeminiKey
    );

    return { order: forcedOrder, preference: forceProvider };
  }

  const order = getProviderOrder(
    settings.providerPreference,
    settings.hasOpenAIKey,
    settings.hasGeminiKey
  );

  return { order, preference: settings.providerPreference };
};

const generateWithBestProvider = async (
  prompt: string,
  forceProvider?: AIProvider
): Promise<{ text: string; provider: AIProvider }> => {
  const { order, preference } = await resolveProviderOrder(forceProvider);

  if (order.length === 0) {
    if (preference === "openai") {
      throw new Error("OpenAI is selected but no OpenAI API key is configured.");
    }

    if (preference === "gemini") {
      throw new Error("Gemini is selected but no Gemini API key is configured.");
    }

    throw new Error("AI is not configured. Add at least one API key in Settings > API Keys.");
  }

  let lastError: unknown = null;

  for (const provider of order) {
    try {
      const text = await generateFromProvider(provider, prompt);
      return { text, provider };
    } catch (error) {
      lastError = error;

      // In explicit mode (not auto), do not silently fallback.
      if (preference !== "auto") break;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Failed to generate AI response.");
};

export const generateWeeklyReview = async (
  data: SummaryData,
  forceProvider?: AIProvider
): Promise<string> => {
  const context = buildPromptContext(data);
  const prompt = buildReviewPrompt(context);
  const result = await generateWithBestProvider(prompt, forceProvider);
  return result.text;
};

export const generateAnalyticsInsights = async (
  data: SummaryData,
  forceProvider?: AIProvider
): Promise<string> => {
  const context = buildPromptContext(data);
  const prompt = buildInsightsPrompt(context);
  const result = await generateWithBestProvider(prompt, forceProvider);
  return result.text;
};

export const generateAISummaryBundle = async (
  data: SummaryData,
  forceProvider?: AIProvider
): Promise<GeneratedSummary> => {
  const context = buildPromptContext(data);
  const reviewPrompt = buildReviewPrompt(context);
  const insightsPrompt = buildInsightsPrompt(context);

  const { order, preference } = await resolveProviderOrder(forceProvider);

  if (order.length === 0) {
    if (preference === "openai") {
      throw new Error("OpenAI is selected but no OpenAI API key is configured.");
    }

    if (preference === "gemini") {
      throw new Error("Gemini is selected but no Gemini API key is configured.");
    }

    throw new Error("AI is not configured. Add at least one API key in Settings > API Keys.");
  }

  let lastError: unknown = null;

  for (const provider of order) {
    try {
      const [review, insights] = await Promise.all([
        generateFromProvider(provider, reviewPrompt),
        generateFromProvider(provider, insightsPrompt),
      ]);

      return { review, insights, provider };
    } catch (error) {
      lastError = error;
      if (preference !== "auto") break;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Failed to generate AI summary.");
};

export const fetchAISummaryData = async (
  userId: string,
  jobId: string,
  startDate: string,
  endDate: string
): Promise<SummaryData | null> => {
  try {
    const db = await getDB();

    const profile: any = await db.getFirstAsync(
      "SELECT full_name, title FROM profiles WHERE id = ? AND deleted_at IS NULL",
      [userId]
    );

    const job: any = await db.getFirstAsync(
      "SELECT title, company, department FROM job_positions WHERE id = ? AND deleted_at IS NULL",
      [jobId]
    );

    const attendance: any[] = await db.getAllAsync(
      "SELECT date, clock_in, clock_out, status, remarks, title FROM attendance WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date ASC",
      [userId, jobId, startDate, endDate]
    );

    const accomplishments: any[] = await db.getAllAsync(
      "SELECT date, description, remarks FROM accomplishments WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date ASC",
      [userId, jobId, startDate, endDate]
    );

    const periodLabel = `${format(new Date(startDate), "MMM d")} - ${format(new Date(endDate), "MMM d, yyyy")}`;

    return {
      attendance,
      accomplishments,
      userName: profile?.full_name || "Employee",
      jobTitle: job?.title || profile?.title || "Staff",
      company: job?.company || "",
      department: job?.department || "",
      periodLabel,
      startDate,
      endDate,
    };
  } catch (error) {
    console.error("[AI] Failed to fetch summary data:", error);
    return null;
  }
};
