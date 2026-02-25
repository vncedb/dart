import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface ListButtonProps extends TouchableOpacityProps {
    title: string;
    subtitle?: string;
    icon: any;
    iconColor?: string;
    iconBgColor?: string;
}

export default function ListButton({
    title,
    subtitle,
    icon,
    iconColor,
    iconBgColor,
    style,
    ...props
}: ListButtonProps) {
    const theme = useAppTheme();
    const finalIconColor = iconColor || theme.colors.primary;
    const finalIconBg = iconBgColor || (iconColor ? `${iconColor}15` : `${theme.colors.primary}15`);

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border
                },
                style
            ]}
            {...props}
        >
            <View style={[styles.iconBox, { backgroundColor: finalIconBg }]}>
                <HugeiconsIcon icon={icon} size={22} color={finalIconColor} />
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
                {subtitle && (
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        {subtitle}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
            android: { elevation: 1 }
        })
    },
    iconBox: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center'
    },
    title: {
        fontSize: 16,
        fontFamily: 'Nunito_700Bold',
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: 'Nunito_600SemiBold',
        opacity: 0.8
    }
});