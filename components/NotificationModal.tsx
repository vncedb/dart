import { CheckmarkCircle02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import { FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ModalHeader from './ModalHeader';

interface NotificationItem {
    id: string;
    title: string;
    body: string;
    date: number; // timestamp
    read: boolean;
}

interface NotificationModalProps {
    visible: boolean;
    onClose: () => void;
    notifications: NotificationItem[];
    onMarkAllRead: () => void;
    theme: any;
}

export default function NotificationModal({ visible, onClose, notifications, onMarkAllRead, theme }: NotificationModalProps) {
    const insets = useSafeAreaInsets();

    const unreadCount = notifications.filter(n => !n.read).length;

    const renderItem = ({ item }: { item: NotificationItem }) => (
        <TouchableOpacity 
            activeOpacity={0.7}
            style={[
                styles.itemContainer, 
                { 
                    backgroundColor: item.read ? theme.colors.background : theme.colors.primary + '08', // Very subtle tint for unread
                    borderBottomColor: theme.colors.border 
                }
            ]}
        >
            <View style={styles.itemContent}>
                {/* Unread Indicator */}
                <View style={[
                    styles.unreadDot, 
                    { backgroundColor: item.read ? 'transparent' : theme.colors.primary } 
                ]} />
                
                <View style={{ flex: 1 }}>
                    <View style={styles.itemHeader}>
                        <Text style={[styles.itemTitle, { color: theme.colors.text }]}>
                            {item.title}
                        </Text>
                        <Text style={[styles.itemDate, { color: theme.colors.textSecondary }]}>
                            {formatDistanceToNow(item.date, { addSuffix: true })}
                        </Text>
                    </View>
                    <Text 
                        numberOfLines={3} 
                        style={[styles.itemBody, { color: theme.colors.textSecondary }]}
                    >
                        {item.body}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    // Footer component shown at the bottom of the list
    const renderFooter = () => {
        if (notifications.length === 0) return null; // Empty state handles the empty case
        
        return (
            <View style={styles.footerContainer}>
                <View style={[styles.footerLine, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                    No more notifications
                </Text>
                <View style={[styles.footerLine, { backgroundColor: theme.colors.border }]} />
            </View>
        );
    };

    return (
        <Modal 
            visible={visible} 
            animationType="slide" 
            transparent={true} 
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                {/* Close modal when tapping backdrop */}
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                
                <View style={[
                    styles.sheet, 
                    { 
                        backgroundColor: theme.colors.background, 
                        paddingBottom: Math.max(insets.bottom, 20) 
                    }
                ]}>
                    
                    {/* Reusable Header */}
                    <ModalHeader 
                        title="Notifications"
                        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'No new notifications'}
                        position="bottom"
                        onClose={onClose}
                    />

                    {/* Actions Bar */}
                    {notifications.length > 0 && (
                        <View style={[styles.actionBar, { borderBottomColor: theme.colors.border }]}>
                            <TouchableOpacity 
                                onPress={onMarkAllRead} 
                                style={[styles.markReadBtn, { backgroundColor: theme.colors.card }]}
                            >
                                <HugeiconsIcon icon={Tick02Icon} size={16} color={theme.colors.primary} />
                                <Text style={[styles.markReadText, { color: theme.colors.primary }]}>
                                    Mark all as read
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* List */}
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListFooterComponent={renderFooter}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.card }]}>
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={40} color={theme.colors.textSecondary} />
                                </View>
                                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>All caught up!</Text>
                                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                                    You have no new notifications at this time.
                                </Text>
                            </View>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        marginTop: Platform.OS === 'ios' ? 60 : 80,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        maxHeight: '90%', 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    actionBar: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        borderBottomWidth: 1,
    },
    markReadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    markReadText: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    listContent: {
        flexGrow: 1,
    },
    itemContainer: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        marginRight: 12,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '700',
        flex: 1,
        marginRight: 8,
    },
    itemDate: {
        fontSize: 11,
        fontWeight: '500',
    },
    itemBody: {
        fontSize: 14,
        lineHeight: 20,
    },
    // Footer Styles
    footerContainer: {
        paddingVertical: 24,
        paddingHorizontal: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        opacity: 0.6,
    },
    footerLine: {
        height: 1,
        flex: 1,
        maxWidth: 40,
    },
    footerText: {
        fontSize: 12,
        fontWeight: '500',
    },
    // Empty State Styles
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 40,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    }
});