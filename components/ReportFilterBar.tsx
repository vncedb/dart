import {
    ArrowDown01Icon,
    Calendar03Icon,
    MoreVerticalCircle01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../constants/theme';
import { DateRange } from './ReportFilterModal';

interface ReportFilterBarProps {
    onPress: () => void;
    onCalendarPress: () => void;
    onMorePress: (event: any) => void;
    currentRange: DateRange | null;
    isCalendarLoading?: boolean;
}

const ReportFilterBar = ({ 
    onPress, 
    onCalendarPress, 
    onMorePress, 
    currentRange, 
    isCalendarLoading = false 
}: ReportFilterBarProps) => {
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
                {/* Left: Calendar Button */}
                <TouchableOpacity 
                    onPress={onCalendarPress}
                    activeOpacity={0.7}
                    disabled={isCalendarLoading}
                    style={[
                        styles.iconBox, 
                        { 
                            backgroundColor: theme.colors.background, 
                            borderWidth: 1, 
                            borderColor: theme.colors.border 
                        }
                    ]}
                >
                    {isCalendarLoading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.text} />
                    )}
                </TouchableOpacity>

                {/* Center: Filter Trigger */}
                <TouchableOpacity 
                    onPress={onPress}
                    activeOpacity={0.7}
                    style={styles.textContainer}
                >
                    <View style={styles.labelRow}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                            {getTitle()}
                        </Text>
                        <HugeiconsIcon icon={ArrowDown01Icon} size={14} color={theme.colors.textSecondary} />
                    </View>
                    
                    <Text style={[styles.dateText, { color: theme.colors.text }]} numberOfLines={1}>
                        {currentRange?.label || 'Select Date'}
                    </Text>
                </TouchableOpacity>

                {/* Right: More Options */}
                <TouchableOpacity 
                    onPress={onMorePress}
                    activeOpacity={0.7}
                    style={[
                        styles.iconBox, 
                        { 
                            backgroundColor: theme.colors.background, 
                            borderWidth: 1, 
                            borderColor: theme.colors.border 
                        }
                    ]}
                >
                    <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={20} color={theme.colors.text} />
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
        padding: 8,
        borderRadius: 100,
        borderWidth: 1,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
            android: { elevation: 3 }
        })
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    label: {
        fontSize: 10,
        fontFamily: 'Nunito_700Bold',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    dateText: {
        fontSize: 15,
        fontFamily: 'Nunito_700Bold',
        letterSpacing: -0.3,
    },
});

export default React.memo(ReportFilterBar);