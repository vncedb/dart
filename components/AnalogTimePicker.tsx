import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

// Create Animated components for SVG
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnalogTimePickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (time: string) => void;
    initialValue?: string;
    title?: string;
}

export default function AnalogTimePicker({ visible, onClose, onSelect, initialValue = "09:00", title = "Select Time" }: AnalogTimePickerProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    // State
    const [hours, setHours] = useState(9);
    const [minutes, setMinutes] = useState(0);
    const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
    const [mode, setMode] = useState<'HOUR' | 'MINUTE'>('HOUR'); 

    // Animation Shared Value (Angle in degrees)
    const rotationVal = useSharedValue(180); // Default to 9 o'clock (180 deg)

    useEffect(() => {
        if (visible) {
            parseTime(initialValue);
            setMode('HOUR');
        }
    }, [visible, initialValue]);

    // Handle Animation when values change
    useEffect(() => {
        let val = 0;
        if (mode === 'HOUR') {
            val = hours; // 1-12
        } else {
            // Convert minutes (0, 5, 10...) to index 0-11. 
            // Note: 0 mins = index 0. 5 mins = index 1.
            val = minutes === 0 ? 0 : minutes / 5;
        }

        // Calculate target angle
        // Formula: (val * 30) - 90.
        // Examples:
        // 3 o'clock (val 3) -> 90 - 90 = 0 deg (Right)
        // 12 o'clock (val 12) -> 360 - 90 = 270 deg (Top)
        // 0 mins (val 0) -> 0 - 90 = -90 deg (Top)
        const targetAngle = (val * 30) - 90;

        // Calculate shortest rotation path
        const current = rotationVal.value;
        const diff = targetAngle - current;
        const shortestDiff = ((diff + 180) % 360 + 360) % 360 - 180;
        
        rotationVal.value = withSpring(current + shortestDiff, { 
            damping: 18, 
            stiffness: 120,
            mass: 1 
        });

    }, [hours, minutes, mode]);

    // Animated Props for the Line (Hand)
    const animatedLineProps = useAnimatedProps(() => {
        const rad = rotationVal.value * (Math.PI / 180);
        const radius = 74;
        return {
            x2: 100 + radius * Math.cos(rad),
            y2: 100 + radius * Math.sin(rad),
        };
    });

    // Animated Props for the Circle (Tip)
    const animatedCircleProps = useAnimatedProps(() => {
        const rad = rotationVal.value * (Math.PI / 180);
        const radius = 74;
        return {
            cx: 100 + radius * Math.cos(rad),
            cy: 100 + radius * Math.sin(rad),
        };
    });

    const parseTime = (val: string) => {
        let h = 9, m = 0, p: 'AM' | 'PM' = 'AM';
        const isPm = val.toLowerCase().includes('pm');
        const cleanVal = val.replace(/am|pm/gi, '').trim();
        const parts = cleanVal.split(':');
        
        if (parts.length >= 2) {
            h = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
        }

        if (!val.toLowerCase().includes('m')) {
            if (h >= 12) { p = 'PM'; if (h > 12) h -= 12; }
            else if (h === 0) { h = 12; p = 'AM'; }
        } else {
            p = isPm ? 'PM' : 'AM';
        }

        setHours(h);
        setMinutes(m);
        setPeriod(p);
        
        // Snap animation immediately on open (optional)
        // const startVal = (h * 30) - 90;
        // rotationVal.value = startVal; 
    };

    const handleConfirm = () => {
        let h = hours;
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
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
        const clockBg = isDark ? '#1e293b' : '#f1f5f9';
        const clockStroke = isDark ? '#334155' : '#e2e8f0';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const activeColor = '#6366f1';
        const whiteColor = '#ffffff';

        return (
            <View className="items-center justify-center my-4">
                <Svg height="260" width="260" viewBox="0 0 200 200">
                    {/* Clock Background */}
                    <Circle cx="100" cy="100" r="98" fill={clockBg} stroke={clockStroke} strokeWidth="1" />
                    <Circle cx="100" cy="100" r="3" fill={activeColor} />

                    {/* Animated Hand */}
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

                    {/* Numbers */}
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
                                    fontFamily="Nunito_700Bold"
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
                    className="bg-white dark:bg-slate-900 w-[88%] max-w-[360px] rounded-3xl overflow-hidden p-6" 
                    style={styles.shadow}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View className="items-center mb-2">
                        <Text className="mb-4 font-sans text-xs font-bold tracking-widest text-center uppercase text-slate-400">{title}</Text>
                        
                        <View className="flex-row items-end justify-center gap-1 mb-2">
                            <TouchableOpacity 
                                onPress={() => setMode('HOUR')} 
                                style={[mode === 'HOUR' && { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eff6ff' }]}
                                className="p-2 rounded-xl"
                            >
                                <Text className={`text-6xl font-bold font-sans ${mode === 'HOUR' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                                    {hours.toString().padStart(2, '0')}
                                </Text>
                            </TouchableOpacity>
                            
                            <Text className="pb-4 font-sans text-6xl font-bold text-slate-300 dark:text-slate-600">:</Text>
                            
                            <TouchableOpacity 
                                onPress={() => setMode('MINUTE')} 
                                style={[mode === 'MINUTE' && { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : '#eff6ff' }]}
                                className="p-2 rounded-xl"
                            >
                                <Text className={`text-6xl font-bold font-sans ${mode === 'MINUTE' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                                    {minutes.toString().padStart(2, '0')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row p-1 border rounded-lg bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                            <TouchableOpacity onPress={() => setPeriod('AM')} className={`px-4 py-1.5 rounded-md ${period === 'AM' ? 'bg-white dark:bg-slate-700' : ''}`} style={period === 'AM' ? styles.smallShadow : {}}>
                                <Text className={`text-xs font-bold font-sans ${period === 'AM' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`}>AM</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setPeriod('PM')} className={`px-4 py-1.5 rounded-md ${period === 'PM' ? 'bg-white dark:bg-slate-700' : ''}`} style={period === 'PM' ? styles.smallShadow : {}}>
                                <Text className={`text-xs font-bold font-sans ${period === 'PM' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`}>PM</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {renderClockFace()}
                    
                    <View className="flex-row justify-between gap-4 mt-2">
                        <TouchableOpacity onPress={onClose} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 rounded-xl items-center">
                             <Text className="font-sans font-bold text-slate-600 dark:text-slate-300">Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity onPress={handleConfirm} className="flex-1 flex-row items-center justify-center gap-2 py-3.5 bg-indigo-600 rounded-xl">
                            <Text className="font-sans font-bold text-white">Set Time</Text>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    smallShadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    }
});