import { ArrowUpDoubleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { addDays, format, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import React, { memo, useEffect, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    interpolateColor,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../constants/theme';
import AttendanceCalendar from './AttendanceCalendar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MemoizedCalendar = memo(AttendanceCalendar);

interface DynamicDateHeaderProps {
    selectedDate: Date;
    onSelectDate: (date: Date) => void;
    monthRecords: any[];
    isClockedIn: boolean;
    workedMinutes: number;
    dailyGoal: number;
}

export default function DynamicDateHeader({ 
    selectedDate, 
    onSelectDate, 
    monthRecords,
    isClockedIn,
    workedMinutes,
    dailyGoal
}: DynamicDateHeaderProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // --- Animations ---
    const expandAnim = useSharedValue(0);
    const progressAnim = useSharedValue(0);
    const bgBreath = useSharedValue(0);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        bgBreath.value = withRepeat(
            withTiming(1, { duration: 3000 }), 
            -1, 
            true
        );
    }, []);

    useEffect(() => {
        const goalMins = dailyGoal * 60;
        const percent = goalMins > 0 ? Math.min(workedMinutes / goalMins, 1) : 0;
        progressAnim.value = withTiming(percent, { duration: 1000 });
    }, [workedMinutes, dailyGoal]);

    // --- Actions ---

    const toggleExpand = () => {
        const target = !isExpanded;
        setIsExpanded(target);
        expandAnim.value = withSpring(target ? 1 : 0, {
            damping: 24, stiffness: 180, mass: 1.2, overshootClamping: false
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleDateSelect = (date: Date) => {
        onSelectDate(date);
        toggleExpand();
    };

    const changeDay = (direction: 'next' | 'prev') => {
        const newDate = direction === 'next' ? addDays(selectedDate, 1) : subDays(selectedDate, 1);
        onSelectDate(newDate);
        Haptics.selectionAsync();
    };

    // --- Gestures ---
    const swipeGesture = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
            if (isExpanded) return;
            if (e.translationX < -50) runOnJS(changeDay)('next');
            if (e.translationX > 50) runOnJS(changeDay)('prev');
        });

    // --- Styles ---

    const containerStyle = useAnimatedStyle(() => ({
        height: interpolate(expandAnim.value, [0, 1], [72, 540]),
        width: interpolate(expandAnim.value, [0, 1], [SCREEN_WIDTH - 40, SCREEN_WIDTH - 16]),
        borderRadius: interpolate(expandAnim.value, [0, 1], [36, 28]),
        backgroundColor: interpolateColor(
            bgBreath.value, 
            [0, 1], 
            [theme.colors.headerStart || theme.colors.primary, theme.colors.headerEnd || theme.colors.secondary]
        ),
    }));

    const collapsedContentStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandAnim.value, [0, 0.2], [1, 0]),
        transform: [{ scale: interpolate(expandAnim.value, [0, 0.5], [1, 0.9]) }],
        pointerEvents: isExpanded ? 'none' : 'auto',
    }));

    const expandedContentStyle = useAnimatedStyle(() => ({
        opacity: interpolate(expandAnim.value, [0.2, 1], [0, 1]),
        transform: [{ translateY: interpolate(expandAnim.value, [0, 1], [15, 0]) }], 
        zIndex: isExpanded ? 1 : -1,
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value * 100}%`,
        backgroundColor: isClockedIn ? '#10b981' : 'rgba(255,255,255,0.7)',
    }));

    const backdropAnimatedStyle = useAnimatedStyle(() => ({
        opacity: expandAnim.value 
    }));

    return (
        <>
            {isExpanded && (
                <Pressable onPress={toggleExpand} style={StyleSheet.absoluteFill}>
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }, backdropAnimatedStyle]} />
                </Pressable>
            )}

            <View style={{ position: 'absolute', top: insets.top + 5, alignItems: 'center', width: '100%', zIndex: 100 }}>
                <GestureDetector gesture={swipeGesture}>
                    <Pressable onPress={!isExpanded ? toggleExpand : undefined} activeOpacity={1}>
                        <Animated.View style={[styles.islandContainer, containerStyle]}>
                            
                            {/* 1. COLLAPSED VIEW */}
                            <Animated.View style={[styles.collapsedContent, collapsedContentStyle]}>
                                <View style={styles.rowBetween}>
                                    <View>
                                        <Text style={{ color: theme.colors.headerText, fontWeight: '800', fontSize: 16 }}>
                                            {format(selectedDate, 'MMMM d')}
                                        </Text>
                                        {/* Updated: Font Size 12 to match AM/PM */}
                                        <Text style={{ color: theme.colors.headerText, fontSize: 12, fontWeight: '700', marginTop: 2, opacity: 0.8 }}>
                                            {format(selectedDate, 'yyyy')}
                                        </Text>
                                    </View>
                                    
                                    <View style={{ alignItems: 'flex-end' }}>
                                        {/* Removed Status Dot */}
                                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                            <Text style={{ color: theme.colors.headerText, fontSize: 30, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                                                {format(currentTime, 'h:mm')}
                                            </Text>
                                            <Text style={{ color: theme.colors.headerText, fontSize: 12, fontWeight: '800', marginLeft: 4 }}>
                                                {format(currentTime, 'a')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                
                                <View style={styles.progressBarContainer}>
                                    <Animated.View style={[styles.progressBarFill, progressBarStyle]} />
                                </View>
                            </Animated.View>

                            {/* 2. EXPANDED VIEW */}
                            <Animated.View style={[StyleSheet.absoluteFill, { padding: 16 }, expandedContentStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
                                <MemoizedCalendar 
                                    records={monthRecords} 
                                    selectedDate={selectedDate} 
                                    onSelectDate={handleDateSelect} 
                                    onMonthChange={() => {}} 
                                    showDetails={false} 
                                />
                                <TouchableOpacity onPress={toggleExpand} style={styles.closeHandle} activeOpacity={0.7}>
                                    <HugeiconsIcon icon={ArrowUpDoubleIcon} size={24} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                            </Animated.View>

                        </Animated.View>
                    </Pressable>
                </GestureDetector>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    islandContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 12,
    },
    collapsedContent: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 24,
        alignItems: 'center',
        marginBottom: 6
    },
    progressBarContainer: {
        position: 'absolute',
        bottom: 0,
        width: '30%',
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0,0,0,0.1)', 
        overflow: 'hidden',
        marginBottom: 8
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    closeHandle: {
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4
    }
});