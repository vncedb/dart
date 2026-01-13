import { Cancel01Icon, CheckmarkCircle02Icon, Notification03Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { formatDistanceToNow } from 'date-fns';
import React from 'react';
import { FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

    const renderItem = ({ item }: { item: NotificationItem }) => (
        <View style={{ backgroundColor: item.read ? theme.colors.card : theme.colors.primary + '10', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: 'row', gap: 12 }}>
            <View style={{ marginTop: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: item.read ? 'transparent' : theme.colors.primary }} />
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 14 }}>{item.title}</Text>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>{formatDistanceToNow(item.date, { addSuffix: true })}</Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{item.body}</Text>
            </View>
        </View>
    );

    return (
        <Modal 
            visible={visible} 
            animationType="slide" 
            transparent={true} 
            // presentationStyle="pageSheet" <--- REMOVED to fix warning and allow transparency
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                {/* Close modal when tapping backdrop */}
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                
                <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: Platform.OS === 'android' ? 20 : 0 }]}>
                    
                    {/* Header */}
                    <View style={{ padding: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}>
                                <HugeiconsIcon icon={Notification03Icon} size={20} color={theme.colors.text} />
                            </View>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text }}>Notifications</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: theme.colors.card, borderRadius: 20 }}>
                            <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Actions */}
                    {notifications.length > 0 && (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 10 }}>
                            <TouchableOpacity onPress={onMarkAllRead} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <HugeiconsIcon icon={Tick02Icon} size={14} color={theme.colors.primary} />
                                <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Mark all as read</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* List */}
                    <FlatList
                        data={notifications}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                        ListEmptyComponent={
                            <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
                                <HugeiconsIcon icon={CheckmarkCircle02Icon} size={48} color={theme.colors.textSecondary} />
                                <Text style={{ marginTop: 16, color: theme.colors.textSecondary, fontWeight: '600' }}>No new notifications</Text>
                            </View>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: Platform.OS === 'ios' ? 60 : 100, // Adjusted top offset
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    }
});