import {
    ArrowLeft02Icon,
    ArrowRight01Icon,
    CheckmarkBadge01Icon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    Delete02Icon,
    File01Icon,
    LockKeyIcon,
    Logout01Icon,
    Notification01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format, formatDistanceToNow } from 'date-fns';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, Animated as RNAnimated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    LinearTransition,
    SlideInDown,
    SlideOutDown,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ModalHeader from './ModalHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NotificationItem {
    id: string;
    title: string;
    body: string;
    date?: number | string; 
    created_at?: string;
    read: boolean;
    type?: string;
}

interface NotificationModalProps {
    visible: boolean;
    onClose: () => void;
    notifications: NotificationItem[];
    onMarkAllRead: () => void;
    onMarkAsRead?: (id: string) => void;
    onDeleteNotification?: (id: string) => void;
    onActionPress?: (action: string, data?: any) => void;
    theme: any;
}

// Reusable Theme Generator for Notifications (Used in Detail View)
const getIconTheme = (item: NotificationItem, theme: any) => {
    const t = item.type || '';
    const title = item.title?.toLowerCase() || '';

    if (t === 'auto_timeout' || title.includes('timed out') || title.includes('checkout')) {
        return { icon: Logout01Icon, color: theme.colors.danger, bg: theme.colors.danger + '15' };
    }
    if (t === 'timeout_soon' || title.includes('time out soon')) {
        return { icon: Clock01Icon, color: '#F59E0B', bg: '#F59E0B15' };
    }
    if (t === 'report_ready' || title.includes("report's ready")) {
        return { icon: File01Icon, color: theme.colors.primary, bg: theme.colors.primary + '15' };
    }
    if (t === 'password_updated' || title.includes('password')) {
        return { icon: LockKeyIcon, color: theme.colors.success, bg: theme.colors.success + '15' };
    }
    return { icon: Notification01Icon, color: theme.colors.textSecondary, bg: theme.colors.border };
};

const NotificationRow = ({ 
    item, 
    theme, 
    onMarkAsRead, 
    onDeleteNotification,
    onPressItem,
    openRowId,
    setOpenRowId
}: any) => {
    const swipeableRef = useRef<Swipeable>(null);

    // Closes instantly when another row is opened
    useEffect(() => {
        if (openRowId !== item.id) {
            swipeableRef.current?.close();
        }
    }, [openRowId, item.id]);

    const handleMarkAsRead = () => {
        swipeableRef.current?.close();
        if (onMarkAsRead) onMarkAsRead(item.id);
    };

    const handleDelete = () => {
        swipeableRef.current?.close();
        if (onDeleteNotification) onDeleteNotification(item.id);
    };

    const renderLeftActions = (progress: any, dragX: any) => {
        if (item.read) return null; 
        const scale = dragX.interpolate({ inputRange: [0, 60], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
            <TouchableOpacity activeOpacity={0.8} onPress={handleMarkAsRead} style={[styles.leftAction, { backgroundColor: theme.colors.success }]}>
                <RNAnimated.View style={{ transform: [{ scale }] }}>
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} size={24} color="#FFF" />
                </RNAnimated.View>
            </TouchableOpacity>
        );
    };

    const renderRightActions = (progress: any, dragX: any) => {
        const scale = dragX.interpolate({ inputRange: [-60, 0], outputRange: [1, 0], extrapolate: 'clamp' });
        return (
            <TouchableOpacity activeOpacity={0.8} onPress={handleDelete} style={[styles.rightAction, { backgroundColor: theme.colors.danger }]}>
                <RNAnimated.View style={{ transform: [{ scale }] }}>
                    <HugeiconsIcon icon={Delete02Icon} size={24} color="#FFF" />
                </RNAnimated.View>
            </TouchableOpacity>
        );
    };

    const rawDate = item.date || item.created_at || Date.now();
    const formattedDate = formatDistanceToNow(new Date(rawDate), { addSuffix: true });

    return (
        // Moving Animated.View outside Swipeable fixes the flashing glitch on Android/iOS
        <Animated.View layout={LinearTransition.springify().damping(16)}>
            <Swipeable
                ref={swipeableRef}
                friction={1.5}
                leftThreshold={40}
                rightThreshold={40}
                overshootLeft={false}
                overshootRight={false}
                onSwipeableWillOpen={() => setOpenRowId(item.id)}
                renderLeftActions={item.read ? undefined : renderLeftActions}
                renderRightActions={renderRightActions}
                containerStyle={{ backgroundColor: theme.colors.background }}
            >
                <TouchableOpacity 
                    activeOpacity={0.7} 
                    onPress={() => onPressItem(item)}
                    style={[
                        styles.itemContainer, 
                        { 
                            backgroundColor: item.read ? theme.colors.background : theme.colors.primary + '05',
                            borderBottomColor: theme.colors.border 
                        }
                    ]}
                >
                    <View style={styles.itemContent}>
                        <View style={[styles.unreadDot, { backgroundColor: item.read ? 'transparent' : theme.colors.primary }]} />
                        
                        <View style={styles.textBlock}>
                            <View style={styles.itemHeader}>
                                <Text numberOfLines={1} style={[styles.itemTitle, { color: theme.colors.text }]}>
                                    {item.title}
                                </Text>
                                <Text style={[styles.itemDate, { color: theme.colors.textSecondary }]}>
                                    {formattedDate}
                                </Text>
                            </View>
                            <Text numberOfLines={1} style={[styles.itemBody, { color: theme.colors.textSecondary }]}>
                                {item.body}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        </Animated.View>
    );
};

export default function NotificationModal({ 
    visible, 
    onClose, 
    notifications, 
    onMarkAllRead, 
    onMarkAsRead, 
    onDeleteNotification, 
    onActionPress,
    theme 
}: NotificationModalProps) {
    const insets = useSafeAreaInsets();
    
    const translateY = useSharedValue(0);
    const bodyTranslateX = useSharedValue(0); 
    
    const [openRowId, setOpenRowId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
    const lastSelectedItem = useRef<NotificationItem | null>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        if (visible) {
            translateY.value = 0;
            bodyTranslateX.value = 0;
            setOpenRowId(null); 
            setSelectedItem(null);
            lastSelectedItem.current = null;
        }
    }, [visible]);

    const close = () => {
        if (selectedItem) setSelectedItem(null);
        onClose();
    };

    const handleSelectNotification = (item: NotificationItem) => {
        if (!item.read && onMarkAsRead) onMarkAsRead(item.id);
        lastSelectedItem.current = item;
        setSelectedItem(item);
        bodyTranslateX.value = withTiming(-SCREEN_WIDTH, { duration: 350, easing: Easing.out(Easing.cubic) });
    };

    const handleCloseDetail = () => {
        bodyTranslateX.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }, (finished) => {
            if (finished) runOnJS(setSelectedItem)(null);
        });
    };

    const handleHardwareBack = () => {
        if (selectedItem) handleCloseDetail();
        else close();
    };

    const pan = Gesture.Pan()
        .enabled(!selectedItem) 
        .onChange((event) => { if (event.translationY > 0) translateY.value = event.translationY; })
        .onEnd((event) => {
            if (event.translationY > 100 || event.velocityY > 500) runOnJS(close)();
            else translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
        });

    const animatedSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const animatedBodyWrapperStyle = useAnimatedStyle(() => ({ transform: [{ translateX: bodyTranslateX.value }] }));

    const currentItem = selectedItem || lastSelectedItem.current;

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={handleHardwareBack} animationType="none" statusBarTranslucent>
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} style={styles.backdrop}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
                </Animated.View>

                <Animated.View entering={SlideInDown.duration(400).easing(Easing.out(Easing.quad))} exiting={SlideOutDown.duration(300)} style={styles.modalContainerWrapper}>
                    <Animated.View style={[styles.sheet, { backgroundColor: theme.colors.background, paddingBottom: Math.max(insets.bottom, 20) }, animatedSheetStyle]}>
                        
                        <GestureDetector gesture={pan}>
                            <View style={{ backgroundColor: theme.colors.background }}>
                                <View style={styles.dragPillContainer}>
                                    <View style={[styles.dragPill, { backgroundColor: theme.colors.border }]} />
                                </View>

                                {/* Fixed Root Modal Header - Never Changes */}
                                <ModalHeader 
                                    title="Notifications"
                                    subtitle={unreadCount > 0 ? `You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'You are completely caught up.'}
                                    position="bottom"
                                    onClose={close}
                                />
                            </View>
                        </GestureDetector>

                        {/* Sliding Body Wrapper */}
                        <View style={styles.bodyOverflowContainer}>
                            <Animated.View style={[styles.slidingBodyWrapper, animatedBodyWrapperStyle]}>
                                
                                {/* ---------------- MAIN NOTIFICATION LIST (Left) ---------------- */}
                                <View style={styles.listScreen}>
                                    
                                    {/* Action Bar (List View) */}
                                    <View style={styles.sharedActionBar}>
                                        {notifications.length > 0 && unreadCount > 0 && (
                                            <TouchableOpacity onPress={onMarkAllRead} style={styles.markReadBtn}>
                                                <Text style={[styles.markReadText, { color: theme.colors.primary }]}>Mark all as read</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <FlatList
                                        data={notifications}
                                        keyExtractor={(item) => item.id}
                                        renderItem={({ item }) => (
                                            <NotificationRow 
                                                item={item} 
                                                theme={theme} 
                                                onMarkAsRead={onMarkAsRead}
                                                onDeleteNotification={onDeleteNotification}
                                                onPressItem={handleSelectNotification}
                                                openRowId={openRowId}
                                                setOpenRowId={setOpenRowId}
                                            />
                                        )}
                                        contentContainerStyle={styles.listContent}
                                        showsVerticalScrollIndicator={false}
                                        ListFooterComponent={() => notifications.length > 0 ? (
                                            <View style={styles.footerContainer}>
                                                <View style={[styles.footerLine, { backgroundColor: theme.colors.border }]} />
                                                <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>End of notifications</Text>
                                                <View style={[styles.footerLine, { backgroundColor: theme.colors.border }]} />
                                            </View>
                                        ) : null}
                                        ListEmptyComponent={
                                            <View style={styles.emptyState}>
                                                <View style={[styles.emptyIconContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={36} color={theme.colors.textSecondary} />
                                                </View>
                                                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No New Alerts</Text>
                                                <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>When you receive notifications, they will securely appear here.</Text>
                                            </View>
                                        }
                                    />
                                </View>

                                {/* ---------------- DETAIL VIEW (Right) ---------------- */}
                                <View style={styles.detailScreen}>
                                    
                                    {/* Action Bar (Detail View) */}
                                    <View style={[styles.sharedActionBar, { justifyContent: 'flex-start' }]}>
                                        <TouchableOpacity onPress={handleCloseDetail} style={styles.detailBackBtn}>
                                            <HugeiconsIcon icon={ArrowLeft02Icon} size={20} color={theme.colors.textSecondary} />
                                            <Text style={[styles.detailBackText, { color: theme.colors.textSecondary }]}>Back</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {currentItem && (
                                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
                                            
                                            <View style={styles.detailContentCore}>
                                                <View style={[styles.detailIconWrap, { backgroundColor: getIconTheme(currentItem, theme).bg }]}>
                                                    <HugeiconsIcon icon={getIconTheme(currentItem, theme).icon} size={48} color={getIconTheme(currentItem, theme).color} />
                                                </View>

                                                <Text style={[styles.detailTitle, { color: theme.colors.text }]}>
                                                    {currentItem.title}
                                                </Text>
                                                <Text style={[styles.detailDate, { color: theme.colors.textSecondary }]}>
                                                    {format(new Date(currentItem.date || currentItem.created_at || Date.now()), "EEEE, MMM d, yyyy • h:mm a")}
                                                </Text>

                                                <View style={[styles.detailDivider, { backgroundColor: theme.colors.border }]} />

                                                <Text style={[styles.detailBody, { color: theme.colors.text }]}>
                                                    {currentItem.body}
                                                </Text>
                                            </View>

                                            {/* Action Button */}
                                            {(currentItem.type === 'report_ready' || currentItem.title?.toLowerCase().includes("report's ready")) && (
                                                <View style={styles.detailFooter}>
                                                    <TouchableOpacity 
                                                        activeOpacity={0.8}
                                                        onPress={() => onActionPress && onActionPress('generate_report')} 
                                                        style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
                                                    >
                                                        <Text style={styles.primaryActionBtnText}>Generate Report</Text>
                                                        <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="#FFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </ScrollView>
                                    )}
                                </View>

                            </Animated.View>
                        </View>

                    </Animated.View>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContainerWrapper: { flex: 1, justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', height: '94%', shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 20, width: '100%' },
    dragPillContainer: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    dragPill: { width: 40, height: 5, borderRadius: 3, opacity: 0.5 },

    // Sliding Layout
    bodyOverflowContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    slidingBodyWrapper: {
        flex: 1,
        flexDirection: 'row',
        width: SCREEN_WIDTH * 2, 
    },
    listScreen: { width: SCREEN_WIDTH, flex: 1 },
    detailScreen: { width: SCREEN_WIDTH, flex: 1 },

    // Unified Action Bar for both screens
    sharedActionBar: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'transparent', // Can change if you want a line
    },

    // List View Styles
    markReadBtn: {
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    markReadText: {
        fontSize: 14,
        fontFamily: 'Nunito_700Bold',
    },
    listContent: { flexGrow: 1 },
    itemContainer: { paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1 },
    itemContent: { flexDirection: 'row', alignItems: 'center' },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginRight: 14 },
    textBlock: { flex: 1, justifyContent: 'center' },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold', flex: 1, marginRight: 12 },
    itemDate: { fontSize: 11, fontFamily: 'Nunito_600SemiBold' },
    itemBody: { fontSize: 14, fontFamily: 'Nunito_500Medium', lineHeight: 20 },
    leftAction: { width: 80, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent' },
    rightAction: { width: 80, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent' },
    
    // Empty & Footer
    footerContainer: { paddingVertical: 32, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.4 },
    footerLine: { height: 1, flex: 1, maxWidth: 60 },
    footerText: { fontSize: 12, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyIconContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontFamily: 'Nunito_700Bold', marginBottom: 8 },
    emptySubtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
    
    // Detail View Styles
    detailBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        marginLeft: -4,
    },
    detailBackText: {
        fontSize: 15,
        fontFamily: 'Nunito_700Bold',
    },
    detailScrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    detailContentCore: {
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 16,
    },
    detailIconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    detailTitle: {
        fontSize: 22,
        fontFamily: 'Nunito_800ExtraBold',
        textAlign: 'center',
        marginBottom: 6,
    },
    detailDate: {
        fontSize: 13,
        fontFamily: 'Nunito_600SemiBold',
        marginBottom: 24,
    },
    detailDivider: {
        height: 1,
        width: '100%',
        opacity: 0.5,
        marginBottom: 24,
    },
    detailBody: {
        fontSize: 16,
        fontFamily: 'Nunito_500Medium',
        lineHeight: 26,
        textAlign: 'center',
        opacity: 0.9,
    },
    detailFooter: {
        paddingTop: 32,
        alignItems: 'center',
    },
    primaryActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 20,
        width: '100%',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    primaryActionBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Nunito_700Bold',
    }
});