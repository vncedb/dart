import {
    Briefcase02Icon,
    Calendar03Icon,
    Clock01Icon,
    DollarCircleIcon,
    Menu01Icon, // Used Menu01Icon as requested
    Target02Icon,
    UserGroupIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AVAILABLE_JOB_FIELDS } from './EditDisplayModal';

const shadowStyle = Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 }
});

const DetailRow = ({ label, value, icon, theme }: any) => (
    <View style={styles.detailRow}>
        <View style={[styles.detailIconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
            <HugeiconsIcon icon={icon} size={14} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>{label}</Text>
            <Text style={[styles.detailValue, { color: theme.colors.text }]} numberOfLines={1}>{value}</Text>
        </View>
    </View>
);

export default function JobCard({ currentJob, visibleKeys, theme, onEdit }: any) {
    if (!currentJob) return null;

    const formatPay = (val: number | string) => { 
        const num = Number(val); 
        return isNaN(num) ? val : `₱${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; 
    };
    
    const getCutoffLabel = (val: string) => { 
        if (!val) return 'Not Set'; 
        switch(val) { 
            case 'Semi-Monthly': return '15th & 30th'; 
            case 'Weekly': return 'Every Friday'; 
            case 'Monthly': return 'End of Month'; 
            case 'Bi-Weekly': return 'Every 2 Weeks';
            default: return val; 
        } 
    };
    
    const getDetailValue = (key: string) => { 
        switch(key) { 
            case 'employment_status': return currentJob.employment_status || 'Regular'; 
            case 'rate': return formatPay(currentJob.rate || currentJob.salary); 
            case 'rate_type': return currentJob.rate_type ? currentJob.rate_type.charAt(0).toUpperCase() + currentJob.rate_type.slice(1) : 'Hourly'; 
            case 'shift': return currentJob.work_schedule ? `${currentJob.work_schedule.start} - ${currentJob.work_schedule.end}` : 'N/A'; 
            case 'payroll': return getCutoffLabel(currentJob.payout_type || currentJob.cutoff_config?.type); 
            case 'breaks': return currentJob.break_schedule && currentJob.break_schedule.length > 0 ? `${currentJob.break_schedule.length} Break(s)` : 'None';
            case 'period_target': {
                const mins = Number(currentJob.period_target);
                if (!mins || isNaN(mins)) return 'Not Set';
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return `${h} hrs${m > 0 ? ` ${m} mins` : ''}`;
            }
            default: return 'N/A'; 
        } 
    };

    const getIcon = (key: string) => { 
        switch(key) { 
            case 'rate': return DollarCircleIcon; 
            case 'shift': return Clock01Icon; 
            case 'payroll': return Calendar03Icon; 
            case 'employment_status': return Briefcase02Icon;
            case 'period_target': return Target02Icon;
            default: return UserGroupIcon; 
        } 
    };
    
    const getDetailLabel = (key: string) => AVAILABLE_JOB_FIELDS.find(f => f.key === key)?.label || key;

    return (
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.accentStrip, { backgroundColor: theme.colors.primary }]} />

            <View style={[styles.cardHeader, { borderBottomColor: theme.colors.border }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.jobTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {currentJob.title}
                    </Text>
                    <View style={styles.companyRow}>
                        {/* <HugeiconsIcon icon={Building03Icon} size={14} color={theme.colors.textSecondary} /> */}
                        <Text style={[styles.companyName, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                            {currentJob.company || currentJob.company_name || 'No Company Details'}
                        </Text>
                    </View>
                </View>
                
                {/* Menu01Icon with "Edit Button" Style */}
                <TouchableOpacity 
                    onPress={onEdit} 
                    style={[styles.iconButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                >
                    <HugeiconsIcon icon={Menu01Icon} size={18} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.cardContent}>
                {visibleKeys.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No details visible.</Text>
                        <TouchableOpacity onPress={onEdit}>
                            <Text style={[styles.linkText, { color: theme.colors.primary }]}>Configure View</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.gridContainer}>
                        {visibleKeys.map((key: string) => (
                            <View key={key} style={styles.gridItem}>
                                <DetailRow 
                                    label={getDetailLabel(key)} 
                                    value={getDetailValue(key)} 
                                    icon={getIcon(key)} 
                                    theme={theme} 
                                />
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { 
        borderRadius: 20, 
        borderWidth: 1, 
        overflow: 'hidden', 
        marginVertical: 4,
        ...shadowStyle 
    },
    accentStrip: {
        width: '100%',
        height: 4,
        opacity: 0.85
    },
    cardHeader: { 
        padding: 20, 
        flexDirection: 'row', 
        alignItems: 'flex-start', 
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)'
    },
    jobTitle: { 
        fontSize: 18, 
        fontFamily: 'Nunito_700Bold', 
        marginBottom: 4,
        letterSpacing: -0.2
    },
    companyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: 0.8,
        paddingRight: 20,
    },
    companyName: { 
        fontSize: 13, 
        fontFamily: 'Nunito_600SemiBold',
    },
    // Matches the "Edit" button style from My Jobs
    iconButton: { 
        padding: 8, 
        borderRadius: 12, 
        borderWidth: 1, 
        alignItems: 'center', 
        justifyContent: 'center'
    },
    cardContent: { 
        padding: 20,
        paddingTop: 16
    },
    gridContainer: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        marginHorizontal: -8 
    },
    gridItem: { 
        width: '50%', 
        paddingHorizontal: 8, 
        marginBottom: 20 
    },
    detailRow: { 
        flexDirection: 'row', 
        alignItems: 'flex-start',
        gap: 10
    },
    detailIconContainer: { 
        width: 28, 
        height: 28, 
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    detailLabel: { 
        fontSize: 10, 
        fontFamily: 'Nunito_600SemiBold', 
        textTransform: 'uppercase', 
        marginBottom: 1, 
        opacity: 0.6,
        letterSpacing: 0.5
    },
    detailValue: { 
        fontSize: 13, 
        fontFamily: 'Nunito_600SemiBold',
        letterSpacing: -0.2
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 12
    },
    emptyText: {
        fontSize: 13,
        fontFamily: 'Nunito_500Medium',
        marginBottom: 4
    },
    linkText: {
        fontSize: 13,
        fontFamily: 'Nunito_600SemiBold'
    }
});