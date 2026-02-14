import { CheckmarkCircle02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { formatDistanceToNow } from 'date-fns';
import React, { useEffect } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    runOnJS,
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
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
    const translateY = useSharedValue(0);

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        if (visible) translateY.value = 0;
    }, [visible]);

    const close = () => {
        onClose();
    };

    // Drag-to-dismiss gesture configuration
    const pan = Gesture.Pan()
        .onChange((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            if (event.translationY > 100 || event.velocityY > 500) {
                runOnJS(close)();
            } else {
                translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
            }
        });

    const animatedSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

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
        if (notifications.length === 0) return null;
        
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

    // Unmount when not visible to ensure entry animations trigger correctly on re-mount
    if (!visible) return null;

    return (
        <Modal 
            transparent 
            visible={visible} 
            onRequestClose={close}
            animationType="none" 
            statusBarTranslucent
        >
            <GestureHandlerRootView style={styles.overlay}>
                {/* Backdrop Fade */}
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={styles.backdrop}
                >
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
                </Animated.View>

                {/* Draggable Sheet - Slide Up */}
                <Animated.View 
                    entering={SlideInDown.duration(400).easing(Easing.out(Easing.quad))} 
                    exiting={SlideOutDown.duration(300)}
                    style={styles.modalContainerWrapper}
                >
                    <Animated.View style={[
                        styles.sheet, 
                        { 
                            backgroundColor: theme.colors.background, 
                            paddingBottom: Math.max(insets.bottom, 20) 
                        },
                        animatedSheetStyle
                    ]}>
                        
                        {/* Header Area - Draggable (Allows dragging the modal down without blocking list scroll) */}
                        <GestureDetector gesture={pan}>
                            <View style={{ backgroundColor: theme.colors.background }}>
                                {/* Reusable Header */}
                                <ModalHeader 
                                    title="Notifications"
                                    subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'No new notifications'}
                                    position="bottom"
                                    onClose={close}
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
                            </View>
                        </GestureDetector>

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
                    </Animated.View>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { 
        flex: 1, 
        justifyContent: 'flex-end' 
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContainerWrapper: { 
        flex: 1, 
        justifyContent: 'flex-end' 
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        maxHeight: '90%', 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        width: '100%',
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