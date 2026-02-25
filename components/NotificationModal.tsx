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
                    backgroundColor: item.read ? theme.colors.background : theme.colors.primary + '08',
                    borderBottomColor: theme.colors.border 
                }
            ]}
        >
            <View style={styles.itemContent}>
                <View style={[
                    styles.unreadDot, 
                    { backgroundColor: item.read ? 'transparent' : theme.colors.primary } 
                ]} />
                
                <View style={styles.textBlock}>
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

    const renderFooter = () => {
        if (notifications.length === 0) return null;
        return (
            <View style={styles.footerContainer}>
                <View style={[styles.footerLine, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                    End of notifications
                </Text>
                <View style={[styles.footerLine, { backgroundColor: theme.colors.border }]} />
            </View>
        );
    };

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
                <Animated.View 
                    entering={FadeIn.duration(300)} 
                    exiting={FadeOut.duration(300)} 
                    style={styles.backdrop}
                >
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
                </Animated.View>

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
                        
                        <GestureDetector gesture={pan}>
                            <View style={{ backgroundColor: theme.colors.background }}>
                                {/* Drag Indicator Pill */}
                                <View style={styles.dragPillContainer}>
                                    <View style={[styles.dragPill, { backgroundColor: theme.colors.border }]} />
                                </View>

                                {/* Modal Header (Maintains your exact setup) */}
                                <ModalHeader 
                                    title="Notifications"
                                    subtitle={unreadCount > 0 ? `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'You are completely caught up.'}
                                    position="bottom"
                                    onClose={close}
                                />

                                {/* Action Bar */}
                                {notifications.length > 0 && (
                                    <View style={[styles.actionBar, { borderBottomColor: theme.colors.border }]}>
                                        <TouchableOpacity 
                                            onPress={onMarkAllRead} 
                                            disabled={unreadCount === 0}
                                            style={[
                                                styles.markReadBtn, 
                                                { 
                                                    backgroundColor: unreadCount > 0 ? theme.colors.primary + '15' : theme.colors.card,
                                                    borderWidth: 1,
                                                    borderColor: unreadCount > 0 ? theme.colors.primary + '30' : theme.colors.border
                                                }
                                            ]}
                                        >
                                            <HugeiconsIcon icon={Tick02Icon} size={14} color={unreadCount > 0 ? theme.colors.primary : theme.colors.textSecondary} />
                                            <Text style={[styles.markReadText, { color: unreadCount > 0 ? theme.colors.primary : theme.colors.textSecondary }]}>
                                                Mark all as read
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </GestureDetector>

                        <FlatList
                            data={notifications}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            ListFooterComponent={renderFooter}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={36} color={theme.colors.textSecondary} />
                                    </View>
                                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No New Alerts</Text>
                                    <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                                        When you receive notifications, they will securely appear here.
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
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalContainerWrapper: { 
        flex: 1, 
        justifyContent: 'flex-end' 
    },
    sheet: {
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
        maxHeight: '92%', 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 20,
        width: '100%',
    },
    dragPillContainer: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    dragPill: {
        width: 40,
        height: 5,
        borderRadius: 3,
        opacity: 0.5,
    },
    actionBar: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        borderBottomWidth: 1,
    },
    markReadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    markReadText: {
        fontSize: 13,
        fontFamily: 'Nunito_700Bold',
        marginLeft: 6,
    },
    listContent: {
        flexGrow: 1,
    },
    itemContainer: {
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
        marginRight: 14,
    },
    textBlock: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemTitle: {
        fontSize: 15,
        fontFamily: 'Nunito_800ExtraBold',
        flex: 1,
        marginRight: 12,
    },
    itemDate: {
        fontSize: 11,
        fontFamily: 'Nunito_600SemiBold',
    },
    itemBody: {
        fontSize: 14,
        fontFamily: 'Nunito_500Medium',
        lineHeight: 22,
    },
    footerContainer: {
        paddingVertical: 32,
        paddingHorizontal: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        opacity: 0.4,
    },
    footerLine: {
        height: 1,
        flex: 1,
        maxWidth: 60,
    },
    footerText: {
        fontSize: 12,
        fontFamily: 'Nunito_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Nunito_800ExtraBold',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        fontFamily: 'Nunito_500Medium',
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 20,
    }
});