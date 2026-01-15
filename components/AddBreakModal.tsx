import {
    ArrowRight01Icon,
    Coffee01Icon,
    PencilEdit02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';
import Button from './Button';
import TimePicker from './TimePicker';

interface AddBreakModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (breakItem: { start: Date; end: Date; title: string }) => void;
}

const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

export default function AddBreakModal({ visible, onClose, onAdd }: AddBreakModalProps) {
    const theme = useAppTheme();
    
    const [start, setStart] = useState(new Date(new Date().setHours(12, 0, 0, 0)));
    const [end, setEnd] = useState(new Date(new Date().setHours(13, 0, 0, 0)));
    const [title, setTitle] = useState('');
    
    const [pickerVisible, setPickerVisible] = useState(false);
    const [activePicker, setActivePicker] = useState<'start' | 'end'>('start');

    useEffect(() => {
        if (visible) {
            setStart(new Date(new Date().setHours(12, 0, 0, 0)));
            setEnd(new Date(new Date().setHours(13, 0, 0, 0)));
            setTitle('');
        }
    }, [visible]);

    const handleTimeConfirm = (h: number, m: number, p?: 'AM' | 'PM') => {
        let hours = h;
        if (p === 'PM' && hours !== 12) hours += 12;
        if (p === 'AM' && hours === 12) hours = 0;

        const newDate = new Date();
        newDate.setHours(hours);
        newDate.setMinutes(m);
        newDate.setSeconds(0);

        if (activePicker === 'start') setStart(newDate);
        else setEnd(newDate);
    };

    const openPicker = (mode: 'start' | 'end') => {
        setActivePicker(mode);
        setPickerVisible(true);
    };

    const handleConfirm = () => {
        onAdd({ start, end, title: title.trim() || 'Break' });
        onClose();
    };

    const getDuration = () => {
        const startMins = start.getHours() * 60 + start.getMinutes();
        const endMins = end.getHours() * 60 + end.getMinutes();
        let diff = endMins - startMins;
        if (diff < 0) diff += 24 * 60;
        
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        
        if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
        if (hrs > 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
        return `${mins} min`;
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={styles.overlay}
            >
                <Animated.View 
                    entering={FadeIn.duration(200)} 
                    exiting={FadeOut.duration(200)} 
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable style={styles.backdrop} onPress={onClose} />
                </Animated.View>

                <Animated.View 
                    entering={ZoomIn.duration(250).springify()} 
                    exiting={ZoomOut.duration(200)}
                    style={[styles.container, { backgroundColor: theme.colors.card }]}
                >
                    {/* Centered Header */}
                    <View style={styles.header}>
                        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
                            <HugeiconsIcon icon={Coffee01Icon} size={32} color={theme.colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Add Break</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            Duration: <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{getDuration()}</Text>
                        </Text>
                    </View>

                    {/* Time Inputs */}
                    <View style={styles.row}>
                        <TouchableOpacity 
                            onPress={() => openPicker('start')}
                            style={[styles.timeBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                        >
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>START</Text>
                            <Text style={[styles.timeText, { color: theme.colors.text }]}>{formatTime(start)}</Text>
                        </TouchableOpacity>

                        <View style={{ paddingHorizontal: 8 }}>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.border} />
                        </View>

                        <TouchableOpacity 
                            onPress={() => openPicker('end')}
                            style={[styles.timeBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                        >
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>END</Text>
                            <Text style={[styles.timeText, { color: theme.colors.text }]}>{formatTime(end)}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Title Input */}
                    <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                        <View style={[styles.inputIcon, { backgroundColor: theme.colors.card }]}>
                            <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.textSecondary} />
                        </View>
                        <TextInput
                            placeholder="Break Name (Optional)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={title}
                            onChangeText={setTitle}
                            style={[styles.input, { color: theme.colors.text }]}
                        />
                    </View>

                    {/* Footer */}
                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <Button 
                            title="Cancel" 
                            variant="ghost" 
                            onPress={onClose} 
                            style={{ flex: 1 }} 
                        />
                        <View style={{ width: 12 }} />
                        <Button 
                            title="Add Break" 
                            variant="primary" 
                            onPress={handleConfirm} 
                            style={{ flex: 1 }} 
                        />
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>

            <TimePicker 
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onConfirm={handleTimeConfirm}
                initialHours={activePicker === 'start' ? start.getHours() : end.getHours()}
                initialMinutes={activePicker === 'start' ? start.getMinutes() : end.getMinutes()}
                title={activePicker === 'start' ? "Break Start" : "Break End"}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 24,
        zIndex: 1000
    },
    backdrop: { 
        ...StyleSheet.absoluteFillObject, 
        backgroundColor: 'rgba(0,0,0,0.6)' 
    },
    container: { 
        width: '100%', 
        maxWidth: 360, 
        borderRadius: 28, 
        padding: 24, 
        overflow: 'hidden', 
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    header: { 
        alignItems: 'center', 
        marginBottom: 24 
    },
    iconWrapper: { 
        width: 64, 
        height: 64, 
        borderRadius: 32, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 16 
    },
    title: { 
        fontSize: 20, 
        fontWeight: '800', 
        letterSpacing: -0.5, 
        marginBottom: 4 
    },
    subtitle: { 
        fontSize: 14, 
        fontWeight: '500' 
    },
    row: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 16 
    },
    timeBox: { 
        flex: 1, 
        paddingVertical: 14, 
        borderRadius: 16, 
        borderWidth: 1, 
        alignItems: 'center' 
    },
    label: { 
        fontSize: 10, 
        fontWeight: '800', 
        opacity: 0.6, 
        marginBottom: 2, 
        letterSpacing: 0.5 
    },
    timeText: { 
        fontSize: 17, 
        fontWeight: '700' 
    },
    inputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 6, 
        height: 56, 
        borderRadius: 16, 
        borderWidth: 1, 
        marginBottom: 8 
    },
    inputIcon: { 
        width: 40, 
        height: 40, 
        borderRadius: 12, 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginRight: 10 
    },
    input: { 
        flex: 1, 
        fontSize: 15, 
        fontWeight: '600' 
    },
    footer: { 
        flexDirection: 'row', 
        marginTop: 24, 
        paddingTop: 20, 
        borderTopWidth: 1 
    }
});