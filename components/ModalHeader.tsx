import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    onClose?: () => void;
    position?: 'center' | 'bottom';
}

export default function ModalHeader({ 
    title, 
    subtitle, 
    onClose, 
    position = 'center' 
}: ModalHeaderProps) {
    const theme = useAppTheme();
    
    // Bottom Modals: Left aligned title, Close button on right.
    // Center Modals: Center aligned title, No close button (usually Cancel in footer).
    
    return (
        <View style={[
            styles.container, 
            { borderBottomColor: theme.colors.border }
        ]}>
            <View style={[
                styles.textContainer,
                position === 'center' ? styles.centeredText : styles.leftText
            ]}>
                <Text style={[
                    styles.title, 
                    { color: theme.colors.text, textAlign: position === 'center' ? 'center' : 'left' }
                ]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={[
                        styles.subtitle, 
                        { color: theme.colors.textSecondary, textAlign: position === 'center' ? 'center' : 'left' }
                    ]}>
                        {subtitle}
                    </Text>
                )}
            </View>

            {/* Close Button only for Bottom Modals */}
            {position === 'bottom' && onClose && (
                <TouchableOpacity 
                    onPress={onClose} 
                    style={[styles.closeBtn, { backgroundColor: theme.colors.background }]}
                >
                    <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        minHeight: 70,
    },
    textContainer: {
        flex: 1,
    },
    centeredText: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    leftText: {
        alignItems: 'flex-start',
        paddingRight: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    closeBtn: {
        padding: 8,
        borderRadius: 50,
    }
});