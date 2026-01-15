import { Calendar03Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../constants/theme';
import DatePicker from './DatePicker';
import TimePicker from './TimePicker';

interface DateTimeInputProps {
    type: 'date' | 'time';
    label: string;
    value: Date;
    onChange: (date: Date) => void;
}

export default function DateTimeInput({ type, label, value, onChange }: DateTimeInputProps) {
    const theme = useAppTheme();
    const [visible, setVisible] = useState(false);

    const displayValue = type === 'date' 
        ? value.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
            
            <Pressable 
                onPress={() => setVisible(true)} 
                style={[styles.input, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
                <HugeiconsIcon 
                    icon={type === 'date' ? Calendar03Icon : Clock01Icon} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                />
                <Text style={[styles.value, { color: theme.colors.text }]}>{displayValue}</Text>
            </Pressable>

            {type === 'date' ? (
                <DatePicker 
                    visible={visible}
                    onClose={() => setVisible(false)}
                    onSelect={(d) => { onChange(d); setVisible(false); }}
                    selectedDate={value}
                    title={label}
                />
            ) : (
                <TimePicker 
                    visible={visible}
                    onClose={() => setVisible(false)}
                    onConfirm={(h, m) => {
                        const newDate = new Date(value);
                        newDate.setHours(h);
                        newDate.setMinutes(m);
                        onChange(newDate);
                    }}
                    initialHours={value.getHours()}
                    initialMinutes={value.getMinutes()}
                    title={label}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginBottom: 16 },
    label: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16 },
    value: { marginLeft: 12, fontSize: 16, fontWeight: '600' }
});