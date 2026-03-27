import * as FileSystem from 'expo-file-system/legacy';

const getLastPathSegment = (uri: string) => {
    const normalized = decodeURIComponent(uri).replace(/\/+$/, '');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
};

const findExistingDirectory = async (parentUri: string, directoryName: string) => {
    const contents = await FileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
    return (
        contents.find((uri) => getLastPathSegment(uri).toLowerCase() === directoryName.toLowerCase()) ||
        null
    );
};

export const findExistingSafEntry = async (parentUri: string, entryName: string) => {
    const contents = await FileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
    return (
        contents.find((uri) => getLastPathSegment(uri).toLowerCase() === entryName.toLowerCase()) ||
        null
    );
};

const ensureChildDirectory = async (parentUri: string, directoryName: string) => {
    const existing = await findExistingDirectory(parentUri, directoryName);
    if (existing) return existing;
    return FileSystem.StorageAccessFramework.makeDirectoryAsync(parentUri, directoryName);
};

const ensureDartChildDirectory = async (baseUri: string, directoryName: string) => {
    const dartUri = await ensureChildDirectory(baseUri, 'DART');
    return ensureChildDirectory(dartUri, directoryName);
};

export const ensureDartReportsDirectory = async (baseUri: string) => {
    const selectedName = getLastPathSegment(baseUri).toLowerCase();

    if (selectedName === 'reports') return baseUri;
    if (selectedName === 'dart') return ensureChildDirectory(baseUri, 'Reports');

    return ensureDartChildDirectory(baseUri, 'Reports');
};

export const ensureDartDocumentationsDirectory = async (baseUri: string) => {
    return ensureDartChildDirectory(baseUri, 'Documentations');
};
