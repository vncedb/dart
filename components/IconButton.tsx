// filepath: components/IconButton.tsx
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface IconButtonProps {
    icon: any;
    onPress?: () => void;
    variant?: 'circle' | 'rounded';
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    size?: number;
    style?: ViewStyle | ViewStyle[];
    disabled?: boolean;
}

export default function IconButton({
    icon,
    onPress,
    variant = 'rounded',
    color,
    backgroundColor,
    borderColor,
    size = 20,
    style,
    disabled
}: IconButtonProps) {
    const theme = useAppTheme();
    
    const btnColor = color || theme.colors.text;
    const btnBg = backgroundColor || theme.colors.background;
    const btnBorder = borderColor || theme.colors.border;
    
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[
                styles.container,
                {
                    backgroundColor: btnBg,
                    borderColor: btnBorder,
                    borderRadius: variant === 'circle' ? 999 : 12,
                    opacity: disabled ? 0.5 : 1
                },
                style
            ]}
        >
            <HugeiconsIcon icon={icon} size={size} color={btnColor} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 40,
        height: 40,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }
});