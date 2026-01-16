import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    PressableProps,
    StyleSheet,
    Text,
    TextStyle,
    ViewStyle
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'neutral';

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
                // Indigo-600
                return { bg: theme.colors.primary, text: '#ffffff', border: 'transparent' };
            case 'secondary': 
                return { bg: theme.colors.card, text: theme.colors.text, border: theme.colors.border };
            case 'outline': 
                return { bg: 'transparent', text: theme.colors.text, border: theme.colors.border };
            case 'ghost': 
                return { bg: 'transparent', text: theme.colors.textSecondary, border: 'transparent' };
            case 'danger': 
                return { bg: '#ef4444', text: '#ffffff', border: 'transparent' }; 
            case 'neutral': 
                // Matches "Cancel" in account settings (Slate-100 / Slate-700)
                return { 
                    bg: theme.dark ? '#334155' : '#f1f5f9', 
                    text: theme.dark ? '#cbd5e1' : '#64748b', 
                    border: 'transparent' 
                };
            default: 
                return { bg: theme.colors.primary, text: '#ffffff', border: 'transparent' };
        }
    };

    const colors = getColors();

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const handlePressIn = () => {
        if (!disabled && !isLoading) scale.value = withSpring(0.98);
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
        height: 50, // Approx matching py-3
        borderRadius: 12, // rounded-xl
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    text: {
        fontSize: 15,
        fontWeight: '700',
    }
});