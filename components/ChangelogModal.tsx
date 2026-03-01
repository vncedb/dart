// filepath: components/ChangelogModal.tsx
import {
    ArrowUpRight01Icon,
    Bug02Icon,
    Cancel01Icon, // <-- Added Cancel Icon
    Megaphone01Icon,
    PlusSignIcon,
    RefreshIcon,
    SparklesIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect } from 'react';
import { Dimensions, Image, Linking, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

import { AppChangelog, ChangelogCategory } from '../constants/ChangelogData';
import { useAppTheme } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChangelogModalProps {
    visible: boolean;
    onClose: () => void;
}

const getCategoryConfig = (type: ChangelogCategory, theme: any) => {
    switch (type) {
        case 'Highlights': return { icon: SparklesIcon, color: '#8B5CF6', bg: '#8B5CF615' }; 
        case "What's New": return { icon: Megaphone01Icon, color: theme.colors.primary, bg: theme.colors.primary + '15' };
        case 'Improvements': return { icon: ArrowUpRight01Icon, color: '#3B82F6', bg: '#3B82F615' }; 
        case 'Fixes': return { icon: Bug02Icon, color: theme.colors.danger, bg: theme.colors.danger + '15' }; 
        case 'Added': return { icon: PlusSignIcon, color: theme.colors.success, bg: theme.colors.success + '15' }; 
        case 'Changed': return { icon: RefreshIcon, color: '#F59E0B', bg: '#F59E0B15' }; 
        default: return { icon: SparklesIcon, color: theme.colors.textSecondary, bg: theme.colors.border };
    }
};

export default function ChangelogModal({ visible, onClose }: ChangelogModalProps) {
    const theme = useAppTheme();
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const opacity = useSharedValue(0);

    // Floating Button Animation Values
    const scrollY = useSharedValue(0);
    const fabOpacity = useSharedValue(0); 
    const fabTranslateY = useSharedValue(20);

    useEffect(() => {
        if (visible) {
            translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
            opacity.value = withTiming(0.4, { duration: 350 });
        } else {
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
            opacity.value = withTiming(0, { duration: 250 });
        }
    }, [visible, translateY, opacity]);

    const handleClose = () => {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
        opacity.value = withTiming(0, { duration: 250 }, (finished) => {
            if (finished) runOnJS(onClose)();
        });
    };

    const pan = Gesture.Pan()
        .onUpdate((event) => {
            if (event.translationY > 0) translateY.value = event.translationY;
        })
        .onEnd((event) => {
            if (event.translationY > 100 || event.velocityY > 500) {
                runOnJS(handleClose)();
            } else {
                translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
            }
        });

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentY = event.contentOffset.y;
            if (currentY < scrollY.value - 2 && currentY > 0) { 
                fabOpacity.value = withTiming(1, { duration: 150, easing: Easing.linear });
                fabTranslateY.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
            } else if (currentY > scrollY.value + 2) { 
                fabOpacity.value = withTiming(0, { duration: 150, easing: Easing.linear });
                fabTranslateY.value = withTiming(20, { duration: 150, easing: Easing.in(Easing.quad) });
            }
            scrollY.value = currentY;
        }
    });

    const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
    const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const fabStyle = useAnimatedStyle(() => ({
        opacity: fabOpacity.value,
        transform: [{ translateY: fabTranslateY.value }],
        pointerEvents: fabOpacity.value === 0 ? 'none' : 'auto'
    }));

    return (
        <Modal visible={visible} transparent={true} animationType="none" onRequestClose={handleClose}>
            <GestureHandlerRootView style={styles.overlayContainer}>
                
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, overlayStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                </Animated.View>

                <Animated.View style={[styles.modalSheet, { backgroundColor: theme.colors.background }, slideStyle]}>
                    
                    <GestureDetector gesture={pan}>
                        <View style={styles.headerArea}>
                            <View style={[styles.handleBar, { backgroundColor: theme.dark ? '#374151' : '#E5E7EB' }]} />
                            <View style={styles.headerTextContainer}>
                                <View>
                                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Changelog</Text>
                                    <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>Latest updates and fixes</Text>
                                </View>
                                {/* ADDED CLOSE X BUTTON */}
                                <TouchableOpacity 
                                    onPress={handleClose}
                                    style={[styles.closeBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                >
                                    <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </GestureDetector>

                    <Animated.ScrollView 
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        contentContainerStyle={styles.scrollContent} 
                        showsVerticalScrollIndicator={false}
                    >
                        {AppChangelog.map((release, index) => (
                            <View key={release.version} style={styles.releaseContainer}>
                                <View style={styles.releaseHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Text style={[styles.versionText, { color: theme.colors.text }]}>
                                            Version {release.version}
                                        </Text>
                                        {index === 0 && (
                                            <View style={[styles.latestBadge, { backgroundColor: theme.colors.primary }]}>
                                                <Text style={styles.latestBadgeText}>LATEST</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={[styles.dateText, { color: theme.colors.textSecondary }]}>{release.date}</Text>
                                </View>

                                <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    {release.categories.map((category, catIndex) => {
                                        const config = getCategoryConfig(category.type, theme);
                                        return (
                                            <View key={category.type} style={[styles.categoryBlock, catIndex > 0 && { marginTop: 24 }]}>
                                                <View style={[styles.categoryTitleContainer, { backgroundColor: config.bg }]}>
                                                    <HugeiconsIcon icon={config.icon} size={16} color={config.color} />
                                                    <Text style={[styles.categoryTitle, { color: config.color }]}>{category.type}</Text>
                                                </View>
                                                <View style={styles.itemsList}>
                                                    {category.items.map((item, itemIndex) => (
                                                        <View key={itemIndex} style={styles.listItem}>
                                                            <View style={[styles.bullet, { backgroundColor: theme.colors.textSecondary, opacity: 0.5 }]} />
                                                            <Text style={[styles.itemText, { color: theme.colors.text }]}>{item}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}

                        <View style={styles.footer}>
                            <HugeiconsIcon icon={SparklesIcon} size={24} color={theme.colors.textSecondary} />
                            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>You&apos;re all caught up!</Text>
                        </View>
                    </Animated.ScrollView>

                    <Animated.View style={[styles.fabContainer, fabStyle]}>
                        <TouchableOpacity 
                            style={[styles.fab, { backgroundColor: theme.dark ? '#374151' : '#111827' }]} 
                            activeOpacity={0.8}
                            onPress={() => Linking.openURL('https://github.com/vncedb/dart')}
                        >
                            <Image source={require('../assets/images/github.png')} style={styles.fabIcon} />
                            <Text style={styles.fabText}>View on GitHub</Text>
                        </TouchableOpacity>
                    </Animated.View>

                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlayContainer: { flex: 1, justifyContent: 'flex-end' },
    modalSheet: { width: '100%', maxHeight: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
    
    headerArea: { paddingBottom: 16, backgroundColor: 'transparent', zIndex: 10 },
    handleBar: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
    
    // UPDATED HEADER LAYOUT
    headerTextContainer: { paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3, marginBottom: 2 },
    headerSubtitle: { fontSize: 14, fontFamily: 'Nunito_500Medium' },
    closeBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

    scrollContent: { padding: 24, paddingBottom: 100 },
    releaseContainer: { marginBottom: 32 },
    releaseHeader: { marginBottom: 16, paddingHorizontal: 4 },
    versionText: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
    latestBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    latestBadgeText: { color: '#FFF', fontSize: 10, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 0.5 },
    dateText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', marginTop: 4 },
    card: { borderRadius: 24, borderWidth: 1, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 2 },
    categoryBlock: { width: '100%' },
    categoryTitleContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 8, marginBottom: 12 },
    categoryTitle: { fontSize: 13, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 },
    itemsList: { gap: 10, paddingLeft: 4 },
    listItem: { flexDirection: 'row', alignItems: 'flex-start' },
    bullet: { width: 5, height: 5, borderRadius: 3, marginTop: 8, marginRight: 12 },
    itemText: { flex: 1, fontSize: 15, fontFamily: 'Nunito_500Medium', lineHeight: 22 },
    footer: { alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 40, gap: 8, opacity: 0.5 },
    footerText: { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },

    fabContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 40 : 24,
        right: 24,
        zIndex: 100,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
    },
    fab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 100,
        gap: 8,
    },
    fabIcon: { width: 20, height: 20, tintColor: '#FFF' },
    fabText: { color: '#FFF', fontSize: 15, fontFamily: 'Nunito_700Bold' }
});