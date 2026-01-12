import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    TouchableOpacityProps,
    ViewStyle
} from 'react-native';
import { useAppTheme } from '../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: any; // Icon component or source
    isLoading?: boolean;
    fullWidth?: boolean;
}

export default function Button({
    title,
    variant = 'primary',
    size = 'md',
    icon,
    isLoading = false,
    fullWidth = false,
    style,
    disabled,
    ...props
}: ButtonProps) {
    const theme = useAppTheme();

    const getBackgroundColor = () => {
        if (disabled) return theme.colors.border;
        switch (variant) {
            case 'primary': return theme.colors.primary;
            case 'secondary': return theme.colors.card;
            case 'outline': return 'transparent';
            case 'ghost': return 'transparent';
            case 'danger': return '#ef444415';
            default: return theme.colors.primary;
        }
    };

    const getBorderColor = () => {
        if (variant === 'outline') return theme.colors.border;
        if (variant === 'secondary') return theme.colors.border;
        return 'transparent';
    };

    const getTextColor = () => {
        if (disabled) return theme.colors.textSecondary;
        switch (variant) {
            case 'primary': return '#ffffff';
            case 'secondary': return theme.colors.text;
            case 'outline': return theme.colors.text;
            case 'ghost': return theme.colors.text;
            case 'danger': return '#ef4444';
            default: return '#ffffff';
        }
    };

    const getHeight = () => {
        switch (size) {
            case 'sm': return 40;
            case 'lg': return 56;
            default: return 48;
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm': return 13;
            case 'lg': return 16;
            default: return 15;
        }
    };

    const containerStyle: ViewStyle = {
        height: getHeight(),
        backgroundColor: getBackgroundColor(),
        borderColor: getBorderColor(),
        borderWidth: (variant === 'outline' || variant === 'secondary') ? 1 : 0,
        borderRadius: size === 'lg' ? 28 : 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        width: fullWidth ? '100%' : 'auto',
        opacity: disabled ? 0.7 : 1,
        ...(variant === 'primary' ? styles.shadow : {}),
    };

    const textStyle: TextStyle = {
        color: getTextColor(),
        fontSize: getFontSize(),
        fontWeight: '700',
        marginLeft: (isLoading || icon) ? 8 : 0,
    };

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled || isLoading}
            style={[containerStyle, style]}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={getTextColor()} />
            ) : (
                <>
                    {icon && <HugeiconsIcon icon={icon} size={20} color={getTextColor()} />}
                    <Text style={textStyle}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    shadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    }
});