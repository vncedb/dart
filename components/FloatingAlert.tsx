// components/FloatingAlert.tsx
import { AlertCircleIcon, Cancel01Icon, CheckmarkCircle02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../constants/theme';

export type AlertType = 'success' | 'error' | 'info' | 'warning';
export type AlertPosition = 'top' | 'bottom';

interface FloatingAlertProps {
    visible: boolean;
    message: string;
    type?: AlertType;
    position?: AlertPosition;
    actionLabel?: string;
    onAction?: () => void;
    onHide: () => void;
    duration?: number;
}

export default function FloatingAlert({ 
    visible, 
    message, 
    type = 'success', 
    position = 'top',
    actionLabel,
    onAction,
    onHide,
    duration = 4000
}: FloatingAlertProps) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible && duration > 0) {
            const timer = setTimeout(onHide, duration);
            return () => clearTimeout(timer);
        }
    }, [visible, duration, onHide]);

    if (!visible) return null;

    const getConfig = () => {
        switch (type) {
            case 'success': return { icon: CheckmarkCircle02Icon, color: theme.colors.success, bg: theme.colors.successLight };
            case 'error': return { icon: AlertCircleIcon, color: theme.colors.danger, bg: theme.colors.dangerLight };
            case 'warning': return { icon: AlertCircleIcon, color: theme.colors.warning, bg: theme.colors.warningLight };
            case 'info': default: return { icon: InformationCircleIcon, color: theme.colors.primary, bg: theme.colors.primaryLight };
        }
    };

    const config = getConfig();

    const positionStyle = position === 'top' 
        ? { top: insets.top + 16 } 
        : { bottom: insets.bottom + 24 };

    // Removed spring animations. Using smooth FadeIn/Out with Slide direction.
    const enteringAnim = position === 'top' ? FadeInUp.duration(300) : FadeInDown.duration(300);
    const exitingAnim = position === 'top' ? FadeOutUp.duration(300) : FadeOutDown.duration(300);

    return (
        <Animated.View 
            entering={enteringAnim}
            exiting={exitingAnim}
            style={[styles.container, positionStyle, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: theme.dark ? '#000' : config.color }]}
        >
            <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                <HugeiconsIcon icon={config.icon} size={18} color={config.color} />
            </View>
            
            <View style={styles.textContainer}>
                <Text style={[styles.message, { color: theme.colors.text }]} numberOfLines={2}>
                    {message}
                </Text>
            </View>

            {actionLabel && onAction && (
                <TouchableOpacity onPress={onAction} style={styles.actionButton} activeOpacity={0.7}>
                    <Text style={[styles.actionText, { color: config.color }]}>{actionLabel}</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity onPress={onHide} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <HugeiconsIcon icon={Cancel01Icon} size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        zIndex: 9999,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 8,
    },
    message: {
        fontSize: 14,
        fontFamily: 'Nunito_600SemiBold',
        lineHeight: 20,
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginLeft: 4,
    },
    actionText: {
        fontSize: 13,
        fontFamily: 'Nunito_800ExtraBold',
    },
    closeButton: {
        padding: 4,
        marginLeft: 8,
    }
});