import { format } from 'date-fns';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DailySummaryCardProps {
    totalMinutes: number;
    isClockedIn: boolean;
    theme: any;
    dailyGoal?: number;
    isOvertime?: boolean;
    startTime?: string;
}

const DailySummaryCard = ({ 
    totalMinutes, 
    isClockedIn, 
    theme, 
    dailyGoal = 8, 
    isOvertime = false, 
    startTime 
}: DailySummaryCardProps) => {
    const safeMinutes = Math.max(0, totalMinutes);
    const h = Math.floor(safeMinutes / 60);
    const m = Math.floor(safeMinutes % 60);
    const goalMinutes = dailyGoal * 60;
    const percentage = goalMinutes > 0 ? Math.min(safeMinutes / goalMinutes, 1) : 0;
    const displayPercentage = Math.round(percentage * 100);
    const progressValue = useSharedValue(0);
    const scaleValue = useSharedValue(1);
    
    useEffect(() => { 
        progressValue.value = withTiming(percentage, { duration: 1500, easing: Easing.out(Easing.cubic) }); 
    }, [percentage]);

    const handlePressIn = () => { scaleValue.value = withSpring(0.97); };
    const handlePressOut = () => { scaleValue.value = withSpring(1); };
    
    const activeColor = isOvertime ? '#EF4444' : isClockedIn ? '#10B981' : '#94A3B8';
    const statusText = isOvertime ? 'OVERTIME' : isClockedIn ? 'ACTIVE' : 'CHECKED OUT';
    const SIZE = 110; const RADIUS = 48; const STROKE_WIDTH = 8; const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    
    const animatedCircleProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - progressValue.value) }));
    const animatedCardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleValue.value }] }));

    return (
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={[styles.cardNew, animatedCardStyle, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={StyleSheet.absoluteFill}>
                    <Svg height="100%" width="100%">
                        <Defs>
                            <LinearGradient id="meshGrad" x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0" stopColor={theme.dark ? "#020617" : "#F8FAFC"} stopOpacity="1" />
                                <Stop offset="1" stopColor={theme.dark ? "#1E293B" : "#F1F5F9"} stopOpacity="1" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#meshGrad)" />
                    </Svg>
                </View>
                <View style={{ padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: isClockedIn ? `${activeColor}15` : theme.colors.border, borderWidth: 1, borderColor: isClockedIn ? activeColor : theme.colors.border }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeColor, marginRight: 6 }} /><Text style={{ color: activeColor, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{statusText}</Text>
                            </View>
                        </View>
                        <Text style={{ fontSize: 36, fontWeight: '900', color: theme.colors.text, fontVariant: ['tabular-nums'], letterSpacing: -1, lineHeight: 40 }}>{h}<Text style={{ fontSize: 18, color: theme.colors.textSecondary, fontWeight: '600' }}>h</Text> {m}<Text style={{ fontSize: 18, color: theme.colors.textSecondary, fontWeight: '600' }}>m</Text></Text>
                        <View style={{ flexDirection: 'row', gap: 20, marginTop: 16 }}>
                            <View><Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, opacity: 0.7 }}>CHECK-IN</Text><Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 2 }}>{isClockedIn && startTime ? format(new Date(startTime), 'h:mm a') : '--:--'}</Text></View>
                            <View><Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, opacity: 0.7 }}>GOAL</Text><Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 2 }}>{dailyGoal}h</Text></View>
                        </View>
                    </View>
                    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
                        <Svg width={SIZE} height={SIZE}><G rotation="-90" origin={`${SIZE/2}, ${SIZE/2}`}><Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke={theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"} strokeWidth={STROKE_WIDTH} fill="none" /><AnimatedCircle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke={activeColor} strokeWidth={STROKE_WIDTH} fill="none" strokeDasharray={CIRCUMFERENCE} animatedProps={animatedCircleProps} strokeLinecap="round" /></G></Svg>
                        <View style={StyleSheet.absoluteFillObject} className="items-center justify-center"><Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text }}>{displayPercentage}<Text style={{ fontSize: 12 }}>%</Text></Text></View>
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    cardNew: { borderRadius: 24, marginBottom: 32, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6, overflow: 'hidden', position: 'relative', height: 200, borderWidth: 1 },
});

export default DailySummaryCard;