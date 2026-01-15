import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';
import Button from './Button';
import ModalHeader from './ModalHeader';

interface DurationPickerProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (hours: number, minutes: number) => void;
    initialHours?: number;
    initialMinutes?: number;
}

export default function DurationPicker({ visible, onClose, onConfirm, initialHours = 0, initialMinutes = 0 }: DurationPickerProps) {
    const theme = useAppTheme();
    const [durHours, setDurHours] = useState(initialHours);
    const [durMins, setDurMins] = useState(initialMinutes);

    useEffect(() => {
        if (visible) {
            setDurHours(initialHours);
            setDurMins(initialMinutes);
        }
    }, [visible, initialHours, initialMinutes]);

    const Counter = ({ val, setVal, max, label }: any) => (
        <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: theme.colors.background, padding: 8, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border }}>
                <TouchableOpacity onPress={() => setVal(Math.max(0, val - 1))} style={[styles.roundBtn, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.btnText, { color: theme.colors.text }]}>-</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 32, fontWeight: '800', color: theme.colors.text, width: 50, textAlign: 'center' }}>{val.toString().padStart(2,'0')}</Text>
                <TouchableOpacity onPress={() => setVal(Math.min(max, val + 1))} style={[styles.roundBtn, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.btnText, { color: theme.colors.text }]}>+</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.container, { backgroundColor: theme.colors.card }]} onPress={e => e.stopPropagation()}>
                    
                    {/* Center Modal: No Close Button */}
                    <ModalHeader title="Set Duration" />

                    <View style={styles.content}>
                        <View style={{ gap: 40, alignItems: 'center' }}>
                            <Counter val={durHours} setVal={setDurHours} max={23} label="Hours" />
                            <Counter val={durMins} setVal={setDurMins} max={59} label="Minutes" />
                        </View>
                    </View>

                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <Button title="Cancel" variant="neutral" onPress={onClose} style={{ flex: 1 }} />
                        <View style={{ width: 12 }} />
                        <Button title="Confirm" variant="primary" onPress={() => { onConfirm(durHours, durMins); onClose(); }} style={{ flex: 1 }} />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    container: { width: 340, borderRadius: 28, overflow: 'hidden', elevation: 10 },
    content: { paddingVertical: 40, alignItems: 'center' },
    roundBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    btnText: { fontSize: 24, fontWeight: '600' },
    footer: { padding: 16, borderTopWidth: 1, flexDirection: 'row' },
});