import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { findExistingSafEntry, ensureDartReportsDirectory } from "./saf-directory";

export const REPORTS_DIRECTORY_KEY = "reports_directory_uri";
export const INTERNAL_REPORTS_DIR = `${FileSystem.documentDirectory}DART/Reports/`;

const REPORT_FILE_TYPES = new Set(["pdf", "xlsx"]);

export const isSafUri = (uri?: string | null) => !!uri && uri.startsWith("content://");

export const getReportFileExtension = (fileType: string) => {
  const normalized = String(fileType || "").toLowerCase();
  if (normalized.includes("pdf")) return "pdf";
  return "xlsx";
};

export const getReportMimeType = (fileType: string) => {
  const extension = getReportFileExtension(fileType);
  if (extension === "pdf") return "application/pdf";
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
};

export const getSafeFileInfo = async (uri?: string | null) => {
  if (!uri) return { exists: false, size: 0, modificationTime: 0 };
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return {
      exists: info.exists,
      size: info.exists ? info.size || 0 : 0,
      modificationTime: info.exists ? info.modificationTime || 0 : 0,
    };
  } catch {
    return { exists: false, size: 0, modificationTime: 0 };
  }
};

export const ensureInternalReportsDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(INTERNAL_REPORTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(INTERNAL_REPORTS_DIR, { intermediates: true });
  }
  return INTERNAL_REPORTS_DIR;
};

export const getStoredReportsDirectoryUri = async () => {
  if (Platform.OS !== "android") return null;
  return AsyncStorage.getItem(REPORTS_DIRECTORY_KEY);
};

export const requestReportsDirectoryUri = async () => {
  if (Platform.OS !== "android") return null;

  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return null;

  const finalUri = await ensureDartReportsDirectory(permissions.directoryUri);
  await AsyncStorage.setItem(REPORTS_DIRECTORY_KEY, finalUri);
  return finalUri;
};

const normalizeFileName = (fileName: string, fileType: string) => {
  const cleanName = fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim() || "report";
  const ext = getReportFileExtension(fileType);
  return cleanName.toLowerCase().endsWith(`.${ext}`) ? cleanName : `${cleanName}.${ext}`;
};

const stripExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

export const saveReportFileOffline = async ({
  sourceUri,
  fileName,
  fileType,
}: {
  sourceUri: string;
  fileName: string;
  fileType: string;
}) => {
  const normalizedFileName = normalizeFileName(fileName, fileType);
  await ensureInternalReportsDirExists();
  const destinationPath = `${INTERNAL_REPORTS_DIR}${normalizedFileName}`;
  const existingTarget = await getSafeFileInfo(destinationPath);
  if (existingTarget.exists) {
    await FileSystem.deleteAsync(destinationPath, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: destinationPath });

  const fileInfo = await getSafeFileInfo(destinationPath);
  if (!fileInfo.exists || fileInfo.size <= 0) {
    throw new Error("REPORT_SAVE_EMPTY");
  }

  return { filePath: destinationPath, fileSize: fileInfo.size, fileName: normalizedFileName };
};

export const deleteReportFile = async (uri?: string | null) => {
  if (!uri) return;
  if (isSafUri(uri)) {
    await FileSystem.StorageAccessFramework.deleteAsync(uri);
    return;
  }
  await FileSystem.deleteAsync(uri, { idempotent: true });
};

export const renameReportFileOffline = async ({
  currentUri,
  nextFileName,
  fileType,
}: {
  currentUri: string;
  nextFileName: string;
  fileType: string;
}) => {
  const normalizedFileName = normalizeFileName(nextFileName, fileType);

  if (isSafUri(currentUri)) {
    const directoryUri = await getStoredReportsDirectoryUri();
    if (!directoryUri) {
      throw new Error("REPORTS_DIRECTORY_REQUIRED");
    }

    const existingUri = await findExistingSafEntry(directoryUri, normalizedFileName);
    if (existingUri && existingUri !== currentUri) {
      await FileSystem.StorageAccessFramework.deleteAsync(existingUri);
    }

    const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      stripExtension(normalizedFileName),
      getReportMimeType(fileType),
    );
    const base64Data = await FileSystem.readAsStringAsync(currentUri, { encoding: "base64" });
    await FileSystem.writeAsStringAsync(destinationUri, base64Data, { encoding: "base64" });
    if (destinationUri !== currentUri) {
      await FileSystem.StorageAccessFramework.deleteAsync(currentUri);
    }

    const fileInfo = await getSafeFileInfo(destinationUri);
    if (!fileInfo.exists || fileInfo.size <= 0) {
      throw new Error("REPORT_RENAME_EMPTY");
    }

    return { filePath: destinationUri, fileSize: fileInfo.size, fileName: normalizedFileName };
  }

  await ensureInternalReportsDirExists();
  const targetPath = `${INTERNAL_REPORTS_DIR}${normalizedFileName}`;
  if (targetPath !== currentUri) {
    const existingTarget = await getSafeFileInfo(targetPath);
    if (existingTarget.exists) {
      await FileSystem.deleteAsync(targetPath, { idempotent: true });
    }
    await FileSystem.moveAsync({ from: currentUri, to: targetPath });
  }

  const fileInfo = await getSafeFileInfo(targetPath);
  if (!fileInfo.exists || fileInfo.size <= 0) {
    throw new Error("REPORT_RENAME_EMPTY");
  }

  return { filePath: targetPath, fileSize: fileInfo.size, fileName: normalizedFileName };
};

export const exportReportFileToDevice = async ({
  sourceUri,
  fileName,
  fileType,
}: {
  sourceUri: string;
  fileName: string;
  fileType: string;
}) => {
  const normalizedFileName = normalizeFileName(fileName, fileType);

  if (Platform.OS === "android") {
    const directoryUri = (await getStoredReportsDirectoryUri()) || (await requestReportsDirectoryUri());
    if (!directoryUri) {
      throw new Error("REPORTS_DIRECTORY_REQUIRED");
    }

    const existingUri = await findExistingSafEntry(directoryUri, normalizedFileName);
    if (existingUri) {
      await FileSystem.StorageAccessFramework.deleteAsync(existingUri);
    }

    const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      stripExtension(normalizedFileName),
      getReportMimeType(fileType),
    );
    const base64Data = await FileSystem.readAsStringAsync(sourceUri, { encoding: "base64" });
    await FileSystem.writeAsStringAsync(destinationUri, base64Data, { encoding: "base64" });

    const fileInfo = await getSafeFileInfo(destinationUri);
    if (!fileInfo.exists || fileInfo.size <= 0) {
      throw new Error("REPORT_EXPORT_EMPTY");
    }

    return { filePath: destinationUri, fileSize: fileInfo.size, fileName: normalizedFileName };
  }

  await ensureInternalReportsDirExists();
  const destinationPath = `${INTERNAL_REPORTS_DIR}${normalizedFileName}`;
  const existingTarget = await getSafeFileInfo(destinationPath);
  if (existingTarget.exists) {
    await FileSystem.deleteAsync(destinationPath, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: destinationPath });

  const fileInfo = await getSafeFileInfo(destinationPath);
  if (!fileInfo.exists || fileInfo.size <= 0) {
    throw new Error("REPORT_EXPORT_EMPTY");
  }

  return { filePath: destinationPath, fileSize: fileInfo.size, fileName: normalizedFileName };
};

export const scanStoredReportFiles = async () => {
  await ensureInternalReportsDirExists();
  const fileNames = await FileSystem.readDirectoryAsync(INTERNAL_REPORTS_DIR);
  const files = await Promise.all(
    fileNames.map(async (fileName) => {
      const extension = fileName.split(".").pop()?.toLowerCase() || "";
      if (!REPORT_FILE_TYPES.has(extension)) return null;

      const uri = `${INTERNAL_REPORTS_DIR}${fileName}`;
      const info = await getSafeFileInfo(uri);
      if (!info.exists || info.size <= 0) return null;

      return {
        uri,
        fileName,
        fileType: extension,
        size: info.size,
        modificationTime: info.modificationTime,
      };
    }),
  );
  return files.filter(Boolean) as Array<{
    uri: string;
    fileName: string;
    fileType: string;
    size: number;
    modificationTime: number;
  }>;
};
