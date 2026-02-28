// services/ExportService.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getDB } from '../lib/db-client';

export const ExportService = {
  exportAllData: async (userId: string) => {
    try {
        const db = await getDB();
        
        const attendance = await db.getAllAsync('SELECT * FROM attendance WHERE user_id = ?', [userId]);
        const accomplishments = await db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ?', [userId]);
        const reports = await db.getAllAsync('SELECT * FROM saved_reports WHERE user_id = ?', [userId]);
        const jobs = await db.getAllAsync('SELECT * FROM job_positions WHERE user_id = ?', [userId]);
        const profiles = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
        const notifications = await db.getAllAsync('SELECT * FROM notifications WHERE user_id = ?', [userId]);
        
        const fileData: Record<string, string> = {};
        
        const attachFile = async (path: string | null) => {
          if (!path || !path.startsWith('file://')) return;
          try {
             const base64 = await FileSystem.readAsStringAsync(path, { encoding: 'base64' });
             fileData[path] = base64;
          } catch {
             // safely ignore files that no longer exist or fail to read
          }
        };

        for (const a of accomplishments as any[]) if(a.image_url) await attachFile(a.image_url);
        for (const r of reports as any[]) if(r.file_path) await attachFile(r.file_path);
        if ((profiles as any)?.local_avatar_path) await attachFile((profiles as any).local_avatar_path);

        const exportObj = {
          metadata: { exportDate: new Date().toISOString(), appVersion: '1.0.2-dev', userId },
          data: { attendance, accomplishments, reports, jobs, profiles, notifications },
          files: fileData
        };

        const jsonStr = JSON.stringify(exportObj);
        const fileName = `DART_Backup_${Date.now()}.json`;
        
        if (Platform.OS === 'android') {
            // Android: Save directly to a chosen folder using Storage Access Framework
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
                const uri = await FileSystem.StorageAccessFramework.createFileAsync(
                    permissions.directoryUri, 
                    fileName, 
                    'application/json'
                );
                await FileSystem.writeAsStringAsync(uri, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
                return true;
            } else {
                throw new Error("Storage permission denied");
            }
        } else {
            // iOS: File sandboxing requires using the Share sheet to access the "Files" app
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;
            await FileSystem.writeAsStringAsync(fileUri, jsonStr);
            
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, { 
                    UTI: 'public.json', 
                    mimeType: 'application/json', 
                    dialogTitle: 'Save Backup Data' 
                });
            }
            return true;
        }
    } catch (error) {
        console.error("Data export failed", error);
        throw error;
    }
  }
};