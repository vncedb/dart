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
    
    const [mode, setMode] = useState<'greeting' | 'quote'>('greeting');
    const [currentQuote, setCurrentQuote] = useState(GREETINGS[0]);

    const timeContent = useMemo(() => {
        if (customGreeting) {
            return { icon: Coffee02Icon, text: customGreeting };
        }
        const hour = new Date().getHours();
        if (hour < 5) return { icon: Moon02Icon, text: "Good Early Morning" };
        if (hour < 12) return { icon: Sun03Icon, text: "Good Morning" };
        if (hour < 18) return { icon: Sun03Icon, text: "Good Afternoon" };
        return { icon: Moon02Icon, text: "Good Evening" };
    }, [customGreeting]); 

    useEffect(() => {
        const interval = setInterval(() => {
            if (!alertVisible) {
                setMode(prev => {
                    if (prev === 'greeting') {
                        setCurrentQuote(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
                        return 'quote';
                    } else {
                        return 'greeting';
                    }
                });
            }
        }, 10000); 
        return () => clearInterval(interval);
    }, [alertVisible]);

    useEffect(() => {
        if (alertVisible && onHideAlert) {
            setMode('greeting'); 
            const timer = setTimeout(onHideAlert, 4000);
            return () => clearTimeout(timer);
        }
    }, [alertVisible, onHideAlert]);

    const getDisplayData = () => {
        if (alertVisible) {
            let icon, color, bg, title;
            switch (alertType) {
                case 'error': 
                    icon = AlertCircleIcon; color = theme.colors.danger; bg = theme.colors.dangerLight; title = 'Error'; break;
                case 'check-in': 
                    icon = Login03Icon; color = theme.colors.success; bg = theme.colors.successLight; title = 'Time In Success'; break;
                case 'check-out': 
                    icon = Logout03Icon; color = theme.colors.warning; bg = theme.colors.warningLight; title = 'Time Out Success'; break;
                case 'success': default: 
                    icon = CheckmarkCircle02Icon; color = theme.colors.success; bg = theme.colors.successLight; title = 'Success'; break;
            }
            return { key: 'alert', icon, color, bg, title, subtitle: alertMessage, borderColor: color };
        } else if (mode === 'quote') {
            return { 
                key: 'quote', 
                // FIX: Use currentQuote.icon, fallback to Sparkles if undefined
                icon: currentQuote.icon || SparklesIcon, 
                color: theme.colors.primary, 
                bg: theme.colors.primaryLight, 
                title: '', 
                // FIX: Must pass a string to subtitle, not the object
                subtitle: currentQuote.text,
                borderColor: theme.colors.border 
            };
        } else {
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

    const handlePress = () => {
        Haptics.selectionAsync();
        if (alertVisible && onHideAlert) {
            onHideAlert();
        } else {
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
                <Animated.View style={[styles.iconWrapper, { backgroundColor: data.bg }]} layout={LinearTransition.springify()}>
                    {/* FIX: Ensure we use currentQuote.text for the key to avoid object-to-string conversion errors */}
                    <Animated.View key={data.key + (mode === 'quote' ? currentQuote.text : '')} entering={ZoomIn.duration(300)} exiting={ZoomOut.duration(300)}>
                        <HugeiconsIcon icon={data.icon as any} size={20} color={data.color} />
                    </Animated.View>
                </Animated.View>

                <View style={styles.textWrapper}>
                    <Animated.View key={data.key + (mode === 'quote' ? currentQuote.text : '')} entering={FadeIn.duration(400).delay(100)} exiting={FadeOut.duration(300)} style={styles.textContainer}>
                        {data.key === 'quote' ? (
                            <View style={{ justifyContent: 'center', alignItems: 'flex-start', paddingVertical: 4 }}>
                                <Text style={[styles.quoteText, { color: theme.colors.text }]} numberOfLines={2}>
                                    “{data.subtitle}”
                                </Text>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'flex-start', justifyContent: 'center' }}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%', alignItems: 'center', marginBottom: 32, paddingHorizontal: 24 },
    bar: { flexDirection: 'row', alignItems: 'center', padding: 6, paddingRight: 16, borderRadius: 24, width: '100%', maxWidth: 380, height: 64, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
    iconWrapper: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    textWrapper: { flex: 1, justifyContent: 'center' },
    textContainer: { justifyContent: 'center', width: '100%' },
    label: { fontSize: 10, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
    mainText: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.2 },
    quoteText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', lineHeight: 18, fontStyle: 'italic', textAlign: 'left', paddingRight: 6 }
});