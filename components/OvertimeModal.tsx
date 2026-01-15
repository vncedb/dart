import { Briefcase01Icon, Clock01Icon, HourglassIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from './Button';
import DurationPicker from './DurationPicker';
import TimePicker from './TimePicker';

interface OvertimeModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (hours: number) => void;
    theme: any;
}

export default function OvertimeModal({ visible, onClose, onConfirm, theme }: OvertimeModalProps) {
    const [mode, setMode] = useState<'duration' | 'time'>('duration');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [endTime, setEndTime] = useState<Date>(new Date());

    const getFinalDuration = () => mode === 'duration' ? hours + (minutes / 60) : Math.max(0, (endTime.getTime() - new Date().getTime()) / 3600000);
    
    const openPicker = () => mode === 'duration' ? setShowDurationPicker(true) : setShowTimePicker(true);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.container, { backgroundColor: theme.colors.card }]} onPress={e => e.stopPropagation()}>
                    
                    {/* Centered Icon Header */}
                    <View style={{ alignItems: 'center', marginBottom: 20, paddingTop: 10 }}>
                        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.warning + '15' }]}>
                            <HugeiconsIcon icon={Briefcase01Icon} size={32} color={theme.colors.warning} />
                        </View>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Overtime Detected</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Checking in outside standard shift?</Text>
                    </View>

                    <View style={{ paddingHorizontal: 4 }}>
                        <View style={[styles.toggleContainer, { backgroundColor: theme.colors.background }]}>
                            {['duration', 'time'].map(m => (
                                <TouchableOpacity key={m} onPress={() => setMode(m as any)} style={[styles.toggleBtn, mode === m && [styles.activeToggle, { backgroundColor: theme.colors.card }]]}>
                                    <Text style={[styles.toggleText, { color: mode === m ? theme.colors.primary : theme.colors.textSecondary }]}>{m === 'duration' ? 'Duration' : 'End Time'}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity onPress={openPicker} activeOpacity={0.8} style={[styles.inputBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                            <View style={[styles.inputIconBox, { backgroundColor: theme.colors.card }]}>
                                <HugeiconsIcon icon={mode === 'duration' ? HourglassIcon : Clock01Icon} size={22} color={theme.colors.text} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>{mode === 'duration' ? 'Add Duration' : 'Ends At'}</Text>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>
                                    {mode === 'duration' ? `${hours} hr ${minutes} min` : endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
                        <View style={{ width: 12 }} />
                        <Button title="Confirm" variant="primary" onPress={() => onConfirm(getFinalDuration())} disabled={getFinalDuration() <= 0} style={{ flex: 1 }} />
                    </View>
                </Pressable>

                <TimePicker 
                    visible={showTimePicker} 
                    onClose={() => setShowTimePicker(false)} 
                    onConfirm={setEndTime} 
                    initialValue={endTime}
                    title="Set Check Out Time"
                />
                
                <DurationPicker 
                    visible={showDurationPicker} 
                    onClose={() => setShowDurationPicker(false)} 
                    onConfirm={(h, m) => { setHours(h); setMinutes(m); }} 
                    initialHours={hours}
                    initialMinutes={minutes}
                />
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.6)' },
    container: { width: 340, borderRadius: 24, padding: 20, overflow: 'hidden', elevation: 10 },
    iconWrapper: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, textAlign: 'center' },
    toggleContainer: { flexDirection: 'row', borderRadius: 14, padding: 4, height: 48, marginBottom: 16 },
    toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
    activeToggle: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
    toggleText: { fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
    inputBtn: { width: '100%', height: 72, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1 },
    inputIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    footer: { flexDirection: 'row', marginTop: 24, paddingTop: 20, borderTopWidth: 1 }
});