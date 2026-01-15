import React from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    PressableProps,
    StyleSheet,
    Text,
    TextStyle,
    ViewStyle
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'cancel' | 'neutral';

interface ButtonProps extends PressableProps {
    title: string;
    variant?: ButtonVariant;
    isLoading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Button({
    title,
    variant = 'primary',
    isLoading = false,
    style,
    disabled,
    textStyle,
    icon,
    ...props
}: ButtonProps) {
    const theme = useAppTheme();
    const scale = useSharedValue(1);

    const getColors = () => {
        if (disabled) return { bg: theme.colors.border, text: theme.colors.textSecondary, border: 'transparent' };
        
        switch (variant) {
            case 'primary': 
                return { bg: theme.colors.primary, text: '#ffffff', border: 'transparent' };
            case 'secondary': 
                return { bg: theme.colors.card, text: theme.colors.text, border: theme.colors.border };
            case 'outline': 
                return { bg: 'transparent', text: theme.colors.text, border: theme.colors.border };
            case 'ghost': 
                return { bg: 'transparent', text: theme.colors.textSecondary, border: 'transparent' };
            case 'danger': 
                return { bg: '#fee2e2', text: '#ef4444', border: 'transparent' };
            case 'cancel': 
                // Light background, Red text (Destructive Cancel)
                return { bg: theme.colors.background, text: '#ef4444', border: 'transparent' };
            case 'neutral': 
                // Light background, Gray text (Standard Cancel like "Rename Break")
                return { bg: theme.colors.background, text: theme.colors.textSecondary, border: 'transparent' };
            default: 
                return { bg: theme.colors.primary, text: '#ffffff', border: 'transparent' };
        }
    };

    const colors = getColors();

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const handlePressIn = () => {
        if (!disabled && !isLoading) scale.value = withSpring(0.96);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || isLoading}
            style={[
                styles.container,
                {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0,
                },
                (variant === 'primary' && !disabled) && styles.shadow,
                animatedStyle,
                style
            ]}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
            ) : (
                <>
                    {icon}
                    <Text style={[
                        styles.text, 
                        { color: colors.text, marginLeft: icon ? 8 : 0 }, 
                        textStyle
                    ]}>
                        {title}
                    </Text>
                </>
            )}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 52, // Standard touch height
        borderRadius: 16, // Modern "Squircle" radius
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    text: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    shadow: {
        ...Platform.select({
            ios: { 
                shadowColor: '#000', 
                shadowOffset: { width: 0, height: 4 }, 
                shadowOpacity: 0.15, 
                shadowRadius: 8 
            },
            android: { 
                elevation: 3 
            }
        })
    }
});