// filepath: app/reports/add-entry.tsx
import {
    CheckListIcon,
    ArrowDown01Icon,
    Calendar03Icon,
    Camera01Icon,
    Delete02Icon,
    Image01Icon,
    Key01Icon,
    PencilEdit02Icon,
    SparklesIcon,
    Time02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { encode as encodeArrayBuffer } from 'base64-arraybuffer';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../../components/ActionMenu';
import Button from '../../components/Button';
import DatePicker from '../../components/DatePicker';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import IconButton from '../../components/IconButton';
import LoadingOverlay from '../../components/LoadingOverlay';
import LoadingScreen from '../../components/LoadingScreen';
import ModernAlert from '../../components/ModernAlert';
import TimePicker from '../../components/TimePicker';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { generateUUID, queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { requireOnlineFeature } from '../../lib/offline-access';
import { formatMinutesAsHours, summarizeAttendances } from '../../lib/report-helpers';
import { refreshWidgetSnapshot } from '../../lib/widgets';
import {
    generateEntryDescriptionFromPhotos,
    generateEntryDescriptionSuggestion,
    isAIAvailable,
    rewriteEntryDescriptionSuggestion,
    type AIProvider,
    type EntryRewriteMode,
} from '../../lib/ai';

const MAX_PHOTOS = 4;

const isWithinSessionWindows = (target: Date, windows: { start: Date; end: Date }[]) =>
    windows.some(({ start, end }) => target.getTime() >= start.getTime() && target.getTime() <= end.getTime());

const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

export default function AddEntryScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { user } = useAuth(); 
    const { triggerSync } = useSync();
    
    const { id, jobId, date: paramDate, fixedDate, showAttendance } = useLocalSearchParams();
    const entryId = Array.isArray(id) ? id[0] : id; 
    const passedJobId = Array.isArray(jobId) ? jobId[0] : jobId;
    const isFixedDate = fixedDate === 'true';
    const showAttendanceBool = showAttendance === 'true';
    
    const canEditDate = !isFixedDate && !entryId;
    
    // --- Data States ---
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date>(paramDate ? new Date(paramDate as string) : new Date());
    const [activityTime, setActivityTime] = useState<Date>(new Date());
    
    // --- Time States (Attendance Mode) ---
    const [timeIn, setTimeIn] = useState<Date | undefined>(undefined);
    const [timeOut, setTimeOut] = useState<Date | undefined>(undefined);
    const [existingAttendances, setExistingAttendances] = useState<any[]>([]);
    const [attendanceLocked, setAttendanceLocked] = useState(false);

    // --- Modal States ---
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showActivityTimePicker, setShowActivityTimePicker] = useState(false);
    const [showTimeInPicker, setShowTimeInPicker] = useState(false);
    const [showTimeOutPicker, setShowTimeOutPicker] = useState(false);

    // --- UI/UX States ---
    const [errors, setErrors] = useState({ description: false });
    const [loading, setLoading] = useState(false);
    const [aiGenerating, setAIGenerating] = useState(false);
    const [aiReady, setAIReady] = useState(false);
    const [aiProviderUsed, setAIProviderUsed] = useState<AIProvider | null>(null);
    const [aiLastAction, setAILastAction] = useState<string | null>(null);
    const [aiBusyMessage, setAIBusyMessage] = useState('Working with AI...');
    const [aiMenuVisible, setAIMenuVisible] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'warning', title: 'Discard Changes?', message: 'You have unsaved changes. Are you sure you want to leave?',
                confirmText: 'Discard', cancelText: 'Keep Editing',
                onConfirm: () => {
                    setAlertConfig((p: any) => ({ ...p, visible: false }));
                    setIsDirty(false); 
                    navigation.dispatch(e.data.action);
                },
                onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        });
        return unsubscribe;
    }, [navigation, loading, isDirty]);

    const fetchActiveJob = useCallback(async () => {
        if (!user) return;
        try {
            const db = await getDB();
            const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);
            if (profile?.current_job_id) setActiveJobId(profile.current_job_id);
        } catch (e) {
            console.log(e);
        } finally {
            setInitialLoading(false);
        }
    }, [user]);

    const fetchEntryDetails = useCallback(async (id: string) => {
        try {
            const db = await getDB();
            const entry: any = await db.getFirstAsync('SELECT * FROM accomplishments WHERE id = ?', [id]);
            if (entry) {
                setDescription(entry.description);
                setRemarks(entry.remarks || '');
                setActiveJobId(entry.job_id);
                setSelectedDate(new Date(entry.date));
                setActivityTime(entry.created_at ? new Date(entry.created_at) : new Date(entry.date));
                if (entry.image_url) {
                    try {
                        const parsed = JSON.parse(entry.image_url);
                        setImages(Array.isArray(parsed) ? parsed : [entry.image_url]);
                    } catch {
                        setImages([entry.image_url]);
                    }
                }
                setIsDirty(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setInitialLoading(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            if (entryId) await fetchEntryDetails(entryId);
            else if (passedJobId) { setActiveJobId(passedJobId); setInitialLoading(false); }
            else await fetchActiveJob();
        };
        init();
    }, [entryId, passedJobId, fetchEntryDetails, fetchActiveJob]);

    useFocusEffect(
        useCallback(() => {
            const checkAI = async () => {
                const available = await isAIAvailable();
                setAIReady(available);
            };
            checkAI();
        }, [])
    );

    // --- Time Handlers ---
    const handleTimeConfirm = (setter: React.Dispatch<React.SetStateAction<Date | undefined>>) => 
        (hours: number, minutes: number, period?: "AM" | "PM" | undefined) => {
            const newDate = new Date(selectedDate);
            let h = hours;
            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            
            newDate.setHours(h, minutes, 0, 0);
            setter(newDate);
            setIsDirty(true);
            setShowTimeInPicker(false);
            setShowTimeOutPicker(false);
        };

    const getInitialTime = (d?: Date): { h: number; m: number; p: "AM" | "PM" } => {
        if (!d) return { h: 12, m: 0, p: 'AM' };
        let h = d.getHours();
        const m = d.getMinutes();
        const p: "AM" | "PM" = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { h, m, p };
    };

    const mergeDateWithTime = (baseDate: Date, timeSource?: Date) => {
        const nextDate = new Date(baseDate);
        if (timeSource) {
            nextDate.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
        }
        return nextDate;
    };

    const fetchAttendanceForDate = useCallback(async (date: Date) => {
        if (!user?.id) return;

        try {
            const db = await getDB();
            const dateStr = format(date, 'yyyy-MM-dd');
            const rows: any[] = await db.getAllAsync(
                'SELECT * FROM attendance WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY clock_in ASC',
                [user.id, dateStr]
            );

            const completedRows = rows.filter((row) => row?.clock_in && row?.clock_out);
            setExistingAttendances(completedRows);

            if (completedRows.length > 0) {
                const firstIn = new Date(completedRows[0].clock_in);
                const lastOut = new Date(completedRows[completedRows.length - 1].clock_out);
                setTimeIn(mergeDateWithTime(date, firstIn));
                setTimeOut(mergeDateWithTime(date, lastOut));
                setAttendanceLocked(true);

                const windows = completedRows.map((row) => ({
                    start: mergeDateWithTime(date, new Date(row.clock_in)),
                    end: mergeDateWithTime(date, new Date(row.clock_out)),
                }));

                setActivityTime((prev) => {
                    const merged = mergeDateWithTime(date, prev);
                    return isWithinSessionWindows(merged, windows) ? merged : windows[0].start;
                });
            } else {
                setAttendanceLocked(false);
                setExistingAttendances([]);
                setTimeIn(undefined);
                setTimeOut(undefined);
            }
        } catch (e) {
            console.log(e);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        fetchAttendanceForDate(selectedDate);
    }, [fetchAttendanceForDate, selectedDate, user?.id]);

    // --- Image Handlers ---
    const handleImagePick = async (source: 'camera' | 'gallery') => {
        const remaining = MAX_PHOTOS - images.length;
        if (remaining <= 0) {
            setAlertConfig({ visible: true, type: 'warning', title: 'Limit Reached', message: `Max ${MAX_PHOTOS} images allowed.`, confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }
        try {
            let result: ImagePicker.ImagePickerResult; 
            if (source === 'camera') {
                await ImagePicker.requestCameraPermissionsAsync();
                result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    quality: 0.7,
                    allowsEditing: true,
                    aspect: [4, 3],
                });
            } else {
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.7,
                    allowsMultipleSelection: true,
                    orderedSelection: true,
                    selectionLimit: remaining,
                });
            }

            if (!result.canceled && result.assets) {
                const nextUris = result.assets.slice(0, remaining).map((asset) => asset.uri);
                setImages(prev => [...prev, ...nextUris]);
                setIsDirty(true);
            }
        } catch { 
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Could not capture image.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
        }
    };

    const confirmDeleteImage = (idx: number) => {
        setAlertConfig({
            visible: true, type: 'confirm', title: 'Remove Image', message: 'Remove this image?', confirmText: 'Remove', cancelText: 'Cancel',
            onConfirm: () => {
                setImages(p => p.filter((_, i) => i !== idx)); 
                setIsDirty(true);
                setAlertConfig({ visible: false });
            },
            onCancel: () => setAlertConfig({ visible: false })
        });
    };

    const getFriendlyAIErrorMessage = (rawError: string) => {
        const errLower = rawError.toLowerCase();

        if (
            errLower.includes('api key') ||
            errLower.includes('configured') ||
            errLower.includes('provider') ||
            errLower.includes('401')
        ) {
            return 'Your AI provider or API key is missing or invalid. Update Settings > API Keys.';
        }

        if (errLower.includes('quota') || errLower.includes('429') || errLower.includes('exhausted')) {
            return 'Your AI provider quota was reached. Please check billing or quota limits and try again.';
        }

        if (errLower.includes('network') || errLower.includes('fetch') || errLower.includes('timeout')) {
            return 'Network connection failed while generating the description. Please try again.';
        }

        return 'Failed to generate a task description right now.';
    };

    const openAISetupPrompt = () => {
        if (!aiReady) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'AI Setup Required',
                message: 'Add an OpenAI or Gemini API key first to use AI description generation.',
                confirmText: 'Open Settings',
                cancelText: 'Cancel',
                onConfirm: () => {
                    setAlertConfig({ visible: false });
                    router.push('/settings/apikey');
                },
                onCancel: () => setAlertConfig({ visible: false }),
            });
        }
    };

    const loadEntryAIContext = async () => {
        let jobTitle = '';
        let company = '';

        if (activeJobId) {
            const db = await getDB();
            const job: any = await db.getFirstAsync(
                'SELECT title, company FROM job_positions WHERE id = ? AND deleted_at IS NULL',
                [activeJobId]
            );
            jobTitle = job?.title || '';
            company = job?.company || '';
        }

        const primaryWindow = existingAttendances.length > 0
            ? existingAttendances.find((row) => row?.clock_in && row?.clock_out)
            : null;

        return {
            date: format(selectedDate, 'MMMM d, yyyy'),
            activityTime: format(activityTime, 'h:mm a'),
            currentDescription: description.trim(),
            remarks: remarks.trim(),
            jobTitle,
            company,
            timeIn: primaryWindow?.clock_in
                ? format(new Date(primaryWindow.clock_in), 'h:mm a')
                : (timeIn ? format(timeIn, 'h:mm a') : undefined),
            timeOut: primaryWindow?.clock_out
                ? format(new Date(primaryWindow.clock_out), 'h:mm a')
                : (timeOut ? format(timeOut, 'h:mm a') : undefined),
        };
    };

    const guessMimeTypeFromUri = (uri: string) => {
        const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
        if (extension === 'png') return 'image/png';
        if (extension === 'webp') return 'image/webp';
        if (extension === 'heic' || extension === 'heif') return 'image/heic';
        return 'image/jpeg';
    };

    const prepareImagesForAI = async (uris: string[]) => {
        const prepared = await Promise.all(
            uris.slice(0, MAX_PHOTOS).map(async (uri) => {
                try {
                    if (uri.startsWith('http')) {
                        const response = await fetch(uri);
                        if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
                        const contentType = response.headers.get('content-type')?.split(';')[0] || guessMimeTypeFromUri(uri);
                        const data = encodeArrayBuffer(await response.arrayBuffer());
                        return { data, mimeType: contentType };
                    }

                    const mimeType = guessMimeTypeFromUri(uri);
                    const data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                    return { data, mimeType };
                } catch {
                    return null;
                }
            })
        );

        return prepared.filter((item): item is { data: string; mimeType: string } => !!item);
    };

    const applyAIResult = (text: string, provider: AIProvider, actionLabel: string) => {
        setDescription(text);
        setAIProviderUsed(provider);
        setAILastAction(actionLabel);
        setErrors({ description: false });
        setIsDirty(true);
    };

    const runAIAction = async (
        busyMessage: string,
        actionLabel: string,
        worker: (context: Awaited<ReturnType<typeof loadEntryAIContext>>) => Promise<{ text: string; provider: AIProvider }>
    ) => {
        if (!aiReady) {
            openAISetupPrompt();
            return;
        }

        const canProceed = await requireOnlineFeature('ai_description', setAlertConfig);
        if (!canProceed) return;

        setAIMenuVisible(false);
        setAIBusyMessage(busyMessage);
        setAIGenerating(true);

        try {
            const context = await loadEntryAIContext();
            const result = await worker(context);
            applyAIResult(result.text, result.provider, actionLabel);
        } catch (e: any) {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'AI Generation Failed',
                message: getFriendlyAIErrorMessage(e?.message || 'unknown'),
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
        } finally {
            setAIGenerating(false);
            setAIBusyMessage('Working with AI...');
        }
    };

    const handleAIGenerateFromNotes = async () => {
        if (!description.trim() && !remarks.trim()) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Need More Context',
                message: 'Add a few notes in Task Description or Remarks first so AI has context to refine.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
            return;
        }

        await runAIAction(
            'Generating description...',
            'Generated from notes',
            async (context) => generateEntryDescriptionSuggestion(context)
        );
    };

    const handleAIGenerateFromPhotos = async () => {
        if (images.length === 0) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'No Photos Available',
                message: 'Attach one or more photos first so AI can describe the work from images.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
            return;
        }

        await runAIAction(
            'Analyzing attached photos...',
            'Generated from attached photos',
            async (context) => {
                const preparedImages = await prepareImagesForAI(images);
                if (preparedImages.length === 0) {
                    throw new Error('Image processing failed. Please try different photos.');
                }

                return generateEntryDescriptionFromPhotos({
                    ...context,
                    images: preparedImages,
                });
            }
        );
    };

    const handleAIRewrite = async (mode: EntryRewriteMode) => {
        if (!description.trim()) {
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'No Draft To Rewrite',
                message: 'Write a task description first, then use AI rewrite modes to refine it.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
            return;
        }

        const actionLabel = mode === 'shorter'
            ? 'Rewritten shorter'
            : mode === 'more_professional'
                ? 'Rewritten professionally'
                : 'Rewritten to highlight result';

        const busyMessage = mode === 'shorter'
            ? 'Shortening description...'
            : mode === 'more_professional'
                ? 'Polishing description...'
                : 'Highlighting result...';

        await runAIAction(
            busyMessage,
            actionLabel,
            async (context) => rewriteEntryDescriptionSuggestion({
                ...context,
                draft: description.trim(),
                mode,
            })
        );
    };

    const handleAIIconPress = () => {
        (async () => {
            const canProceed = await requireOnlineFeature('ai_description', setAlertConfig);
            if (!canProceed) return;

            if (!aiReady) {
                openAISetupPrompt();
                return;
            }

            setAIMenuVisible(true);
        })();
    };

    const handleCropImage = async (idx: number) => {
        try {
            await ImagePicker.requestMediaLibraryPermissionsAsync();
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                allowsEditing: true,
                aspect: [4, 3],
                allowsMultipleSelection: false,
                selectionLimit: 1,
            });

            if (!result.canceled && result.assets?.[0]?.uri) {
                const nextUri = result.assets[0].uri;
                setImages((prev) => prev.map((item, imageIdx) => (imageIdx === idx ? nextUri : item)));
                setIsDirty(true);
            }
        } catch {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Crop Failed',
                message: 'Could not update the image right now.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig({ visible: false }),
            });
        }
    };

    // --- Save Handler ---
    const saveEntry = async () => {
        const hasTimeIn = !!timeIn;
        const hasTimeOut = !!timeOut;
        const hasTask = !!description.trim();

        if (!hasTask) {
            setErrors({ description: true });
            setAlertConfig({ visible: true, type: 'warning', title: 'Missing Info', message: 'Please enter a task description.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }

        if (showAttendanceBool) {
            if (!hasTimeIn || !hasTimeOut) {
                setAlertConfig({ visible: true, type: 'warning', title: 'Missing Info', message: 'Please provide both Time In and Time Out.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
                return;
            }
        }

        if (!activeJobId || !user?.id) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'No active job or user found.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
            return;
        }

        setLoading(true);
        try {
            const db = await getDB();
            const dateStr = format(selectedDate, 'yyyy-MM-dd'); 
            const now = new Date().toISOString();
            const activityDoneAt = mergeDateWithTime(selectedDate, activityTime).toISOString();
            const activityDoneAtDate = new Date(activityDoneAt);
            const isToday = isSameDay(selectedDate, new Date());
            const attendanceWindows = existingAttendances.length > 0
                ? existingAttendances
                    .filter((row) => row?.clock_in && row?.clock_out)
                    .map((row) => ({
                        start: mergeDateWithTime(selectedDate, new Date(row.clock_in)),
                        end: mergeDateWithTime(selectedDate, new Date(row.clock_out)),
                    }))
                : (showAttendanceBool && timeIn && timeOut
                    ? [{ start: timeIn, end: timeOut }]
                    : []);

            if (isToday && activityDoneAtDate.getTime() > Date.now()) {
                setAlertConfig({
                    visible: true,
                    type: 'warning',
                    title: 'Invalid Activity Time',
                    message: 'Activity Time cannot be ahead of the current time for today.',
                    confirmText: 'Okay',
                    onConfirm: () => setAlertConfig({ visible: false }),
                });
                setLoading(false);
                return;
            }

            if (attendanceWindows.length > 0 && !isWithinSessionWindows(activityDoneAtDate, attendanceWindows)) {
                setAlertConfig({
                    visible: true,
                    type: 'warning',
                    title: 'Invalid Activity Time',
                    message: 'Activity Time must be within the attendance session for the selected date.',
                    confirmText: 'Okay',
                    onConfirm: () => setAlertConfig({ visible: false }),
                });
                setLoading(false);
                return;
            }

            // 1. Create Attendance (If applicable)
            if (showAttendanceBool && !attendanceLocked && timeIn && timeOut) {
                const cIn = new Date(selectedDate);
                cIn.setHours(timeIn.getHours(), timeIn.getMinutes(), 0, 0);

                const cOut = new Date(selectedDate);
                cOut.setHours(timeOut.getHours(), timeOut.getMinutes(), 0, 0);

                if (cOut < cIn) {
                    setAlertConfig({ visible: true, type: 'warning', title: 'Invalid Time', message: 'Time Out cannot be earlier than Time In on the same day.', confirmText: 'OK', onConfirm: () => setAlertConfig({ visible: false }) });
                    setLoading(false);
                    return;
                }

                const newAttId = generateUUID();
                const attRemarks = remarks.trim() ? `Manual Entry: ${remarks.trim()}` : 'Manual Entry';

                const newRecord = { 
                    id: newAttId, user_id: user.id, job_id: activeJobId, date: dateStr, 
                    clock_in: cIn.toISOString(), clock_out: cOut.toISOString(),
                    status: 'completed', remarks: attRemarks, updated_at: now 
                };

                await db.runAsync(
                    'INSERT INTO attendance (id, user_id, job_id, date, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
                    [newRecord.id, newRecord.user_id, newRecord.job_id, newRecord.date, newRecord.clock_in, newRecord.clock_out, newRecord.status, newRecord.remarks, newRecord.updated_at]
                );
                await queueSyncItem('attendance', newAttId, 'INSERT', newRecord);
            }

            // 2. Create/Update Task
            const processedImages = await Promise.all(images.map(async (uri) => {
                if (uri.startsWith('http') || !FileSystem.documentDirectory) return uri;
                const filename = uri.split('/').pop();
                const newPath = FileSystem.documentDirectory + filename;
                try { await FileSystem.copyAsync({ from: uri, to: newPath }); return newPath; } catch { return uri; }
            }));
            const imagesJson = JSON.stringify(processedImages);

            if (entryId) {
                const payload = { id: entryId, user_id: user.id, job_id: activeJobId, description: description.trim(), remarks: remarks.trim(), image_url: imagesJson, date: dateStr, created_at: activityDoneAt, updated_at: now };
                await db.runAsync('UPDATE accomplishments SET description = ?, remarks = ?, image_url = ?, date = ?, created_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [payload.description, payload.remarks, payload.image_url, payload.date, payload.created_at, payload.updated_at, entryId]);
                await queueSyncItem('accomplishments', entryId, 'UPDATE', payload);
            } else {
                const newId = generateUUID();
                const newRecord = { id: newId, user_id: user.id, job_id: activeJobId, date: dateStr, description: description.trim(), remarks: remarks.trim(), image_url: imagesJson, created_at: activityDoneAt, updated_at: now };
                await db.runAsync('INSERT INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)', [newRecord.id, newRecord.user_id, newRecord.job_id, newRecord.date, newRecord.description, newRecord.remarks, newRecord.image_url, newRecord.created_at, newRecord.updated_at]);
                await queueSyncItem('accomplishments', newId, 'INSERT', newRecord);
            }

            setIsDirty(false);
            triggerSync(); 
            await refreshWidgetSnapshot(user.id, { force: true });
            router.back(); 
        } catch (e: any) { 
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message || 'An error occurred.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
        } finally { setLoading(false); }
    };

    const timeInVals = getInitialTime(timeIn);
    const timeOutVals = getInitialTime(timeOut);
    const activityTimeVals = getInitialTime(activityTime);
    const attendanceMinutes = existingAttendances.length > 0
        ? summarizeAttendances(existingAttendances, 'exact_hm').totalMinutes
        : (timeIn && timeOut ? Math.max(0, Math.floor((timeOut.getTime() - timeIn.getTime()) / 60000)) : 0);
    const activityWindows = existingAttendances.length > 0
        ? existingAttendances
            .filter((row) => row?.clock_in && row?.clock_out)
            .map((row) => ({
                start: mergeDateWithTime(selectedDate, new Date(row.clock_in)),
                end: mergeDateWithTime(selectedDate, new Date(row.clock_out)),
            }))
        : (timeIn && timeOut ? [{ start: timeIn, end: timeOut }] : []);
    const isActivityTimeValid = activityWindows.length > 0 ? isWithinSessionWindows(activityTime, activityWindows) : true;
    const isActivityTimeInFuture = isSameDay(selectedDate, new Date()) && activityTime.getTime() > Date.now();
    const activityTimeErrorMessage = isActivityTimeInFuture
        ? 'Activity Time cannot be ahead of the current time for today.'
        : !isActivityTimeValid
            ? 'Activity Time must be within the attendance session of the selected date.'
            : null;
    
    const isReadyToSave = isDirty && isActivityTimeValid && !isActivityTimeInFuture && ((showAttendanceBool && timeIn && timeOut && description.trim()) || (!showAttendanceBool && description.trim()));
    const aiMenuActions = [
        {
            label: 'Generate From Notes',
            icon: SparklesIcon,
            color: theme.colors.primary,
            onPress: handleAIGenerateFromNotes,
        },
        ...(images.length > 0 ? [{
            label: 'Describe Attached Photos',
            icon: Image01Icon,
            color: theme.colors.success,
            onPress: handleAIGenerateFromPhotos,
        }] : []),
        { isDivider: true },
        {
            label: 'Rewrite Shorter',
            icon: ArrowDown01Icon,
            color: theme.colors.warning,
            onPress: () => handleAIRewrite('shorter'),
        },
        {
            label: 'More Professional',
            icon: PencilEdit02Icon,
            color: theme.colors.primary,
            onPress: () => handleAIRewrite('more_professional'),
        },
        {
            label: 'Highlight Result',
            icon: CheckListIcon,
            color: theme.colors.accent,
            onPress: () => handleAIRewrite('highlight_result'),
        },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <ModernAlert {...alertConfig} />
            <ActionMenu visible={aiMenuVisible} onClose={() => setAIMenuVisible(false)} actions={aiMenuActions} />
            <LoadingOverlay visible={loading || aiGenerating} message={aiGenerating ? aiBusyMessage : "Saving entry..."} />
            
            <DatePicker visible={showDatePicker} onClose={() => setShowDatePicker(false)} onSelect={(date) => { setSelectedDate(date); setActivityTime(prev => mergeDateWithTime(date, prev)); setTimeIn(prev => prev ? mergeDateWithTime(date, prev) : prev); setTimeOut(prev => prev ? mergeDateWithTime(date, prev) : prev); setIsDirty(true); setShowDatePicker(false); }} selectedDate={selectedDate} title="Select Entry Date" />
            
            <TimePicker visible={showActivityTimePicker} onClose={() => setShowActivityTimePicker(false)} onConfirm={handleTimeConfirm(setActivityTime as any)} title="Select Activity Time" initialHours={activityTimeVals.h} initialMinutes={activityTimeVals.m} initialPeriod={activityTimeVals.p} />
            <TimePicker visible={showTimeInPicker} onClose={() => setShowTimeInPicker(false)} onConfirm={handleTimeConfirm(setTimeIn)} title="Select Time In" initialHours={timeInVals.h} initialMinutes={timeInVals.m} initialPeriod={timeInVals.p} />
            <TimePicker visible={showTimeOutPicker} onClose={() => setShowTimeOutPicker(false)} onConfirm={handleTimeConfirm(setTimeOut)} title="Select Time Out" initialHours={timeOutVals.h} initialMinutes={timeOutVals.m} initialPeriod={timeOutVals.p} />

            <Header title={entryId ? 'Edit Entry' : 'Add Entry'} />

            {initialLoading ? (
                <LoadingScreen message={entryId ? 'Loading entry details...' : 'Preparing entry form...'} />
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        
                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                Date <Text style={{ color: '#ef4444' }}>*</Text>
                            </Text>
                            <View style={{ position: 'relative' }}>
                                <TouchableOpacity disabled={!canEditDate} activeOpacity={canEditDate ? 0.7 : 1} onPress={() => setShowDatePicker(true)}>
                                    <View style={{ 
                                        flexDirection: 'row', alignItems: 'center', 
                                        backgroundColor: canEditDate ? theme.colors.card : theme.colors.background, 
                                        borderRadius: 16, borderWidth: 1, 
                                        borderColor: theme.colors.border,
                                        height: 56, paddingHorizontal: 16 
                                    }}>
                                        <HugeiconsIcon icon={Calendar03Icon} size={22} color={canEditDate ? theme.colors.primary : theme.colors.textSecondary} />
                                        
                                        <Text numberOfLines={1} style={{ flex: 1, marginLeft: 12, fontSize: 15, fontFamily: 'Nunito_500Medium', color: theme.colors.text }}>
                                            {format(selectedDate, 'MMMM d, yyyy')}
                                        </Text>
                                        
                                        {canEditDate && <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.icon} />}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                Activity Time <Text style={{ color: '#ef4444' }}>*</Text>
                            </Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => setShowActivityTimePicker(true)}>
                                <View style={[styles.inlinePicker, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <View style={styles.inlinePickerLeft}>
                                        <HugeiconsIcon icon={Time02Icon} size={20} color={theme.colors.primary} />
                                        <Text style={[styles.inlinePickerValue, { color: theme.colors.text }]}>{format(activityTime, 'h:mm a')}</Text>
                                    </View>
                                    <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.primary} />
                                </View>
                            </TouchableOpacity>
                            {activityTimeErrorMessage ? (
                                <Text style={[styles.helperText, { color: theme.colors.danger }]}>
                                    {activityTimeErrorMessage}
                                </Text>
                            ) : null}
                        </View>

                        {showAttendanceBool && (
                            <View style={styles.inputBlock}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Attendance Record</Text>
                                <View style={[styles.sessionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <View style={styles.sessionCardBody}>
                                        <TouchableOpacity
                                            activeOpacity={attendanceLocked ? 1 : 0.7}
                                            disabled={attendanceLocked}
                                            onPress={() => setShowTimeInPicker(true)}
                                            style={styles.sessionTimeCol}
                                        >
                                            <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME IN <Text style={{color: '#ef4444'}}>*</Text></Text>
                                            <View style={styles.sessionValueRow}>
                                                <Text style={[styles.sessionTimeValue, { color: timeIn ? theme.colors.text : theme.colors.textSecondary }]}>
                                                    {timeIn ? format(timeIn, 'h:mm a') : '--:--'}
                                                </Text>
                                                {!attendanceLocked ? <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} /> : null}
                                            </View>
                                        </TouchableOpacity>
                                        
                                        <View style={[styles.sessionCardDivider, { backgroundColor: theme.colors.border }]} />
                                        
                                        <TouchableOpacity
                                            activeOpacity={attendanceLocked ? 1 : 0.7}
                                            disabled={attendanceLocked}
                                            onPress={() => setShowTimeOutPicker(true)}
                                            style={styles.sessionTimeCol}
                                        >
                                            <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME OUT <Text style={{color: '#ef4444'}}>*</Text></Text>
                                            <View style={styles.sessionValueRow}>
                                                <Text style={[styles.sessionTimeValue, { color: timeOut ? theme.colors.text : theme.colors.textSecondary }]}>
                                                    {timeOut ? format(timeOut, 'h:mm a') : '--:--'}
                                                </Text>
                                                {!attendanceLocked ? <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} /> : null}
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={[styles.sessionHoursBar, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                                        <Text style={[styles.sessionHoursLabel, { color: theme.colors.textSecondary }]}>TOTAL HOURS</Text>
                                        <Text style={[styles.sessionHoursValue, { color: theme.colors.text }]}>{formatMinutesAsHours(attendanceMinutes)}</Text>
                                    </View>
                                </View>
                                {attendanceLocked ? (
                                    <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                                        Attendance record is locked for this date.
                                    </Text>
                                ) : null}
                            </View>
                        )}

                        <View style={styles.inputBlock}>
                            <View style={styles.labelRow}>
                                <Text style={[styles.label, { color: theme.colors.textSecondary, marginBottom: 0 }]}>
                                    Task Description <Text style={{color: '#ef4444'}}>*</Text>
                                </Text>
                                <IconButton
                                    icon={aiReady ? SparklesIcon : Key01Icon}
                                    onPress={handleAIIconPress}
                                    backgroundColor={aiReady ? theme.colors.primary + '12' : theme.colors.card}
                                    borderColor={aiReady ? theme.colors.primary + '24' : theme.colors.border}
                                    color={aiReady ? theme.colors.primary : theme.colors.textSecondary}
                                    size={16}
                                    style={styles.aiIconButton}
                                />
                            </View>
                            <View style={[styles.inputWrapper, { borderColor: errors.description ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <TextInput style={[styles.textInput, { color: theme.colors.text }]} placeholder="What did you accomplish?" placeholderTextColor={theme.colors.textSecondary} value={description} onChangeText={(t) => { setDescription(t); setIsDirty(true); setErrors({description: false}); }} maxLength={255} />
                            </View>
                            {aiProviderUsed && aiLastAction ? (
                                <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
                                    Last AI action: {aiLastAction} via {aiProviderUsed === 'openai' ? 'OpenAI' : 'Gemini'}.
                                </Text>
                            ) : null}
                        </View>

                        <View style={styles.inputBlock}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Remarks (Optional)</Text>
                            <View style={[styles.inputWrapper, styles.textAreaWrapper, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <TextInput style={[styles.textInput, styles.textArea, { color: theme.colors.text }]} placeholder="Add any additional details or notes..." placeholderTextColor={theme.colors.textSecondary} value={remarks} onChangeText={(t) => { setRemarks(t); setIsDirty(true); }} multiline textAlignVertical="top" />
                            </View>
                        </View>

                        <View style={styles.inputBlock}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={[styles.label, { marginBottom: 0, color: theme.colors.textSecondary }]}>Attachments</Text>
                                <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary }}>{images.length} / {MAX_PHOTOS}</Text>
                            </View>

                            {images.length < MAX_PHOTOS && (
                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: images.length > 0 ? 16 : 0 }}>
                                    <TouchableOpacity onPress={() => handleImagePick('camera')} style={[styles.uploadBtnRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                        <HugeiconsIcon icon={Camera01Icon} size={18} color={theme.colors.primary} />
                                        <Text style={[styles.uploadBtnText, { color: theme.colors.text }]}>Camera</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleImagePick('gallery')} style={[styles.uploadBtnRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                        <HugeiconsIcon icon={Image01Icon} size={18} color={theme.colors.primary} />
                                        <Text style={[styles.uploadBtnText, { color: theme.colors.text }]}>Gallery</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {images.length > 0 && (
                                <View style={{ gap: 16 }}>
                                    {images.map((uri, idx) => (
                                        <View key={idx} style={[styles.imagePreviewWrapper, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                            <Image source={{ uri }} style={styles.imagePreview} resizeMode="cover" />
                                            <View style={styles.imageActionRow}>
                                                <TouchableOpacity onPress={() => handleCropImage(idx)} style={styles.imageActionBtn} activeOpacity={0.8}>
                                                    <HugeiconsIcon icon={PencilEdit02Icon} size={18} color="#ffffff" />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => confirmDeleteImage(idx)} style={styles.imageActionBtn} activeOpacity={0.8}>
                                                    <HugeiconsIcon icon={Delete02Icon} size={18} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                    <Text style={[styles.helperText, { color: theme.colors.textSecondary, marginTop: -4 }]}>
                                        AI can use your attached photos to draft the task description.
                                    </Text>
                                </View>
                            )}
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            )}
            
            {isDirty && (
                <Footer>
                    <Button title={entryId ? 'Update Entry' : 'Save Entry'} onPress={saveEntry} isLoading={loading} disabled={loading || !isReadyToSave} style={{ width: '100%' }} />
                </Footer>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 100 },
    inputBlock: { marginBottom: 24 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
    label: { fontSize: 11, fontFamily: 'Nunito_500Medium', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
    aiIconButton: { width: 38, height: 38, borderRadius: 19 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 56 },
    textInput: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 15, paddingVertical: 16 },
    textAreaWrapper: { alignItems: 'flex-start', minHeight: 120 },
    textArea: { height: 100, paddingTop: 16 },
    uploadBtnRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
    uploadBtnText: { marginLeft: 8, fontFamily: 'Nunito_500Medium', fontSize: 13 },
    inlinePicker: { minHeight: 56, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    inlinePickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    inlinePickerValue: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
    helperText: { marginTop: 8, marginLeft: 4, fontSize: 12, fontFamily: 'Nunito_500Medium', lineHeight: 18 },
    imagePreviewWrapper: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, borderWidth: 1, overflow: 'hidden', position: 'relative' },
    imagePreview: { width: '100%', height: '100%' },
    imageActionRow: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 },
    imageActionBtn: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },

    sessionCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    sessionCardBody: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    sessionTimeCol: { flex: 1 },
    sessionTimeLabel: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
    sessionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sessionTimeValue: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },
    sessionCardDivider: { width: 1, height: 32, marginHorizontal: 16, opacity: 0.5 },
    sessionHoursBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sessionHoursLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
    sessionHoursValue: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold' },
});
