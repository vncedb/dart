import {
    AlertCircleIcon,
    CheckmarkCircle02Icon,
    Coffee02Icon,
    Login03Icon,
    Logout03Icon,
    Moon02Icon,
    SparklesIcon,
    Sun03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    LinearTransition,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';

import { GREETINGS } from '../constants/Greetings';
import { useAppTheme } from '../constants/theme';

type AlertType = 'success' | 'error' | 'check-in' | 'check-out';

interface DynamicBarProps {
    nameToDisplay: string;
    alertVisible?: boolean;
    alertMessage?: string;
    alertType?: AlertType;
    onHideAlert?: () => void;
    customGreeting?: string | null;
    shiftStartTime?: string | null;
}

const getShiftCycleKey = (date: Date, shiftStartTime?: string | null) => {
    const cycleDate = new Date(date);

    if (shiftStartTime) {
        const [hourString, minuteString] = shiftStartTime.split(':');
        const shiftHour = Number(hourString);
        const shiftMinute = Number(minuteString);

        if (!Number.isNaN(shiftHour) && !Number.isNaN(shiftMinute)) {
            const boundary = new Date(date);
            boundary.setHours(shiftHour, shiftMinute, 0, 0);

            if (date.getTime() < boundary.getTime()) {
                cycleDate.setDate(cycleDate.getDate() - 1);
            }
        }
    }

    return [
        cycleDate.getFullYear(),
        String(cycleDate.getMonth() + 1).padStart(2, '0'),
        String(cycleDate.getDate()).padStart(2, '0'),
    ].join('-');
};

const hashString = (value: string) => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

export default function DynamicBar({
    nameToDisplay,
    alertVisible = false,
    alertMessage = '',
    alertType = 'success',
    onHideAlert,
    customGreeting = null,
    shiftStartTime = null,
}: DynamicBarProps) {
    const theme = useAppTheme();

    const [mode, setMode] = useState<'greeting' | 'quote'>('greeting');
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (alertVisible && onHideAlert) {
            setMode('greeting');
            const timer = setTimeout(onHideAlert, 4000);
            return () => clearTimeout(timer);
        }
    }, [alertVisible, onHideAlert]);

    const timeContent = useMemo(() => {
        if (customGreeting) {
            return { icon: Coffee02Icon, text: customGreeting };
        }

        const hour = now.getHours();
        if (hour < 5) return { icon: Moon02Icon, text: 'Good Early Morning' };
        if (hour < 12) return { icon: Sun03Icon, text: 'Good Morning' };
        if (hour < 18) return { icon: Sun03Icon, text: 'Good Afternoon' };
        return { icon: Moon02Icon, text: 'Good Evening' };
    }, [customGreeting, now]);

    const currentQuote = useMemo(() => {
        const cycleKey = getShiftCycleKey(now, shiftStartTime);
        const quoteIndex = hashString(`${cycleKey}-${nameToDisplay}`) % GREETINGS.length;
        return GREETINGS[quoteIndex];
    }, [nameToDisplay, now, shiftStartTime]);

    const getDisplayData = () => {
        if (alertVisible) {
            let icon;
            let color;
            let bg;
            let title;
            const isOvertimeCheckIn = alertType === 'check-in' && alertMessage.toLowerCase().includes('overtime');

            switch (alertType) {
                case 'error':
                    icon = AlertCircleIcon;
                    color = theme.colors.danger;
                    bg = theme.colors.dangerLight;
                    title = 'Error';
                    break;
                case 'check-in':
                    icon = Login03Icon;
                    color = isOvertimeCheckIn ? '#f59e0b' : theme.colors.success;
                    bg = isOvertimeCheckIn ? theme.colors.warningLight : theme.colors.successLight;
                    title = isOvertimeCheckIn ? 'Overtime Started' : 'Time In Success';
                    break;
                case 'check-out':
                    icon = Logout03Icon;
                    color = theme.colors.warning;
                    bg = theme.colors.warningLight;
                    title = 'Time Out Success';
                    break;
                case 'success':
                default:
                    icon = CheckmarkCircle02Icon;
                    color = theme.colors.success;
                    bg = theme.colors.successLight;
                    title = 'Success';
                    break;
            }

            return { key: 'alert', icon, color, bg, title, subtitle: alertMessage, borderColor: color };
        }

        if (mode === 'quote') {
            return {
                key: 'quote',
                icon: currentQuote.icon || SparklesIcon,
                color: theme.colors.primary,
                bg: theme.colors.primaryLight,
                title: '',
                subtitle: currentQuote.text.trim(),
                borderColor: theme.colors.border,
            };
        }

        return {
            key: 'greeting',
            icon: timeContent.icon,
            color: theme.colors.primary,
            bg: theme.colors.primaryLight,
            title: timeContent.text,
            subtitle: nameToDisplay,
            borderColor: theme.colors.border,
        };
    };

    const data = getDisplayData();
    const contentKey = `${data.key}-${data.key === 'quote' ? currentQuote.text : data.subtitle}`;

    const handlePress = () => {
        Haptics.selectionAsync();

        if (alertVisible && onHideAlert) {
            onHideAlert();
            return;
        }

        setMode((previousMode) => previousMode === 'greeting' ? 'quote' : 'greeting');
    };

    return (
        <Animated.View style={styles.container} layout={LinearTransition.duration(300)}>
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePress}
                style={[
                    styles.bar,
                    {
                        backgroundColor: theme.colors.card,
                        borderColor: data.borderColor,
                        shadowColor: theme.dark ? '#000' : data.borderColor,
                    },
                ]}
            >
                <View style={[styles.surfaceGlow, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.82)' }]} />

                <Animated.View
                    style={[
                        styles.iconWrapper,
                        {
                            backgroundColor: data.bg,
                            borderColor: theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
                        },
                    ]}
                    layout={LinearTransition.duration(300)}
                >
                    <Animated.View key={contentKey} entering={ZoomIn.duration(300)} exiting={ZoomOut.duration(300)}>
                        <HugeiconsIcon icon={data.icon as any} size={20} color={data.color} />
                    </Animated.View>
                </Animated.View>

                <View style={styles.textWrapper}>
                    <Animated.View
                        key={contentKey}
                        entering={FadeIn.duration(400).delay(100)}
                        exiting={FadeOut.duration(300)}
                        style={styles.textContainer}
                    >
                        {data.key === 'quote' ? (
                            <View style={styles.quoteWrapper}>
                                <Text style={[styles.quoteText, { color: theme.colors.text }]} numberOfLines={2}>
                                    <Text style={[styles.quoteMark, { color: theme.colors.primary }]}>{'"'}</Text>
                                    {data.subtitle}
                                    <Text style={[styles.quoteMark, { color: theme.colors.primary }]}>{'" '}</Text>
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.contentWrapper}>
                                <Text style={[styles.label, { color: alertVisible ? data.color : theme.colors.textSecondary, textAlign: 'left' }]}>
                                    {data.title}
                                </Text>
                                <Text style={[styles.mainText, { color: theme.colors.text, textAlign: 'left' }]} numberOfLines={1}>
                                    {data.subtitle}
                                </Text>
                            </View>
                        )}
                    </Animated.View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%', alignItems: 'center', marginBottom: 32, paddingHorizontal: 24 },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        paddingRight: 16,
        borderRadius: 30,
        width: '100%',
        maxWidth: 380,
        height: 64,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 5,
        overflow: 'hidden',
    },
    surfaceGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 20,
        opacity: 0.55,
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1,
    },
    textWrapper: { flex: 1, justifyContent: 'center' },
    textContainer: { justifyContent: 'center', width: '100%' },
    contentWrapper: { alignItems: 'flex-start', justifyContent: 'center' },
    quoteWrapper: { justifyContent: 'center', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, width: '100%' },
    label: {
        fontSize: 10,
        fontFamily: 'Nunito_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    mainText: { fontSize: 16, fontFamily: 'Nunito_700Bold', letterSpacing: -0.2 },
    quoteText: {
        fontSize: 13,
        fontFamily: 'Nunito_700Bold',
        lineHeight: 19,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingRight: 10,
    },
    quoteMark: {
        fontSize: 14,
        lineHeight: 19,
        fontFamily: 'Nunito_800ExtraBold',
    },
});
