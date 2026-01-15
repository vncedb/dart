import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import XLSX from 'xlsx';

export const exportToExcel = async (data: any[], fileName: string) => {
  try {
    // 1. Create a Worksheet
    const ws = XLSX.utils.json_to_sheet(data);
    
    // 2. Create a Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");

    // 3. Write to Base64
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // 4. Save to FileSystem
    const uri = FileSystem.cacheDirectory + `${fileName.replace(/[^a-z0-9]/gi, '_')}.xlsx`;
    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: FileSystem.EncodingType.Base64
    });

    // 5. Share
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export Data'
    });

  } catch (error) {
    console.error("Export Error:", error);
    throw error;
  }
};