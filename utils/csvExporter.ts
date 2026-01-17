// FIXED: Use xlsx for genuine .xlsx files
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

interface ReportData {
    userName: string;
    userTitle: string;
    company?: string;
    department?: string;
    reportTitle: string;
    period: string;
    data: any[];
    columns?: any;
    includeDept?: boolean; // Added to check if dept should be shown
}

export const exportToExcel = async ({ 
    userName, userTitle, company, department, reportTitle, period, data, columns, includeDept 
}: ReportData & { fileName: string }) => {
    
    // 1. Prepare Data for Excel
    // We create an array of arrays to represent rows
    const sheetData: any[][] = [];

    // --- Metadata Header Rows ---
    sheetData.push([reportTitle]); // Row 1: Title
    sheetData.push([""]); // Spacer
    sheetData.push(["Employee Name", userName]);
    sheetData.push(["Job Position", userTitle]);
    if (company) sheetData.push(["Organization", company]);
    if (includeDept && department) sheetData.push(["Department", department]);
    sheetData.push(["Report Period", period]);
    sheetData.push(["Generated Date", new Date().toLocaleDateString()]);
    sheetData.push([""]); // Spacer

    // --- Table Headers ---
    const headers = ["Date"];
    if (columns?.time) { headers.push("Time In", "Time Out"); }
    if (columns?.duration) { headers.push("Duration"); }
    headers.push("Activities");
    if (columns?.remarks) { headers.push("Remarks"); }
    // Removed Documentation column as requested for Excel

    sheetData.push(headers);

    // --- Table Rows ---
    data.forEach((item) => {
        const row = [];
        
        // Clean date (remove the day name if it was added with newlines)
        const cleanDate = item.date.replace(/\n/g, ' ').replace(/<[^>]*>/g, '');
        row.push(cleanDate);

        if (columns?.time) {
            row.push(item.clockIn || '--:--', item.clockOut || '--:--');
        }
        if (columns?.duration) {
            row.push(item.duration || '--');
        }

        // Flatten activities
        const activities = (item.summary || []).map((t: any) => `• ${t.description}`).join('\n');
        row.push(activities);

        if (columns?.remarks) {
            row.push(item.remarks || '');
        }

        sheetData.push(row);
    });

    // 2. Create Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Optional: Set column widths
    ws['!cols'] = [
        { wch: 15 }, // Date
        { wch: 10 }, // In
        { wch: 10 }, // Out
        { wch: 12 }, // Duration
        { wch: 50 }, // Activities
        { wch: 25 }, // Remarks
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // 3. Write to Base64
    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // 4. Save File
    // Note: .xlsx extension
    const fileName = `Report_${period.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    const filePath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, base64, { encoding: FileSystem.EncodingType.Base64 });

    return filePath;
};