// filepath: lib/ai.ts
import { GoogleGenAI } from "@google/genai";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { getDB } from "./db-client";

const getAI = async () => {
  const apiKey = await AsyncStorage.getItem("gemini_api_key");
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const isAIAvailable = async () => {
    const apiKey = await AsyncStorage.getItem("gemini_api_key");
    return !!apiKey;
};

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

interface SummaryData {
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

const buildPromptContext = (data: SummaryData): string => {
  const { attendance, accomplishments, userName, jobTitle, company, department, periodLabel, startDate, endDate } = data;

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
    .slice(0, 30)
    .map((a) => {
      const cin = a.clock_in ? format(new Date(a.clock_in), "h:mm a") : "--";
      const cout = a.clock_out ? format(new Date(a.clock_out), "h:mm a") : "Still active";
      return `  ${a.date}: ${cin} → ${cout}${a.remarks ? ` (${a.remarks})` : ""}`;
    })
    .join("\n");

  const tasksSummary = accomplishments
    .slice(0, 50)
    .map((t) => `  ${t.date}: ${t.description}${t.remarks ? ` — ${t.remarks}` : ""}`)
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
${attendanceSummary || "  No attendance records"}

DAILY ACCOMPLISHMENTS
---------------------
${tasksSummary || "  No accomplishments logged"}
`.trim();
};

export const generateWeeklyReview = async (data: SummaryData): Promise<string> => {
  const ai = await getAI();
  if (!ai) throw new Error("AI is not configured. Please set your Gemini API Key in Settings.");

  const context = buildPromptContext(data);

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `You are a professional HR performance analyst writing a weekly performance review for an employee.

Based on the following data, write a concise, professional performance review summary. Use the following structure:

1. **Overview** — A 2-3 sentence executive summary of the employee's performance this period.
2. **Attendance & Punctuality** — Analyze their clock-in/clock-out patterns, consistency, overtime.
3. **Accomplishments & Productivity** — Highlight key tasks completed, noting quantity and quality.
4. **Areas of Strength** — 2-3 specific strengths demonstrated this period.
5. **Recommendations** — 1-2 constructive suggestions for improvement or areas to maintain.
6. **Overall Rating** — Give a rating: Outstanding / Exceeds Expectations / Meets Expectations / Needs Improvement.

IMPORTANT RULES:
- Be professional and constructive. Never be harsh or personal.
- Use specific data points (hours, task counts) from the provided data.
- Keep the entire review under 400 words.
- Format with markdown headers and bullet points.
- If data is sparse, acknowledge it and keep the review brief.

${context}`,
  });

  return response.text || "Unable to generate summary.";
};

export const generateAnalyticsInsights = async (data: SummaryData): Promise<string> => {
  const ai = await getAI();
  if (!ai) throw new Error("AI is not configured. Please set your Gemini API Key in Settings.");

  const context = buildPromptContext(data);

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `You are a workplace analytics assistant. Analyze the following employee data and provide smart insights.

Provide exactly 4-5 bullet point insights. Each should be:
- Data-driven (reference specific numbers)
- Actionable or informative
- Concise (one sentence each)

Categories to analyze:
• Work pattern trends (early/late starts, consistent hours)
• Productivity patterns (busy days vs quiet days)
• Overtime analysis
• Task completion patterns
• Any anomalies or notable patterns

${context}`,
  });

  return response.text || "Unable to generate insights.";
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
      "SELECT full_name, title FROM profiles WHERE id = ?",
      [userId]
    );
    const job: any = await db.getFirstAsync(
      "SELECT title, company, department FROM job_positions WHERE id = ?",
      [jobId]
    );

    const attendance: any[] = await db.getAllAsync(
      "SELECT date, clock_in, clock_out, status, remarks, title FROM attendance WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ? ORDER BY date ASC",
      [userId, jobId, startDate, endDate]
    );

    const accomplishments: any[] = await db.getAllAsync(
      "SELECT date, description, remarks FROM accomplishments WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ? ORDER BY date ASC",
      [userId, jobId, startDate, endDate]
    );

    const periodLabel = `${format(new Date(startDate), "MMM d")} – ${format(new Date(endDate), "MMM d, yyyy")}`;

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
  } catch (e) {
    console.error("[AI] Failed to fetch summary data:", e);
    return null;
  }
};