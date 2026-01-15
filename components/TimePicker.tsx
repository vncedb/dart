import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '../constants/theme';
import Button from './Button';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TimePickerProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    title?: string;
    initialValue?: Date | null;
}

const CLOCK_SIZE = 220;
const CENTER = CLOCK_SIZE / 2;
const RADIUS = CLOCK_SIZE / 2 - 32; 
const HAND_LENGTH = RADIUS; 

export default function TimePicker({ visible, onClose, onConfirm, title = "Select Time", initialValue }: TimePickerProps) {
    const theme = useAppTheme();
    const [hours, setHours] = useState(12);
    const [minutes, setMinutes] = useState(0);
    const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
    const [clockMode, setClockMode] = useState<'HOUR' | 'MINUTE'>('HOUR');
    
    const rotationVal = useSharedValue(-90);

    // Initial Setup
    useEffect(() => {
        if (visible) {
            const d = initialValue || new Date();
            let h = d.getHours();
            const m = d.getMinutes();
            const p = h >= 12 ? 'PM' : 'AM';
            
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
            
            setHours(h);
            setMinutes(m);
            setPeriod(p);
            setClockMode('HOUR');
            
            // Set initial position instantly
            const val = h;
            rotationVal.value = (val * 30) - 90;
        }
    }, [visible, initialValue]);

    // Animation Logic
    useEffect(() => {
        if (!visible) return;
        
        let val = 0;
        let step = 30;

        if (clockMode === 'HOUR') {
            val = hours;
            step = 30;
        } else {
            val = minutes === 0 ? 0 : minutes / 5;
            step = 30;
        }

        const targetAngle = (val * step) - 90;
        const current = rotationVal.value;
        const diff = targetAngle - current;
        const shortestDiff = ((diff + 180) % 360 + 360) % 360 - 180;
        
        // Smooth morphing transition
        rotationVal.value = withTiming(current + shortestDiff, { 
            duration: 400, 
            easing: Easing.out(Easing.cubic) 
        });

    }, [hours, minutes, clockMode, visible]);

    const handProps = useAnimatedProps(() => {
        const rad = rotationVal.value * (Math.PI / 180);
        return {
            x2: CENTER + HAND_LENGTH * Math.cos(rad),
            y2: CENTER + HAND_LENGTH * Math.sin(rad),
        };
    });

    const knobProps = useAnimatedProps(() => {
        const rad = rotationVal.value * (Math.PI / 180);
        return {
            cx: CENTER + HAND_LENGTH * Math.cos(rad),
            cy: CENTER + HAND_LENGTH * Math.sin(rad),
        };
    });

    const handleConfirm = () => {
        const d = new Date();
        let h = hours;
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        d.setHours(h, minutes, 0, 0);
        onConfirm(d);
        onClose();
    };

    const getCoordinates = (val: number) => {
        const angle = (val * 30 - 90) * (Math.PI / 180);
        return {
            x: CENTER + RADIUS * Math.cos(angle),
            y: CENTER + RADIUS * Math.sin(angle)
        };
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={[styles.container, { backgroundColor: theme.colors.card }]} onPress={e => e.stopPropagation()}>
                    
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
                    </View>

                    <View style={styles.content}>
                        {/* Digital Display */}
                        <View style={styles.digitalDisplay}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                                <TouchableOpacity 
                                    onPress={() => setClockMode('HOUR')} 
                                    style={[styles.timeUnit, clockMode === 'HOUR' && { backgroundColor: theme.colors.primary + '15' }]}
                                >
                                    <Text style={[styles.timeText, { color: clockMode === 'HOUR' ? theme.colors.primary : theme.colors.text }]}>
                                        {hours.toString().padStart(2, '0')}
                                    </Text>
                                </TouchableOpacity>
                                
                                <Text style={[styles.separator, { color: theme.colors.border }]}>:</Text>
                                
                                <TouchableOpacity 
                                    onPress={() => setClockMode('MINUTE')} 
                                    style={[styles.timeUnit, clockMode === 'MINUTE' && { backgroundColor: theme.colors.primary + '15' }]}
                                >
                                    <Text style={[styles.timeText, { color: clockMode === 'MINUTE' ? theme.colors.primary : theme.colors.text }]}>
                                        {minutes.toString().padStart(2, '0')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            
                            <View style={styles.ampmWrapper}>
                                {['AM', 'PM'].map((p) => (
                                    <TouchableOpacity 
                                        key={p} 
                                        onPress={() => setPeriod(p as any)} 
                                        style={[
                                            styles.ampmBtn, 
                                            { 
                                                backgroundColor: period === p ? theme.colors.card : theme.colors.background,
                                                borderColor: period === p ? theme.colors.primary : theme.colors.border,
                                            }
                                        ]}
                                    >
                                        <Text style={[styles.ampmText, { color: period === p ? theme.colors.primary : theme.colors.textSecondary }]}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Analog Clock */}
                        <View style={{ marginTop: 24, marginBottom: 8 }}>
                            <Svg height={CLOCK_SIZE} width={CLOCK_SIZE}>
                                {/* Clock Face Background */}
                                <Circle cx={CENTER} cy={CENTER} r={RADIUS + 24} fill={theme.colors.background} stroke={theme.colors.border} strokeWidth="1" />
                                
                                {/* Center Dot */}
                                <Circle cx={CENTER} cy={CENTER} r="4" fill={theme.colors.primary} />
                                
                                {/* The Hand Line */}
                                <AnimatedLine 
                                    x1={CENTER} y1={CENTER} 
                                    stroke={theme.colors.primary} 
                                    strokeWidth="2" 
                                    animatedProps={handProps}
                                />
                                {/* The Knob at the end of the hand */}
                                <AnimatedCircle 
                                    r="16" 
                                    fill={theme.colors.primary} 
                                    animatedProps={knobProps}
                                />

                                {Array.from({ length: 12 }).map((_, i) => {
                                    const val = i + 1;
                                    const displayVal = clockMode === 'HOUR' ? val : (val * 5 === 60 ? 0 : val * 5);
                                    const { x, y } = getCoordinates(val);
                                    const isSelected = clockMode === 'HOUR' ? (hours === val || (hours===0 && val===12)) : (minutes === displayVal);

                                    return (
                                        <G 
                                            key={i} 
                                            onPress={() => { 
                                                if(clockMode === 'HOUR') { 
                                                    setHours(val); 
                                                    // REMOVED: setClockMode('MINUTE'); -> Prevents auto navigation
                                                } else { 
                                                    setMinutes(displayVal); 
                                                } 
                                            }}
                                        >
                                            {/* Invisible touch target */}
                                            <Circle cx={x} cy={y} r="20" fill="transparent" />
                                            <SvgText
                                                x={x} y={y + 5}
                                                fill={isSelected ? '#fff' : theme.colors.textSecondary}
                                                fontSize="14" fontWeight="bold" textAnchor="middle"
                                                fontFamily="System"
                                            >
                                                {displayVal.toString()}
                                            </SvgText>
                                        </G>
                                    );
                                })}
                            </Svg>
                        </View>
                    </View>

                    <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
                        <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
                        <View style={{ width: 12 }} />
                        <Button title="Confirm" variant="primary" onPress={handleConfirm} style={{ flex: 1 }} />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    container: { width: 340, borderRadius: 24, overflow: 'hidden' }, // Fixed Width: 340
    header: { paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1 },
    title: { fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    content: { alignItems: 'center', paddingTop: 20, paddingBottom: 16 },
    digitalDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 30 },
    timeUnit: { width: 70, alignItems: 'center', paddingVertical: 2, borderRadius: 8 },
    timeText: { fontSize: 44, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
    separator: { fontSize: 40, fontWeight: '800', paddingBottom: 6, marginHorizontal: 2 },
    ampmWrapper: { position: 'absolute', right: 24, gap: 6 },
    ampmBtn: { width: 44, alignItems: 'center', paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
    ampmText: { fontSize: 11, fontWeight: '700' },
    footer: { padding: 20, borderTopWidth: 1, flexDirection: 'row' },
});