import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

interface ReportData {
  userName: string;
  userTitle: string;
  company?: string;
  department?: string;
  reportTitle: string;
  period: string;
  data: any[];
  columns?: any;
  includeDept?: boolean;
  totals?: {
    totalDays?: number;
    totalHours?: string;
  };
}

export const exportToExcel = async ({
  userName,
  userTitle,
  company,
  department,
  reportTitle,
  period,
  data,
  columns,
  includeDept,
  totals,
  fileName,
}: ReportData & { fileName: string }) => {
  const workbook = XLSX.utils.book_new();
  const generatedAt = new Date();
  const normalizedColumns = {
    time: columns?.time !== false,
    duration: columns?.duration !== false,
    remarks: columns?.remarks !== false,
  };

  const summarySheetData: any[][] = [
    [reportTitle],
    [""],
    ["Employee Name", userName],
    ["Job Position", userTitle],
  ];

  if (company) summarySheetData.push(["Organization", company]);
  if (includeDept && department) summarySheetData.push(["Department", department]);
  summarySheetData.push(["Report Period", period]);
  summarySheetData.push(["Generated Date", generatedAt.toLocaleString()]);
  if (totals?.totalDays) summarySheetData.push(["Included Days", totals.totalDays]);
  if (totals?.totalHours) summarySheetData.push(["Total Hours", totals.totalHours]);
  summarySheetData.push(["Total Activities", data.reduce((sum, item) => sum + ((item.summary || []).length as number), 0)]);
  summarySheetData.push([""]);
  summarySheetData.push(["Workbook Tabs", "Summary, Daily Log, Activities"]);

  const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const dailyHeaders = ["Date"];
  if (normalizedColumns.time) dailyHeaders.push("Time In", "Time Out");
  if (normalizedColumns.duration) dailyHeaders.push("Hours");
  dailyHeaders.push("Activity Count", "Activities");
  if (normalizedColumns.remarks) dailyHeaders.push("Remarks");

  const dailyRows = data.map((item) => {
    const row: any[] = [String(item.date || "").replace(/\n/g, " ").replace(/<[^>]*>/g, "")];

    if (normalizedColumns.time) {
      row.push(item.clockIn || "--:--", item.clockOut || "--:--");
    }
    if (normalizedColumns.duration) {
      row.push(item.duration || "--");
    }

    row.push((item.summary || []).length);
    row.push(
      (item.summary || [])
        .map((task: any) => `${task.doneAt ? `[${task.doneAt}] ` : ""}- ${task.description}`)
        .join("\n"),
    );

    if (normalizedColumns.remarks) {
      row.push(
        (item.summary || [])
          .map((task: any) => task?.remarks ? `${task.doneAt ? `[${task.doneAt}] ` : ""}${task.remarks}` : "")
          .filter(Boolean)
          .join("\n"),
      );
    }

    return row;
  });

  const dailySheet = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]);
  dailySheet["!cols"] = [
    { wch: 18 },
    ...(normalizedColumns.time ? [{ wch: 11 }, { wch: 11 }] : []),
    ...(normalizedColumns.duration ? [{ wch: 12 }] : []),
    { wch: 12 },
    { wch: 58 },
    ...(normalizedColumns.remarks ? [{ wch: 32 }] : []),
  ];
  dailySheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, dailySheet, "Daily Log");

  const activityHeaders = ["Date", "Completed At", "Description", "Remarks", "Documentation Count"];
  const activityRows = data.flatMap((item) =>
    (item.summary || []).length > 0
      ? (item.summary || []).map((task: any) => [
          String(item.date || "").replace(/\n/g, " ").replace(/<[^>]*>/g, ""),
          task.doneAt || "",
          task.description || "",
          task.remarks || "",
          Array.isArray(task.images) ? task.images.length : 0,
        ])
      : [[String(item.date || "").replace(/\n/g, " ").replace(/<[^>]*>/g, ""), "", "No activities logged", "", 0]],
  );

  const activitySheet = XLSX.utils.aoa_to_sheet([activityHeaders, ...activityRows]);
  activitySheet["!cols"] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 48 },
    { wch: 36 },
    { wch: 20 },
  ];
  activitySheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, activitySheet, "Activities");

  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const validFileName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  const filePath = `${FileSystem.documentDirectory}${validFileName}`;

  await FileSystem.writeAsStringAsync(filePath, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filePath;
};
