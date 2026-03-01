// filepath: app/notifications.tsx
import {
    ArrowRight01Icon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    Delete02Icon,
    File01Icon,
    LockKeyIcon,
    Logout01Icon,
    MoreVerticalIcon,
    Notification01Icon,
    TickDouble01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    Dimensions,
    FlatList,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../components/ActionMenu';
import BannerAdComponent from '../components/BannerAdComponent';
import Header from '../components/Header';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
    deleteNotificationLocal,
    getNotificationsLocal,
    markAllNotificationsReadLocal,
    markNotificationReadLocal
} from '../lib/database';

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
    onDeleteNotification,
    onPressItem,
    openRowId,
    setOpenRowId
}: any) => {
    const swipeableRef = useRef<Swipeable>(null);

    useEffect(() => {
        if (openRowId !== item.id && openRowId !== null) {
            swipeableRef.current?.close();
        }
    }, [openRowId, item.id]);

    const handleDeleteLocal = () => {
        swipeableRef.current?.close();
        if (onDeleteNotification) onDeleteNotification(item.id);
    };

    const renderRightActions = () => {
        return (
            <View style={styles.rightActionContainer}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleDeleteLocal}
                    style={[styles.squareDeleteBtn, { backgroundColor: theme.colors.danger }]}
                >
                    <HugeiconsIcon icon={Delete02Icon} size={22} color="#FFF" />
                </TouchableOpacity>
            </View>
        );
    };

    const rawDate = item.date || item.created_at || Date.now();
    const formattedDate = formatDistanceToNow(new Date(rawDate), { addSuffix: true });
    const { icon, color, bg } = getIconTheme(item, theme);

    return (
        <Swipeable
            ref={swipeableRef}
            friction={1.5}
            rightThreshold={40}
            overshootRight={false} 
            onSwipeableWillOpen={() => {
                if (openRowId !== item.id) setOpenRowId(item.id);
            }}
            renderRightActions={renderRightActions}
            containerStyle={{ overflow: 'visible', backgroundColor: 'transparent' }} 
        >
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onPressItem(item)}
                style={[
                    styles.card,
                    {
                        backgroundColor: theme.colors.card,
                        borderColor: item.read ? theme.colors.border : theme.colors.primary + '40',
                    }
                ]}
            >
                {!item.read && (
                    <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primary }]} />
                )}
                
                <View style={[styles.iconBox, { backgroundColor: bg }]}>
                    <HugeiconsIcon icon={icon} size={18} color={color} />
                </View>

                <View style={styles.textBlock}>
                    <View style={styles.itemHeader}>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.itemTitle,
                                { color: theme.colors.text },
                                item.read ? styles.itemTitleRead : styles.itemTitleUnread
                            ]}
                        >
                            {item.title}
                        </Text>
                        <Text style={[styles.itemDate, { color: theme.colors.textSecondary }]}>
                            {formattedDate}
                        </Text>
                    </View>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.itemBody, 
                            { color: theme.colors.textSecondary, opacity: item.read ? 0.8 : 1 }
                        ]}
                    >
                        {item.body}
                    </Text>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
};

export default function NotificationsScreen() {
    const theme = useAppTheme();
    const router = useRouter();
    const { user } = useAuth();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const bodyTranslateX = useSharedValue(0);

    const [openRowId, setOpenRowId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);
    const lastSelectedItem = useRef<NotificationItem | null>(null);

    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
    const moreIconRef = useRef<View>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    // FIX: Wrapped in useCallback and properly included in dependency array
    const loadData = useCallback(async () => {
        try {
            if (!user) return;
            const data = await getNotificationsLocal(user.id);
            setNotifications(data);
        } catch (e) {
            console.log('Err loading notifs', e);
        }
    }, [user]);

    useFocusEffect(useCallback(() => {
        loadData();
    }, [loadData]));

    const handleMenuOpen = () => {
        if (moreIconRef.current) {
            moreIconRef.current.measure((x, y, width, height, pageX, pageY) => {
                setMenuAnchor({ x: pageX + width, y: pageY + height });
                setMenuVisible(true);
            });
        }
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            await markNotificationReadLocal(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (error) {
            console.log("Error marking as read", error);
        }
    };

    const handleDeleteNotification = async (id: string) => {
        try {
            await deleteNotificationLocal(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (selectedItem?.id === id) handleCloseDetail();
        } catch (error) {
            console.log("Error deleting notification", error);
        }
    };

    const handleMarkAllRead = async () => {
        setMenuVisible(false);
        try {
            if (!user) return;
            await markAllNotificationsReadLocal(user.id);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (e) {
            console.log('Err marking all read', e);
        }
    };

    const handleSelectNotification = (item: NotificationItem) => {
        if (!item.read) handleMarkAsRead(item.id);
        lastSelectedItem.current = item;
        setSelectedItem(item);
        bodyTranslateX.value = withTiming(-SCREEN_WIDTH, { duration: 350, easing: Easing.out(Easing.cubic) });
    };

    const handleCloseDetail = useCallback(() => {
        bodyTranslateX.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }, (finished) => {
            if (finished) runOnJS(setSelectedItem)(null);
        });
    }, [bodyTranslateX]);

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (selectedItem) {
                    handleCloseDetail();
                    return true;
                }
                return false;
            };
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [selectedItem, handleCloseDetail])
    );

    const animatedBodyWrapperStyle = useAnimatedStyle(() => ({ transform: [{ translateX: bodyTranslateX.value }] }));
    const currentItem = selectedItem || lastSelectedItem.current;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top"]}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />

            <Header
                title={selectedItem ? "Details" : "Notifications"} 
                onBack={selectedItem ? handleCloseDetail : () => router.back()}
                rightElement={
                    !selectedItem && unreadCount > 0 ? (
                        <View ref={moreIconRef} collapsable={false}>
                            <TouchableOpacity onPress={handleMenuOpen} style={styles.headerMoreBtn}>
                                <HugeiconsIcon icon={MoreVerticalIcon} size={24} color={theme.colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ) : undefined
                }
            />

            <ActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                actions={[{ label: "Mark all as read", icon: TickDouble01Icon, onPress: handleMarkAllRead, color: theme.colors.primary }]}
                anchor={menuAnchor}
            />

            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.bodyOverflowContainer}>
                    <Animated.View style={[styles.slidingBodyWrapper, animatedBodyWrapperStyle]}>

                        {/* ---------------- MAIN NOTIFICATION LIST (Left) ---------------- */}
                        <View style={styles.listScreen}>
                            <FlatList
                                data={notifications}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <NotificationRow
                                        item={item}
                                        theme={theme}
                                        onDeleteNotification={handleDeleteNotification}
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
                            {currentItem && (
                                <View style={{ flex: 1 }}>
                                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
                                        
                                        <View style={[styles.detailCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary + '30' }]}>
                                            
                                            <View style={styles.detailCenteredLayout}>
                                                <View style={[styles.detailIconBox, { backgroundColor: getIconTheme(currentItem, theme).bg }]}>
                                                    <HugeiconsIcon icon={getIconTheme(currentItem, theme).icon} size={28} color={getIconTheme(currentItem, theme).color} />
                                                </View>
                                                
                                                {/* FIX: Removed invalid textAlign prop from Text, passed via style */}
                                                <Text style={[styles.detailTitle, { color: theme.colors.text, textAlign: 'center' }]} numberOfLines={2}>
                                                    {currentItem.title}
                                                </Text>
                                                
                                                <Text style={[styles.detailDate, { color: theme.colors.primary }]}>
                                                    {format(new Date(currentItem.date || currentItem.created_at || Date.now()), "MMMM d, yyyy • h:mm a")}
                                                </Text>
                                            </View>

                                            <View style={[styles.detailDivider, { backgroundColor: theme.colors.border }]} />
                                            
                                            <Text style={[styles.detailBodyText, { color: theme.colors.text }]}>
                                                {currentItem.body}
                                            </Text>

                                            {(currentItem.type === 'report_ready' || currentItem.title?.toLowerCase().includes("report's ready")) && (
                                                <TouchableOpacity
                                                    activeOpacity={0.8}
                                                    onPress={() => router.push('/reports/generate')}
                                                    style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
                                                >
                                                    <Text style={styles.primaryActionBtnText}>Generate Report</Text>
                                                    <HugeiconsIcon icon={ArrowRight01Icon} size={18} color="#FFF" />
                                                </TouchableOpacity>
                                            )}

                                        </View>
                                    </ScrollView>

                                    {/* Ad Component properly anchored at the absolute bottom */}
                                    <View style={styles.bannerAdContainer}>
                                        <BannerAdComponent />
                                    </View>
                                </View>
                            )}
                        </View>

                    </Animated.View>
                </View>
            </GestureHandlerRootView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerMoreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    bodyOverflowContainer: { flex: 1, overflow: 'hidden' },
    slidingBodyWrapper: { flex: 1, flexDirection: 'row', width: SCREEN_WIDTH * 2 },
    listScreen: { width: SCREEN_WIDTH, flex: 1 },
    detailScreen: { width: SCREEN_WIDTH, flex: 1 },

    // Adjusted List Styles (Smaller Fonts & Icons)
    listContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
    card: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        borderRadius: 20, 
        marginBottom: 10,
        borderWidth: 1,
    },
    unreadBadge: { position: 'absolute', top: 14, right: 14, width: 8, height: 8, borderRadius: 4 },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    textBlock: { flex: 1 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemTitle: { fontSize: 15, flex: 1, marginRight: 16, letterSpacing: -0.2 },
    itemTitleUnread: { fontFamily: 'Nunito_800ExtraBold' },
    itemTitleRead: { fontFamily: 'Nunito_600SemiBold', opacity: 0.9 },
    itemDate: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', opacity: 0.6 },
    itemBody: { fontSize: 13, fontFamily: 'Nunito_500Medium', lineHeight: 18 },

    // Square Delete Swipe Action
    rightActionContainer: { width: 68, height: '100%', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 10, backgroundColor: 'transparent' },
    squareDeleteBtn: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 4 },

    // Empty & Footer
    footerContainer: { paddingVertical: 32, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.4 },
    footerLine: { height: 1, flex: 1, maxWidth: 60 },
    footerText: { fontSize: 12, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyIconContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontFamily: 'Nunito_700Bold', marginBottom: 8 },
    emptySubtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

    // Refined Detail View Styles
    detailScrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
    detailCard: { padding: 24, borderRadius: 28, borderWidth: 1 },
    detailCenteredLayout: { alignItems: 'center', marginBottom: 20 },
    detailIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    detailTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.2, marginBottom: 6 },
    detailDate: { fontSize: 12, fontFamily: 'Nunito_700Bold', opacity: 0.8, letterSpacing: 0.5 },
    detailDivider: { height: 1, width: '100%', marginBottom: 20, opacity: 0.5 },
    detailBodyText: { fontSize: 14, fontFamily: 'Nunito_500Medium', lineHeight: 22, letterSpacing: 0.2, textAlign: 'center', marginBottom: 24 },

    // Primary Action Button
    primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 14, width: '100%', marginTop: 8 },
    primaryActionBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Nunito_700Bold' },

    // Ad Container
    bannerAdContainer: { width: '100%', paddingVertical: 10, backgroundColor: 'transparent' }
});