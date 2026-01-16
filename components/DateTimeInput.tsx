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
                style={({ pressed }) => [
                    styles.input, 
                    { 
                        backgroundColor: theme.colors.background, 
                        borderColor: theme.colors.border,
                        opacity: pressed ? 0.7 : 1
                    }
                ]}
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
                    onConfirm={(h, m, p) => {
                        const newDate = new Date(value);
                        let hours = h;
                        if (p === 'PM' && h < 12) hours += 12;
                        if (p === 'AM' && h === 12) hours = 0;
                        newDate.setHours(hours);
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
    label: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16 },
    value: { marginLeft: 12, fontSize: 16, fontWeight: '500' }
});