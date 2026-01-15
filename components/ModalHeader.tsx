import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';

interface ModalHeaderProps {
    title: string;
    subtitle?: string;
    onClose?: () => void;
    align?: 'left' | 'center';
}

export default function ModalHeader({ 
    title, 
    subtitle, 
    onClose, 
    align 
}: ModalHeaderProps) {
    const theme = useAppTheme();
    
    // Auto-determine alignment if not specified: Left if subtitle exists, Center otherwise
    const effectiveAlign = align || (subtitle ? 'left' : 'center');

    return (
        <View style={[
            styles.container, 
            { borderBottomColor: theme.colors.border }
        ]}>
            <View style={[
                styles.textContainer, 
                effectiveAlign === 'center' && styles.centeredText
            ]}>
                <Text style={[styles.title, { color: theme.colors.text, textAlign: effectiveAlign }]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary, textAlign: effectiveAlign }]}>
                        {subtitle}
                    </Text>
                )}
            </View>

            {onClose && (
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
        paddingVertical: 20,
        flexDirection: 'row',
        alignItems: 'center', // Aligns items vertically
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        minHeight: 80,
    },
    textContainer: {
        flex: 1,
        paddingRight: 10,
    },
    centeredText: {
        alignItems: 'center',
        paddingRight: 0, 
        // We push the close button to absolute position or just rely on flex layout
        // For centered modals with a close button, it's often better to absolute position the close button 
        // to ensure true center of text, but flex space-between is usually sufficient.
    },
    title: {
        fontSize: 19,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
        lineHeight: 18,
    },
    closeBtn: {
        padding: 8,
        borderRadius: 50,
    }
});