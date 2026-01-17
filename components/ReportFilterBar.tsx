import {
    ArrowDown01Icon,
    Calendar03Icon,
    MoreVerticalCircle01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';
import { DateRange } from './ReportFilterModal';

interface ReportFilterBarProps {
    onPress: () => void;
    onCalendarPress: () => void;
    onMorePress: (event: any) => void;
    currentRange: DateRange | null;
}

const ReportFilterBar = ({ onPress, onCalendarPress, onMorePress, currentRange }: ReportFilterBarProps) => {
    const theme = useAppTheme();

    const getTitle = () => {
        switch (currentRange?.type) {
            case 'period': return 'Pay Period';
            case 'week': return 'This Week';
            case 'month': return 'This Month';
            case 'day': return 'Specific Date';
            default: return 'Custom Range';
        }
    };

    return (
        <View style={styles.container}>
            <View 
                style={[
                    styles.bar, 
                    { 
                        backgroundColor: theme.colors.card, 
                        borderColor: theme.colors.border 
                    }
                ]}
            >
                {/* Left: Calendar Button (Triggers Custom DatePicker) */}
                <TouchableOpacity 
                    onPress={onCalendarPress}
                    activeOpacity={0.7}
                    style={[styles.iconBox, { backgroundColor: theme.colors.primary + '15' }]}
                >
                    <HugeiconsIcon icon={Calendar03Icon} size={22} color={theme.colors.primary} />
                </TouchableOpacity>

                {/* Center: Filter Trigger */}
                <TouchableOpacity 
                    onPress={onPress}
                    activeOpacity={0.7}
                    style={styles.textContainer}
                >
                    {/* Label Row */}
                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                            {getTitle()}
                        </Text>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={14} color={theme.colors.textSecondary} />
                    </View>
                    
                    {/* Date Value */}
                    <Text style={[styles.dateText, { color: theme.colors.text }]}>
                        {currentRange?.label || 'Select Date'}
                    </Text>
                </TouchableOpacity>

                {/* Right: More Options */}
                <TouchableOpacity 
                    onPress={onMorePress}
                    style={[styles.iconBox, { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border }]}
                >
                    <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={22} color={theme.colors.text} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 6,
        borderRadius: 32,
        borderWidth: 1,
        // Elevation/Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    label: {
        fontSize: 10, // Fixed Font Size
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase', // Uppercase forced
    },
    dateText: {
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
});

export default React.memo(ReportFilterBar);