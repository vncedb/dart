import { Delete02Icon, Edit02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ActivityTimelineProps {
    timelineData: any[];
    theme: any;
    onEditTask: (task: any) => void;
    onDeleteTask: (task: any) => void;
    isLoading?: boolean;
}

const ActivityTimeline = ({ timelineData, theme, onEditTask, onDeleteTask, isLoading = false }: ActivityTimelineProps) => {
    
    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
        );
    }

    if (timelineData.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No activity recorded for this day.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {timelineData.map((item, index) => {
                const isLast = index === timelineData.length - 1;
                
                if (item.type === 'check-in' || item.type === 'check-out') {
                    const isCheckIn = item.type === 'check-in';
                    const color = isCheckIn ? theme.colors.success : (item.isOvertime ? '#F59E0B' : theme.colors.primary);
                    
                    return (
                        <View key={`${item.type}-${index}`} style={styles.row}>
                            <View style={styles.leftCol}>
                                <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                    {format(new Date(item.time), 'h:mm a')}
                                </Text>
                            </View>
                            <View style={styles.timelineCol}>
                                <View style={[styles.dot, { backgroundColor: color, borderColor: theme.colors.card }]} />
                                {!isLast && <View style={[styles.line, { backgroundColor: theme.colors.border }]} />}
                            </View>
                            <View style={[styles.rightCol, { paddingBottom: isLast ? 0 : 24 }]}>
                                <Text style={[styles.titleText, { color: theme.colors.text }]}>
                                    {isCheckIn ? 'Clocked In' : 'Clocked Out'}
                                </Text>
                                {item.isOvertime && (
                                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>
                                        Overtime Session
                                    </Text>
                                )}
                            </View>
                        </View>
                    );
                }

                if (item.type === 'task') {
                    return (
                        <View key={`task-${item.data.id}`} style={styles.row}>
                            <View style={styles.leftCol}>
                                <Text style={[styles.timeText, { color: theme.colors.text }]}>
                                    {format(new Date(item.data.created_at), 'h:mm a')}
                                </Text>
                            </View>
                            <View style={styles.timelineCol}>
                                <View style={[styles.taskDot, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} />
                                {!isLast && <View style={[styles.line, { backgroundColor: theme.colors.border }]} />}
                            </View>
                            <View style={[styles.rightCol, { paddingBottom: isLast ? 0 : 24 }]}>
                                <View style={[styles.taskCard, { backgroundColor: theme.colors.background }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.taskTitle, { color: theme.colors.text }]}>{item.data.title}</Text>
                                        {item.data.description && (
                                            <Text numberOfLines={2} style={[styles.taskDesc, { color: theme.colors.textSecondary }]}>
                                                {item.data.description}
                                            </Text>
                                        )}
                                        {item.data.quantity > 0 && (
                                            <Text style={[styles.taskMeta, { color: theme.colors.primary }]}>
                                                {item.data.quantity} units
                                            </Text>
                                        )}
                                    </View>
                                    <View style={styles.taskActions}>
                                        <TouchableOpacity onPress={() => onEditTask(item.data)} style={styles.actionBtn}>
                                            <HugeiconsIcon icon={Edit02Icon} size={16} color={theme.colors.textSecondary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => onDeleteTask(item.data)} style={styles.actionBtn}>
                                            <HugeiconsIcon icon={Delete02Icon} size={16} color={theme.colors.danger} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                }
                return null;
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    row: {
        flexDirection: 'row',
    },
    leftCol: {
        width: 70,
        alignItems: 'flex-end',
        paddingRight: 12,
        paddingTop: 2,
    },
    timelineCol: {
        alignItems: 'center',
        width: 16,
    },
    rightCol: {
        flex: 1,
        paddingLeft: 12,
    },
    timeText: {
        fontSize: 13,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        zIndex: 1,
    },
    taskDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        zIndex: 1,
        marginTop: 4,
    },
    line: {
        width: 2,
        flex: 1,
        marginTop: -2,
        marginBottom: -2,
    },
    titleText: {
        fontSize: 15,
        fontWeight: '700',
    },
    taskCard: {
        padding: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    taskTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    taskDesc: {
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 4,
    },
    taskMeta: {
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
    },
    taskActions: {
        flexDirection: 'column',
        gap: 12,
        paddingLeft: 8,
    },
    actionBtn: {
        padding: 4,
    }
});

export default ActivityTimeline;