import {
    CheckmarkCircle01Icon, // FIXED: Changed from 02 to 01 (safer for free tier)
    Clock01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { differenceInSeconds, format } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedView = Animated.createAnimatedComponent(View);

interface DailySummaryCardProps {
    totalMinutes: number;
    isClockedIn: boolean;
    theme: any;
    dailyGoal?: number;
    isOvertime?: boolean;
    startTime?: string;
    otExpiry?: string | null;
}

const DailySummaryCard = ({ 
    totalMinutes, 
    isClockedIn, 
    theme, 
    dailyGoal = 8, 
    isOvertime = false, 
    startTime,
    otExpiry,
}: DailySummaryCardProps) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        if (!isOvertime || !otExpiry) return;
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, [isOvertime, otExpiry]);

    // --- Calculations ---
    const safeMinutes = Math.max(0, totalMinutes);
    const h = Math.floor(safeMinutes / 60);
    const m = Math.floor(safeMinutes % 60);

    const goalMinutes = (dailyGoal || 8) * 60;
    const rawPercentage = goalMinutes > 0 ? safeMinutes / goalMinutes : 0;
    const percentage = Math.min(rawPercentage, 1);
    const displayPercentage = Math.round(rawPercentage * 100);

    // Overtime Math
    const otMinutes = Math.max(0, safeMinutes - goalMinutes);
    const otH = Math.floor(otMinutes / 60);
    const otM = Math.floor(otMinutes % 60);

    // Auto-Checkout Countdown
    const otRemainingSeconds = useMemo(() => {
        if (!isOvertime || !otExpiry) return 0;
        return Math.max(0, differenceInSeconds(new Date(otExpiry), now));
    }, [isOvertime, otExpiry, now]);

    const remH = Math.floor(otRemainingSeconds / 3600);
    const remM = Math.floor((otRemainingSeconds % 3600) / 60);
    const remS = otRemainingSeconds % 60;

    // --- Animations ---
    const progressValue = useSharedValue(0);
    const pulseValue = useSharedValue(1);

    useEffect(() => { 
        progressValue.value = withTiming(percentage, { duration: 1500, easing: Easing.out(Easing.exp) });
    }, [percentage]);

    useEffect(() => {
        if (isOvertime && isClockedIn) {
            pulseValue.value = withRepeat(
                withSequence(withTiming(0.6, { duration: 1000 }), withTiming(1, { duration: 1000 })),
                -1, true
            );
        } else {
            pulseValue.value = withTiming(1);
        }
    }, [isOvertime, isClockedIn]);

    // --- Styling Config ---
    const SIZE = 120; 
    const RADIUS = 50; 
    const STROKE_WIDTH = 10; 
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    let accentColor = theme.colors.primary;
    let statusText = 'ON TRACK';
    let statusBg = theme.colors.primary + '15';

    // Modern Gradient Colors
    const gradientColors = theme.dark 
        ? [theme.colors.card, "#0f172a"] 
        : ["#ffffff", "#f1f5f9"];

    if (isOvertime) {
        accentColor = '#ef4444'; // Red
        statusText = 'OVERTIME';
        statusBg = '#ef444415';
    } else if (displayPercentage >= 100 && isClockedIn) {
        accentColor = '#10b981'; // Emerald
        statusText = 'GOAL MET';
        statusBg = '#10b98115';
    } else if (!isClockedIn) {
        accentColor = theme.colors.textSecondary;
        statusText = 'OFF DUTY';
        statusBg = theme.colors.border;
    }

    const animatedCircleProps = useAnimatedProps(() => ({
        strokeDashoffset: CIRCUMFERENCE * (1 - progressValue.value),
    }));

    const animatedPulseStyle = useAnimatedStyle(() => ({
        opacity: pulseValue.value
    }));

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: isOvertime ? accentColor : theme.colors.border }]}>
            {/* Background Texture */}
            <View style={StyleSheet.absoluteFill}>
                <Svg height="100%" width="100%">
                    <Defs>
                        <LinearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={gradientColors[0]} stopOpacity="1" />
                            <Stop offset="1" stopColor={gradientColors[1]} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" rx={24} fill="url(#cardGrad)" />
                </Svg>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                
                {/* LEFT: Context & Stats */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    {/* Status Badge */}
                    <AnimatedView style={[styles.statusBadge, animatedPulseStyle, { backgroundColor: statusBg, borderColor: isOvertime ? accentColor : 'transparent' }]}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor, marginRight: 6 }} />
                        <Text style={{ color: accentColor, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{statusText}</Text>
                    </AnimatedView>

                    {/* Main Text Stats */}
                    <View style={{ marginTop: 16, marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Total Hours
                        </Text>
                        <Text style={{ fontSize: 36, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'], letterSpacing: -1, lineHeight: 40 }}>
                            {h}<Text style={{ fontSize: 16, color: theme.colors.textSecondary, fontWeight: '600' }}>h</Text> {m.toString().padStart(2, '0')}<Text style={{ fontSize: 16, color: theme.colors.textSecondary, fontWeight: '600' }}>m</Text>
                        </Text>
                    </View>

                    {/* Meta Details Row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.metaItem}>
                            <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.textSecondary} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text, marginLeft: 4 }}>
                                {isClockedIn && startTime ? format(new Date(startTime), 'h:mm a') : '--:--'}
                            </Text>
                        </View>
                        <View style={{ width: 1, height: 12, backgroundColor: theme.colors.border }} />
                        <View style={styles.metaItem}>
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color={theme.colors.textSecondary} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text, marginLeft: 4 }}>
                                {dailyGoal}h Goal
                            </Text>
                        </View>
                    </View>
                </View>

                {/* RIGHT: Modern Circle Graph */}
                <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={SIZE} height={SIZE}>
                        <G rotation="-90" origin={`${SIZE/2}, ${SIZE/2}`}>
                            {/* Track */}
                            <Circle 
                                cx={SIZE/2} cy={SIZE/2} r={RADIUS} 
                                stroke={theme.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"} 
                                strokeWidth={STROKE_WIDTH} 
                                fill="none" 
                            />
                            {/* Progress */}
                            <AnimatedCircle 
                                cx={SIZE/2} cy={SIZE/2} r={RADIUS} 
                                stroke={accentColor} 
                                strokeWidth={STROKE_WIDTH} 
                                fill="none" 
                                strokeDasharray={CIRCUMFERENCE} 
                                animatedProps={animatedCircleProps} 
                                strokeLinecap="round" 
                            />
                        </G>
                    </Svg>
                    
                    {/* Inner Content */}
                    <View style={StyleSheet.absoluteFillObject} className="items-center justify-center">
                        {isOvertime ? (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 9, fontWeight: '800', color: accentColor, marginBottom: 0, textTransform: 'uppercase' }}>OVERTIME</Text>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] }}>
                                    +{otH}:{otM.toString().padStart(2,'0')}
                                </Text>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text }}>
                                    {displayPercentage}
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>%</Text>
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Auto-Checkout Badge (Floating) */}
                    {isOvertime && otExpiry && (
                        <View style={[styles.timerBadge, { backgroundColor: theme.colors.danger, borderColor: theme.colors.card }]}>
                            <HugeiconsIcon icon={Clock01Icon} size={10} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', marginLeft: 4, fontVariant: ['tabular-nums'] }}>
                                -{remH}:{remM.toString().padStart(2,'0')}:{remS.toString().padStart(2,'0')}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: { 
        borderRadius: 24, 
        padding: 24, 
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.03,
        shadowRadius: 16,
        elevation: 2,
        overflow: 'visible' 
    },
    statusBadge: {
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 10, 
        paddingVertical: 5, 
        borderRadius: 8, 
        borderWidth: 1,
        alignSelf: 'flex-start'
    },
    metaItem: {
        flexDirection: 'row', 
        alignItems: 'center', 
        opacity: 0.8
    },
    timerBadge: {
        position: 'absolute', 
        bottom: -6, 
        paddingHorizontal: 10, 
        paddingVertical: 4, 
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
        borderWidth: 2,
    }
});

export default DailySummaryCard;