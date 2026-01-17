import { EncodingType, cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import XLSX from 'xlsx';

export const exportToExcel = async ({ data, fileName, userName, userTitle, period, columns }: any) => {
  try {
    const wsData = [
      ["ACCOMPLISHMENT REPORT"],
      ["Employee:", userName],
      ["Position:", userTitle],
      ["Period:", period],
      ["Generated:", new Date().toLocaleString()],
      [""],
    ];

    // Headers
    const headers = [];
    if (columns.date) headers.push("Date");
    if (columns.time) headers.push("Clock In", "Clock Out");
    if (columns.duration) headers.push("Duration");
    if (columns.activities) headers.push("Accomplishments");
    if (columns.remarks) headers.push("Remarks");
    wsData.push(headers);

    // Rows
    data.forEach((item: any) => {
        const row = [];
        if (columns.date) row.push(item.date);
        if (columns.time) row.push(item.clockIn, item.clockOut);
        if (columns.duration) row.push(item.duration);
        if (columns.activities) {
            const tasks = item.summary ? item.summary.map((t: any) => `• ${t.description}${t.remarks?` (${t.remarks})`:''}`).join('\n') : '';
            row.push(tasks);
        }
        if (columns.remarks) row.push(item.remarks || '');
        wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const cols = headers.map(h => ({ wch: h === 'Accomplishments' ? 60 : 15 }));
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = cacheDirectory + `${fileName}.xlsx`;
    
    await writeAsStringAsync(uri, wbout, { encoding: EncodingType.Base64 });
    return uri;

  } catch (error) {
    throw error;
  }
};