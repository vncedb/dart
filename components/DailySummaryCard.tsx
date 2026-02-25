import {
    Calendar03Icon,
    CheckmarkCircle01Icon,
    Clock01Icon,
    HourglassIcon,
    Target02Icon,
    Time02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { addMinutes, differenceInSeconds, format } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
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
    targetEndTime?: string | null;
    payoutType?: string;
    periodWorkedMinutes?: number;
    periodTargetMinutes?: number;
}

const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h}h ${m}m`;
};

const DailySummaryCard = ({ 
    totalMinutes, 
    isClockedIn, 
    theme, 
    dailyGoal = 8, 
    isOvertime = false, 
    startTime,
    targetEndTime,
    payoutType = 'Semi-Monthly',
    periodWorkedMinutes = 0,
    periodTargetMinutes
}: DailySummaryCardProps) => {
    const [now, setNow] = useState(new Date());
    
    useEffect(() => {
        if (!isClockedIn) return;
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, [isClockedIn]);

    const safeMinutes = Math.max(0, totalMinutes);
    const h = Math.floor(safeMinutes / 60);
    const m = Math.floor(safeMinutes % 60);
    const s = Math.floor((safeMinutes * 60) % 60);

    const goalMinutes = (dailyGoal || 8) * 60;
    const rawPercentage = goalMinutes > 0 ? safeMinutes / goalMinutes : 0;
    const percentage = Math.min(rawPercentage, 1);
    const displayPercentage = Math.round(rawPercentage * 100);
    const isGoalMet = displayPercentage >= 100;

    const showPeriodTarget = !!periodTargetMinutes && periodTargetMinutes > 0;

    const periodData = useMemo(() => {
        if (!showPeriodTarget) return null; 

        let label = `${payoutType} Goal`;
        const targetMins = periodTargetMinutes || 0;
        const currentMins = periodWorkedMinutes; 
        const progress = targetMins > 0 ? Math.min(currentMins / targetMins, 1) : 0;
        
        return { 
            label, 
            targetFormatted: formatDuration(targetMins),
            currentFormatted: formatDuration(currentMins),
            progress 
        };
    }, [payoutType, periodWorkedMinutes, periodTargetMinutes, showPeriodTarget]);

    const remainingSeconds = useMemo(() => {
        if (!isClockedIn || !targetEndTime) return null;
        const target = new Date(targetEndTime);
        return differenceInSeconds(target, now);
    }, [isClockedIn, targetEndTime, now]);

    const isNearTimeout = remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= 300;
    
    const predictedEndTime = useMemo(() => {
        if (targetEndTime) return new Date(targetEndTime);
        if (!startTime) return null;
        return addMinutes(new Date(startTime), goalMinutes);
    }, [startTime, goalMinutes, targetEndTime]);

    const countdownStr = useMemo(() => {
        if (remainingSeconds === null) return null;
        if (remainingSeconds <= 0) return "00:00:00";
        const rH = Math.floor(remainingSeconds / 3600);
        const rM = Math.floor((remainingSeconds % 3600) / 60);
        const rS = remainingSeconds % 60;
        return `${rH > 0 ? rH + ':' : ''}${rM.toString().padStart(2, '0')}:${rS.toString().padStart(2, '0')}`;
    }, [remainingSeconds]);

    const progressValue = useSharedValue(0);
    const periodProgressValue = useSharedValue(0);
    const pulseOpacity = useSharedValue(1);
    const scaleValue = useSharedValue(1);

    useEffect(() => { 
        progressValue.value = withTiming(percentage, { duration: 1500, easing: Easing.out(Easing.exp) });
        if (periodData) {
            periodProgressValue.value = withTiming(periodData.progress, { duration: 1500, easing: Easing.out(Easing.quad) });
        }
    }, [percentage, periodData, progressValue, periodProgressValue]);

    useEffect(() => {
        if (isNearTimeout || (isOvertime && isClockedIn)) {
            pulseOpacity.value = withRepeat(withSequence(withTiming(0.6, { duration: 800 }), withTiming(1, { duration: 800 })), -1, true);
        } else {
            pulseOpacity.value = withTiming(1);
        }
    }, [isNearTimeout, isOvertime, isClockedIn, pulseOpacity]);

    const handlePress = () => {
        scaleValue.value = withSequence(withSpring(0.98), withSpring(1));
    };

    const SIZE = 100;
    const RADIUS = 42; 
    const STROKE_WIDTH = 8; 
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    let accentColor = theme.colors.primary;
    let statusText = 'ON TRACK';
    let statusIcon = Clock01Icon;
    let borderColor = theme.colors.border;

    if (isNearTimeout) {
        accentColor = theme.colors.danger;
        statusText = 'ENDING SOON';
        statusIcon = HourglassIcon;
        borderColor = theme.colors.danger;
    } else if (isOvertime) {
        accentColor = '#f59e0b';
        statusText = 'OVERTIME';
        statusIcon = Time02Icon;
        borderColor = '#f59e0b';
    } else if (isGoalMet) {
        accentColor = '#10b981';
        statusText = 'GOAL MET';
        statusIcon = CheckmarkCircle01Icon;
    } else if (!isClockedIn) {
        accentColor = theme.colors.textSecondary;
        statusText = 'OFF DUTY';
        statusIcon = Clock01Icon;
    }

    const animatedCircleProps = useAnimatedProps(() => ({
        strokeDashoffset: CIRCUMFERENCE * (1 - progressValue.value),
    }));

    const animatedPeriodBarProps = useAnimatedStyle(() => ({
        width: `${periodProgressValue.value * 100}%`
    }));

    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleValue.value }]
    }));

    const gradientColors = theme.dark ? [theme.colors.card, "#0f172a"] : ["#ffffff", "#f8fafc"];

    return (
        <Pressable onPress={handlePress}>
            <AnimatedView style={[styles.card, cardAnimatedStyle, { backgroundColor: theme.colors.card, borderColor }]}>
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

                {/* --- TOP SECTION --- */}
                <View style={styles.topSection}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                        <AnimatedView style={[styles.statusBadge, { backgroundColor: accentColor + '15', opacity: pulseOpacity }]}>
                            <HugeiconsIcon icon={statusIcon} size={12} color={accentColor} />
                            <Text style={[styles.statusText, { color: accentColor }]}>{statusText}</Text>
                        </AnimatedView>

                        <View style={{ marginTop: 8 }}>
                            <Text style={[styles.labelSmall, { color: theme.colors.textSecondary }]}>
                                {isClockedIn ? "SESSION DURATION" : "TOTAL HOURS"}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                <Text style={[styles.timerText, { color: theme.colors.text }]}>
                                    {h}<Text style={styles.unitText}>h</Text> {m.toString().padStart(2, '0')}<Text style={styles.unitText}>m</Text>
                                </Text>
                                {isClockedIn && (
                                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: theme.colors.textSecondary, marginLeft: 6, opacity: 0.6, fontVariant: ['tabular-nums'] }}>
                                        {s.toString().padStart(2, '0')}s
                                    </Text>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                         {isClockedIn && isNearTimeout ? (
                            <AnimatedView style={[styles.countdownBadge, { width: SIZE, height: SIZE, borderRadius: SIZE/2, backgroundColor: theme.colors.danger + '10', borderColor: theme.colors.danger + '30' }]}>
                                <Text style={[styles.countdownLabel, { color: theme.colors.danger }]}>AUTO OUT</Text>
                                <Text style={[styles.countdownValue, { color: theme.colors.danger }]}>{countdownStr}</Text>
                            </AnimatedView>
                         ) : (
                            <View style={{ width: SIZE, height: SIZE }}>
                                <Svg width={SIZE} height={SIZE}>
                                    <G rotation="-90" origin={`${SIZE/2}, ${SIZE/2}`}>
                                        <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke={theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"} strokeWidth={STROKE_WIDTH} fill="none" />
                                        <AnimatedCircle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke={accentColor} strokeWidth={STROKE_WIDTH} fill="none" strokeDasharray={CIRCUMFERENCE} animatedProps={animatedCircleProps} strokeLinecap="round" />
                                    </G>
                                </Svg>
                                {/* FIX: Removed duplicate 'style' prop and merged */}
                                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                                    <Text style={{ fontSize: 20, fontFamily: 'Nunito_700Bold', color: theme.colors.text, fontVariant: ['tabular-nums'] }}>
                                        {displayPercentage}<Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', color: theme.colors.textSecondary }}>%</Text>
                                    </Text>
                                </View>
                            </View>
                         )}
                    </View>
                </View>

                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />

                {/* --- MIDDLE SECTION --- */}
                <View style={styles.gridSection}>
                    <View style={styles.metaCol}>
                        <View style={styles.metaHeader}>
                            <HugeiconsIcon icon={Clock01Icon} size={12} color={theme.colors.textSecondary} />
                            <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>START</Text>
                        </View>
                        <Text style={[styles.metaValue, { color: theme.colors.text }]} numberOfLines={1}>
                            {isClockedIn && startTime ? format(new Date(startTime), 'h:mm a') : '--:--'}
                        </Text>
                    </View>

                    <View style={[styles.metaCol, styles.metaColCenter, { borderLeftColor: theme.colors.border, borderRightColor: theme.colors.border }]}>
                        <View style={styles.metaHeader}>
                            <HugeiconsIcon icon={Target02Icon} size={12} color={theme.colors.textSecondary} />
                            <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>GOAL</Text>
                        </View>
                        <Text style={[styles.metaValue, { color: theme.colors.text }]} numberOfLines={1}>
                            {dailyGoal}h
                        </Text>
                    </View>

                    <View style={[styles.metaCol, styles.metaColRight]}>
                        <View style={styles.metaHeader}>
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} color={theme.colors.textSecondary} />
                            <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>FINISH</Text>
                        </View>
                        <Text style={[styles.metaValue, { color: theme.colors.text }]} numberOfLines={1}>
                             {isClockedIn && predictedEndTime ? format(predictedEndTime, 'h:mm a') : '--:--'}
                        </Text>
                    </View>
                </View>

                {/* --- FOOTER: Period Progress (Conditional) --- */}
                {showPeriodTarget && periodData && (
                    <View style={[styles.footerSection, { backgroundColor: theme.colors.background + '60', borderTopColor: theme.colors.border }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <HugeiconsIcon icon={Calendar03Icon} size={12} color={theme.colors.primary} />
                                <Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', color: theme.colors.textSecondary, marginLeft: 6, textTransform: 'uppercase' }}>
                                    {periodData.label}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 10, fontFamily: 'Nunito_700Bold', color: theme.colors.text }}>
                                <Text style={{ color: theme.colors.primary }}>{periodData.currentFormatted}</Text>
                                <Text style={{ color: theme.colors.textSecondary }}> / {periodData.targetFormatted}</Text>
                            </Text>
                        </View>
                        
                        <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' }}>
                            <AnimatedView style={[{ height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 }, animatedPeriodBarProps]} />
                        </View>
                    </View>
                )}

            </AnimatedView>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    card: { 
        borderRadius: 24, 
        borderWidth: 1.5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        overflow: 'hidden'
    },
    topSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        paddingBottom: 16
    },
    statusBadge: {
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 8, 
        paddingVertical: 4, 
        borderRadius: 6, 
        alignSelf: 'flex-start',
        marginBottom: 6
    },
    statusText: {
        fontSize: 10, 
        fontFamily: 'Nunito_700Bold',
        letterSpacing: 0.5, 
        marginLeft: 4,
        textTransform: 'uppercase'
    },
    labelSmall: {
        fontSize: 10,
        fontFamily: 'Nunito_700Bold',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 0,
        opacity: 0.6
    },
    timerText: {
        fontSize: 32,
        fontFamily: 'Nunito_700Bold',
        fontVariant: ['tabular-nums'],
        letterSpacing: -1,
        lineHeight: 38
    },
    unitText: {
        fontSize: 16,
        fontFamily: 'Nunito_600SemiBold',
        opacity: 0.5
    },
    countdownBadge: {
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center'
    },
    countdownLabel: { fontSize: 9, fontFamily: 'Nunito_700Bold', marginBottom: 2 },
    countdownValue: { fontSize: 16, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] },
    dividerLine: { height: 1, width: '100%', opacity: 0.1 },
    gridSection: {
        flexDirection: 'row',
        paddingVertical: 14,
        paddingHorizontal: 8
    },
    metaCol: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 40
    },
    metaColCenter: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(150,150,150,0.1)'
    },
    metaColRight: {},
    metaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, opacity: 0.7 },
    metaLabel: { fontSize: 9, fontFamily: 'Nunito_700Bold', marginLeft: 4, textTransform: 'uppercase' },
    metaValue: { fontSize: 13, fontFamily: 'Nunito_700Bold', fontVariant: ['tabular-nums'] },
    footerSection: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1
    }
});

export default DailySummaryCard;