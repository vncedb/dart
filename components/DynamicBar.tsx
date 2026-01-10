import {
    AlertCircleIcon,
    CheckmarkCircle02Icon,
    Coffee02Icon,
    Login03Icon,
    Logout03Icon,
    Moon02Icon,
    SparklesIcon,
    Sun03Icon
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
    ZoomOut
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
}

export default function DynamicBar({ 
    nameToDisplay, 
    alertVisible = false, 
    alertMessage = "", 
    alertType = 'success',
    onHideAlert,
    customGreeting = null 
}: DynamicBarProps) {
    const theme = useAppTheme();
    
    // Internal State for Cycling
    const [mode, setMode] = useState<'greeting' | 'quote'>('greeting');
    const [currentQuote, setCurrentQuote] = useState(GREETINGS[0]);

    // --- 1. Determine Current Time-Based Content ---
    // We recalculate this on every render to ensure it's always fresh.
    const timeContent = useMemo(() => {
        if (customGreeting) {
            return { icon: Coffee02Icon, text: customGreeting };
        }
        const hour = new Date().getHours();
        if (hour < 5) return { icon: Moon02Icon, text: "Good Early Morning" };
        if (hour < 12) return { icon: Sun03Icon, text: "Good Morning" };
        if (hour < 18) return { icon: Sun03Icon, text: "Good Afternoon" };
        return { icon: Moon02Icon, text: "Good Evening" };
    }, [customGreeting, mode]); // Recalc when mode changes to keep time fresh

    // --- 2. Cycle Logic (Greeting <-> Quote) ---
    useEffect(() => {
        const interval = setInterval(() => {
            if (!alertVisible) {
                setMode(prev => {
                    if (prev === 'greeting') {
                        // Switch to Quote
                        setCurrentQuote(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
                        return 'quote';
                    } else {
                        // Switch back to Greeting
                        return 'greeting';
                    }
                });
            }
        }, 10000); // 10 Seconds per cycle
        return () => clearInterval(interval);
    }, [alertVisible]);

    // --- 3. Alert Auto-Hide ---
    useEffect(() => {
        if (alertVisible && onHideAlert) {
            // Reset to greeting mode silently when alert appears so it's ready when alert hides
            setMode('greeting'); 
            const timer = setTimeout(onHideAlert, 4000);
            return () => clearTimeout(timer);
        }
    }, [alertVisible, onHideAlert]);

    // --- 4. Determine What to Display ---
    const getDisplayData = () => {
        if (alertVisible) {
            // ALERT MODE
            let icon, color, bg, title;
            switch (alertType) {
                case 'error': 
                    icon = AlertCircleIcon; color = theme.colors.danger; bg = theme.colors.dangerLight; title = 'Error'; break;
                case 'check-in': 
                    icon = Login03Icon; color = theme.colors.success; bg = theme.colors.successLight; title = 'Check In Success'; break;
                case 'check-out': 
                    icon = Logout03Icon; color = theme.colors.warning; bg = theme.colors.warningLight; title = 'Check Out Success'; break;
                case 'success': default: 
                    icon = CheckmarkCircle02Icon; color = theme.colors.success; bg = theme.colors.successLight; title = 'Success'; break;
            }
            return { key: 'alert', icon, color, bg, title, subtitle: alertMessage, borderColor: color };
        } else if (mode === 'quote') {
            // QUOTE MODE
            return { 
                key: 'quote', 
                icon: SparklesIcon, 
                color: theme.colors.primary, 
                bg: theme.colors.primaryLight, 
                title: '', // No title for quotes, just the text centered
                subtitle: currentQuote,
                borderColor: theme.colors.border 
            };
        } else {
            // GREETING MODE
            return { 
                key: 'greeting', 
                icon: timeContent.icon, 
                color: theme.colors.primary, 
                bg: theme.colors.primaryLight, 
                title: timeContent.text, 
                subtitle: nameToDisplay,
                borderColor: theme.colors.border 
            };
        }
    };

    const data = getDisplayData();

    // --- Interaction ---
    const handlePress = () => {
        Haptics.selectionAsync();
        if (alertVisible && onHideAlert) {
            onHideAlert();
        } else {
            // Manual toggle
            setMode(prev => {
                if (prev === 'greeting') {
                    setCurrentQuote(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
                    return 'quote';
                }
                return 'greeting';
            });
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={handlePress}
                style={[
                    styles.bar, 
                    { 
                        backgroundColor: theme.colors.card, 
                        borderColor: data.borderColor,
                        shadowColor: theme.dark ? "#000" : data.borderColor 
                    }
                ]}
            >
                {/* ICON SECTION */}
                <Animated.View 
                    style={[styles.iconWrapper, { backgroundColor: data.bg }]} 
                    layout={LinearTransition.springify()}
                >
                    <Animated.View 
                        key={data.key} // Unique key ensures old icon unmounts and new one mounts
                        entering={ZoomIn.duration(300)} 
                        exiting={ZoomOut.duration(300)}
                    >
                        <HugeiconsIcon icon={data.icon} size={20} color={data.color} weight="duotone" />
                    </Animated.View>
                </Animated.View>

                {/* TEXT SECTION */}
                <View style={styles.textWrapper}>
                    <Animated.View 
                        key={data.key + (mode === 'quote' ? currentQuote : '')} // Ensure text updates animate
                        entering={FadeIn.duration(400).delay(100)} 
                        exiting={FadeOut.duration(300)}
                        style={styles.textContainer}
                    >
                        {data.key === 'quote' ? (
                            // Quote Layout (Centered)
                            <View style={{ justifyContent: 'center', height: '100%' }}>
                                <Text style={[styles.quoteText, { color: theme.colors.text }]}>
                                    "{data.subtitle}"
                                </Text>
                            </View>
                        ) : (
                            // Standard Layout (Title + Subtitle)
                            <View>
                                <Text style={[styles.label, { color: alertVisible ? data.color : theme.colors.textSecondary }]}>
                                    {data.title}
                                </Text>
                                <Text style={[styles.mainText, { color: theme.colors.text }]} numberOfLines={1}>
                                    {data.subtitle}
                                </Text>
                            </View>
                        )}
                    </Animated.View>
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 32,
        paddingHorizontal: 24,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        borderRadius: 99,
        width: '100%',
        maxWidth: 380,
        height: 60,
        borderWidth: 1,
        // Smooth Shadows
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    textWrapper: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
    },
    textContainer: {
        justifyContent: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    mainText: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    quoteText: {
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
        fontStyle: 'italic',
    }
});