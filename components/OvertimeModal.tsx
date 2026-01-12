import {
    Briefcase01Icon,
    Clock01Icon,
    HourglassIcon,
    Login03Icon,
    PencilEdit02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Button from './Button';
import TimePickerModal from './TimePickerModal';

interface OvertimeModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (hours: number) => void;
    theme: any;
}

export default function OvertimeModal({ visible, onClose, onConfirm, theme }: OvertimeModalProps) {
    const [mode, setMode] = useState<'duration' | 'time'>('duration');
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    
    const [endH, setEndH] = useState(new Date().getHours());
    const [endM, setEndM] = useState(new Date().getMinutes());
    const [endPeriod, setEndPeriod] = useState<'AM'|'PM'>(new Date().getHours() >= 12 ? 'PM' : 'AM');
    
    const [showPicker, setShowPicker] = useState(false);

    const calculateDuration = () => {
        if (mode === 'duration') return { h: hours, m: minutes };
        
        const now = new Date();
        const startMins = now.getHours() * 60 + now.getMinutes();
        
        let targetH = endH;
        if (endPeriod === 'PM' && targetH !== 12) targetH += 12;
        if (endPeriod === 'AM' && targetH === 12) targetH = 0;
        
        const targetTotalMins = targetH * 60 + endM;
        let diff = targetTotalMins - startMins;
        
        if (diff < 0) diff += 24 * 60; 
        
        return { h: Math.floor(diff / 60), m: diff % 60 };
    };

    const finalDuration = calculateDuration();
    const isValid = finalDuration.h > 0 || finalDuration.m > 0;

    if (!visible) return null;

    return (
        <Modal 
            transparent 
            visible={visible} 
            animationType="fade" 
            onRequestClose={onClose} 
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.backdrop} />
                
                <View style={[styles.container, { backgroundColor: theme.colors.card }]}>
                    {/* Header Icon */}
                    <View style={[styles.iconWrapper, { backgroundColor: theme.colors.warning + '15' }]}>
                        <HugeiconsIcon icon={Briefcase01Icon} size={32} color={theme.colors.warning} />
                    </View>

                    {/* Text Content */}
                    <View style={styles.textContainer}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Overtime Detected</Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            You are checking in outside your standard shift. Please verify the details.
                        </Text>
                    </View>

                    {/* Toggle Mode */}
                    <View style={[styles.toggleContainer, { backgroundColor: theme.colors.background }]}>
                        <TouchableOpacity 
                            onPress={() => setMode('duration')}
                            style={[
                                styles.toggleBtn, 
                                mode === 'duration' && styles.activeToggle, 
                                mode === 'duration' && { backgroundColor: theme.colors.card }
                            ]}
                        >
                            <Text style={[
                                styles.toggleText, 
                                { color: mode === 'duration' ? theme.colors.primary : theme.colors.textSecondary }
                            ]}>
                                Duration
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => setMode('time')}
                            style={[
                                styles.toggleBtn, 
                                mode === 'time' && styles.activeToggle, 
                                mode === 'time' && { backgroundColor: theme.colors.card }
                            ]}
                        >
                            <Text style={[
                                styles.toggleText, 
                                { color: mode === 'time' ? theme.colors.primary : theme.colors.textSecondary }
                            ]}>
                                End Time
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Input Button */}
                    <TouchableOpacity 
                        onPress={() => setShowPicker(true)}
                        activeOpacity={0.8}
                        style={[
                            styles.inputBtn, 
                            { 
                                backgroundColor: theme.colors.background, 
                                borderColor: isValid ? theme.colors.border : theme.colors.danger,
                                borderWidth: 1
                            }
                        ]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                            <View style={[styles.inputIconBox, { backgroundColor: theme.colors.card }]}>
                                <HugeiconsIcon icon={mode === 'duration' ? HourglassIcon : Clock01Icon} size={22} color={theme.colors.text} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 }}>
                                    {mode === 'duration' ? 'Duration Set To' : 'Checking Out At'}
                                </Text>
                                {mode === 'duration' ? (
                                    <Text style={{ fontSize: 17, fontWeight: '800', color: theme.colors.text }}>
                                        {hours} <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary }}>hrs</Text> {minutes} <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary }}>mins</Text>
                                    </Text>
                                ) : (
                                    <Text style={{ fontSize: 17, fontWeight: '800', color: theme.colors.text }}>
                                        {endH}:{endM.toString().padStart(2, '0')} <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary }}>{endPeriod}</Text>
                                    </Text>
                                )}
                            </View>
                        </View>
                        <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={theme.colors.primary} />
                    </TouchableOpacity>

                    {/* Action Buttons (Matched with TimePickerModal style) */}
                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <View style={{ flex: 1 }}>
                            <Button 
                                title="Cancel" 
                                variant="ghost" 
                                onPress={onClose} 
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Button 
                                title="Confirm"
                                variant="primary"
                                onPress={() => onConfirm(finalDuration.h + (finalDuration.m / 60))} 
                                disabled={!isValid}
                                icon={Login03Icon}
                            />
                        </View>
                    </View>
                </View>

                {/* Reusing the refined TimePickerModal */}
                <TimePickerModal 
                    visible={showPicker}
                    mode={mode}
                    onClose={() => setShowPicker(false)}
                    onConfirm={(h, m, p) => {
                        if (mode === 'duration') {
                            setHours(h);
                            setMinutes(m);
                        } else {
                            setEndH(h);
                            setEndM(m);
                            if (p) setEndPeriod(p);
                        }
                    }}
                    initialHours={mode === 'duration' ? hours : endH}
                    initialMinutes={mode === 'duration' ? minutes : endM}
                    initialPeriod={endPeriod}
                    title={mode === 'duration' ? "Set Duration" : "Set End Time"}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: 24,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    container: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 28,
        padding: 24,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        alignItems: 'center',
    },
    iconWrapper: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    toggleContainer: {
        flexDirection: 'row',
        borderRadius: 14,
        padding: 4,
        marginBottom: 16,
        width: '100%',
    },
    toggleBtn: { 
        flex: 1, 
        paddingVertical: 10, 
        alignItems: 'center', 
        borderRadius: 10 
    },
    activeToggle: { 
        shadowColor: '#000', 
        shadowOpacity: 0.08, 
        shadowRadius: 4, 
        elevation: 2 
    },
    toggleText: { 
        fontWeight: '700', 
        fontSize: 13 
    },
    inputBtn: {
        width: '100%',
        marginBottom: 24,
        borderRadius: 18,
        padding: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inputIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        flexDirection: 'row',
        width: '100%',
        paddingTop: 16,
        borderTopWidth: 1,
    }
});