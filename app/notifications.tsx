// filepath: app/notifications.tsx
import {
    ArrowRight01Icon,
    CheckmarkBadge01Icon,
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
import { BackHandler, Dimensions, FlatList, Animated as RNAnimated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    LinearTransition,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../components/ActionMenu';
import BannerAdComponent from '../components/BannerAdComponent'; // <-- ADDED AD COMPONENT
import Footer from '../components/Footer';
import Header from '../components/Header';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { deleteNotificationLocal, getNotificationsLocal, markAllNotificationsReadLocal, markNotificationReadLocal } from '../lib/database';

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
    onMarkAsRead,
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

    const handleMarkAsReadLocal = () => {
        swipeableRef.current?.close();
        if (onMarkAsRead) onMarkAsRead(item.id);
    };

    const handleDeleteLocal = () => {
        swipeableRef.current?.close();
        if (onDeleteNotification) onDeleteNotification(item.id);
    };

    // Gmail-style Auto-Trigger
    const handleSwipeOpen = (direction: 'left' | 'right') => {
        if (direction === 'left' && !item.read) {
            handleMarkAsReadLocal();
        } else if (direction === 'right') {
            handleDeleteLocal();
        }
    };

    const renderLeftActions = (progress: any, dragX: any) => {
        if (item.read) return null;
        const scale = dragX.interpolate({ inputRange: [0, 60], outputRange: [0.5, 1], extrapolate: 'clamp' });
        return (
            <View style={[styles.gmailAction, { backgroundColor: theme.colors.success, alignItems: 'flex-start', paddingLeft: 24 }]}>
                <RNAnimated.View style={{ transform: [{ scale }] }}>
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} size={26} color="#FFF" />
                </RNAnimated.View>
            </View>
        );
    };

    const renderRightActions = (progress: any, dragX: any) => {
        const scale = dragX.interpolate({ inputRange: [-60, 0], outputRange: [1, 0.5], extrapolate: 'clamp' });
        return (
            <View style={[styles.gmailAction, { backgroundColor: theme.colors.danger, alignItems: 'flex-end', paddingRight: 24 }]}>
                <RNAnimated.View style={{ transform: [{ scale }] }}>
                    <HugeiconsIcon icon={Delete02Icon} size={26} color="#FFF" />
                </RNAnimated.View>
            </View>
        );
    };

    const rawDate = item.date || item.created_at || Date.now();
    const formattedDate = formatDistanceToNow(new Date(rawDate), { addSuffix: true });

    return (
        <Animated.View layout={LinearTransition.springify().damping(16)}>
            <Swipeable
                ref={swipeableRef}
                friction={1.5}
                leftThreshold={80} // Increased threshold for deliberate swipe action
                rightThreshold={80} // Increased threshold for deliberate swipe action
                overshootLeft={true} // Allow overshooting for smooth Gmail feel
                overshootRight={true} // Allow overshooting for smooth Gmail feel
                onSwipeableWillOpen={() => {
                    if (openRowId !== item.id) setOpenRowId(item.id);
                }}
                onSwipeableOpen={handleSwipeOpen}
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
                        <View style={styles.unreadDotContainer}>
                            <View style={[styles.unreadDot, { backgroundColor: item.read ? 'transparent' : theme.colors.primary }]} />
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
                                numberOfLines={2} 
                                style={[styles.itemBody, { color: theme.colors.textSecondary }]}
                            >
                                {item.body}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Swipeable>
        </Animated.View>
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

    const loadData = async () => {
        try {
            if (!user) return;
            const data = await getNotificationsLocal(user.id);
            setNotifications(data);
        } catch (e) {
            console.log('Err loading notifs', e);
        }
    };

    useFocusEffect(useCallback(() => {
        loadData();
    }, []));

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

    const handleActionPress = (action: string) => {
        if (action === 'generate_report') {
            router.push('/reports/generate');
        }
    };

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
                actions={[
                    { 
                        label: "Mark all as read", 
                        icon: TickDouble01Icon, 
                        onPress: handleMarkAllRead, 
                        color: theme.colors.primary 
                    }
                ]}
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
                                        onMarkAsRead={handleMarkAsRead}
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
                                <>
                                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScrollContent}>
                                        
                                        <View style={styles.heroSection}>
                                            <View style={[styles.heroIconBox, { backgroundColor: getIconTheme(currentItem, theme).bg }]}>
                                                <HugeiconsIcon icon={getIconTheme(currentItem, theme).icon} size={28} color={getIconTheme(currentItem, theme).color} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.heroDate, { color: theme.colors.text }]} numberOfLines={2}>
                                                    {currentItem.title}
                                                </Text>
                                                <Text style={[styles.heroDay, { color: theme.colors.textSecondary }]}>
                                                    {format(new Date(currentItem.date || currentItem.created_at || Date.now()), "EEEE, MMM d, yyyy • h:mm a")}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={[styles.detailCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                            <Text style={[styles.detailBody, { color: theme.colors.text }]}>
                                                {currentItem.body}
                                            </Text>
                                        </View>
                                    </ScrollView>

                                    {(currentItem.type === 'report_ready' || currentItem.title?.toLowerCase().includes("report's ready")) && (
                                        <Footer>
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => handleActionPress('generate_report')}
                                                style={[styles.primaryActionBtn, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}
                                            >
                                                <Text style={styles.primaryActionBtnText}>Generate Report</Text>
                                                <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="#FFF" />
                                            </TouchableOpacity>
                                        </Footer>
                                    )}

                                    {/* ADDED AD COMPONENT AT THE BOTTOM OF REPORT DETAILS */}
                                    <View style={{ width: '100%' }}>
                                        <BannerAdComponent />
                                    </View>
                                </>
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

    // List Styles
    listContent: { flexGrow: 1 },
    itemContainer: { paddingVertical: 20, paddingHorizontal: 24, borderBottomWidth: 1 },
    itemContent: { flexDirection: 'row', alignItems: 'flex-start' },
    unreadDotContainer: { width: 18, paddingTop: 6 },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
    textBlock: { flex: 1 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    itemTitle: { fontSize: 16, flex: 1, marginRight: 12, letterSpacing: -0.2 },
    itemTitleUnread: { fontFamily: 'Nunito_800ExtraBold' },
    itemTitleRead: { fontFamily: 'Nunito_600SemiBold', opacity: 0.8 },
    itemDate: { fontSize: 12, fontFamily: 'Nunito_500Medium' },
    itemBody: { fontSize: 14, fontFamily: 'Nunito_500Medium', lineHeight: 22 },
    
    // Gmail-Style Swipe Actions (Refined)
    gmailAction: { flex: 1, justifyContent: 'center' },

    // Empty & Footer
    footerContainer: { paddingVertical: 32, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.4 },
    footerLine: { height: 1, flex: 1, maxWidth: 60 },
    footerText: { fontSize: 12, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    emptyIconContainer: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, fontFamily: 'Nunito_700Bold', marginBottom: 8 },
    emptySubtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

    // Detail View Styles
    detailScrollContent: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
    heroSection: { flexDirection: "row", alignItems: "center", marginBottom: 32, gap: 16 },
    heroIconBox: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    heroDate: { fontSize: 22, fontFamily: 'Nunito_700Bold', letterSpacing: -0.5, marginBottom: 4 },
    heroDay: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
    
    detailCard: { padding: 24, borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    detailBody: { fontSize: 16, fontFamily: 'Nunito_500Medium', lineHeight: 26 },

    // Footer Actions
    primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 20, width: '100%', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
    primaryActionBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Nunito_700Bold' }
});