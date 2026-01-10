import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '../constants/theme';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnalogTimePickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (time: string) => void;
    value?: Date | null;
    title?: string;
}

export default function AnalogTimePicker({ visible, onClose, onSelect, value, title = "Select Time" }: AnalogTimePickerProps) {
    const theme = useAppTheme();

    const [hours, setHours] = useState(12);
    const [minutes, setMinutes] = useState(0);
    const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
    const [mode, setMode] = useState<'HOUR' | 'MINUTE'>('HOUR'); 

    const rotationVal = useSharedValue(-90); 

    // Initialize State from Date Value
    useEffect(() => {
        if (visible) {
            const d = value instanceof Date ? value : new Date();
            let h = d.getHours();
            const m = d.getMinutes();
            const p = h >= 12 ? 'PM' : 'AM';

            if (h > 12) h -= 12;
            if (h === 0) h = 12;

            setHours(h);
            setMinutes(m);
            setPeriod(p);
            setMode('HOUR');

            // Reset rotation to the correct start position immediately
            const startAngle = (h * 30) - 90;
            rotationVal.value = startAngle; 
        }
    }, [visible, value]);

    // Handle Animation on State Change
    useEffect(() => {
        if (!visible) return; // Prevent animation when closing

        let val = 0;
        if (mode === 'HOUR') {
            val = hours; 
        } else {
            val = minutes === 0 ? 0 : minutes / 5;
        }

        const targetAngle = (val * 30) - 90;

        // Calculate shortest path for smooth rotation
        const current = rotationVal.value;
        const diff = targetAngle - current;
        const shortestDiff = ((diff + 180) % 360 + 360) % 360 - 180;
        
        rotationVal.value = withSpring(current + shortestDiff, { 
            damping: 16, 
            stiffness: 110,
            mass: 1 
        });

    }, [hours, minutes, mode]);

    const animatedLineProps = useAnimatedProps(() => {
        const rad = rotationVal.value * (Math.PI / 180);
        const radius = 74;
        return {
            x2: 100 + radius * Math.cos(rad),
            y2: 100 + radius * Math.sin(rad),
        };
    });

    const animatedCircleProps = useAnimatedProps(() => {
        const rad = rotationVal.value * (Math.PI / 180);
        const radius = 74;
        return {
            cx: 100 + radius * Math.cos(rad),
            cy: 100 + radius * Math.sin(rad),
        };
    });

    const handleConfirm = () => {
        let h = hours;
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        // Return 24h format string "HH:mm"
        const formatted = `${h.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        onSelect(formatted);
        onClose();
    };

    const getCoordinates = (value: number, total: number, radius: number) => {
        const angle = (value * (360 / total) - 90) * (Math.PI / 180);
        return {
            x: 100 + radius * Math.cos(angle),
            y: 100 + radius * Math.sin(angle)
        };
    };

    const renderClockFace = () => {
        const isHour = mode === 'HOUR';
        const clockBg = theme.colors.background;
        const clockStroke = theme.colors.border;
        const textColor = theme.colors.textSecondary;
        const activeColor = theme.colors.primary;
        const whiteColor = '#ffffff';

        return (
            <View className="items-center justify-center my-6">
                <Svg height="260" width="260" viewBox="0 0 200 200">
                    <Circle cx="100" cy="100" r="98" fill={clockBg} stroke={clockStroke} strokeWidth="1" />
                    <Circle cx="100" cy="100" r="3" fill={activeColor} />

                    <AnimatedLine 
                        x1="100" y1="100" 
                        stroke={activeColor} 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        animatedProps={animatedLineProps}
                    />
                    <AnimatedCircle 
                        r="14" 
                        fill={activeColor} 
                        animatedProps={animatedCircleProps}
                    />

                    {Array.from({ length: 12 }).map((_, i) => {
                        const val = (i + 1);
                        const displayVal = isHour ? val : (val * 5 === 60 ? 0 : val * 5);
                        const { x, y } = getCoordinates(val, 12, 74);
                        const isSelected = isHour ? (hours === val || (hours===0 && val===12)) : (minutes === displayVal);

                        return (
                            <React.Fragment key={i}>
                                <Circle 
                                    cx={x} cy={y} r="18" 
                                    fill="transparent"
                                    onPress={() => {
                                        if(isHour) { setHours(val); setMode('MINUTE'); }
                                        else { setMinutes(displayVal); }
                                    }}
                                />
                                <SvgText
                                    x={x} y={y + 5}
                                    fill={isSelected ? whiteColor : textColor}
                                    fontSize="14"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fontFamily="System"
                                >
                                    {displayVal.toString()}
                                </SvgText>
                            </React.Fragment>
                        );
                    })}
                </Svg>
            </View>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable 
                    style={[styles.shadow, { backgroundColor: theme.colors.card }]}
                    className="w-[88%] max-w-[360px] rounded-3xl overflow-hidden p-6" 
                    onPress={(e) => e.stopPropagation()}
                >
                    <View className="items-center mb-2">
                        <Text style={{ color: theme.colors.textSecondary }} className="mb-4 font-sans text-xs font-bold tracking-widest text-center uppercase">
                            {title}
                        </Text>
                        
                        <View className="flex-row items-end justify-center gap-1 mb-2">
                            <TouchableOpacity 
                                onPress={() => setMode('HOUR')} 
                                style={[
                                    { borderRadius: 12, padding: 8 },
                                    mode === 'HOUR' && { backgroundColor: theme.colors.primaryLight }
                                ]}
                            >
                                <Text style={{ fontSize: 48, fontWeight: 'bold', color: mode === 'HOUR' ? theme.colors.primary : theme.colors.text }}>
                                    {hours.toString().padStart(2, '0')}
                                </Text>
                            </TouchableOpacity>
                            
                            <Text style={{ fontSize: 48, fontWeight: 'bold', color: theme.colors.border, paddingBottom: 10 }}>:</Text>
                            
                            <TouchableOpacity 
                                onPress={() => setMode('MINUTE')} 
                                style={[
                                    { borderRadius: 12, padding: 8 },
                                    mode === 'MINUTE' && { backgroundColor: theme.colors.primaryLight }
                                ]}
                            >
                                <Text style={{ fontSize: 48, fontWeight: 'bold', color: mode === 'MINUTE' ? theme.colors.primary : theme.colors.text }}>
                                    {minutes.toString().padStart(2, '0')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: 8, padding: 4, borderWidth: 1, borderColor: theme.colors.border }}>
                            <TouchableOpacity 
                                onPress={() => setPeriod('AM')} 
                                style={[
                                    { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
                                    period === 'AM' && { backgroundColor: theme.colors.card, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }
                                ]}
                            >
                                <Text style={{ fontWeight: 'bold', fontSize: 12, color: period === 'AM' ? theme.colors.primary : theme.colors.textSecondary }}>AM</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setPeriod('PM')} 
                                style={[
                                    { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
                                    period === 'PM' && { backgroundColor: theme.colors.card, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }
                                ]}
                            >
                                <Text style={{ fontWeight: 'bold', fontSize: 12, color: period === 'PM' ? theme.colors.primary : theme.colors.textSecondary }}>PM</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {renderClockFace()}
                    
                    <View className="flex-row justify-between gap-4 mt-2">
                        <TouchableOpacity 
                            onPress={onClose} 
                            style={{ backgroundColor: theme.colors.background }}
                            className="flex-1 py-3.5 rounded-xl items-center"
                        >
                             <Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold' }}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={handleConfirm} 
                            style={{ backgroundColor: theme.colors.primary }}
                            className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-xl"
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Set Time</Text>
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>

                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    }
});