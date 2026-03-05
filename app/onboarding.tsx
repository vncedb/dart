// filepath: app/onboarding.tsx
import { ArrowRight01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken
} from 'react-native';
import Animated, {
    Extrapolation,
    FadeInDown,
    interpolate,
    interpolateColor,
    SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrivacyModal from '../components/PrivacyModal';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { queueSyncItem } from '../lib/database';
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Track Your Work',
        description: 'Effortlessly log your daily attendance and activities. Keep a precise record of your productivity.',
        image: require('../assets/onboarding/track.png'),
    },
    {
        id: '2',
        title: 'Get Reports',
        description: 'Generate comprehensive reports in PDF or Excel formats instantly. Ready to submit, anytime.',
        image: require('../assets/onboarding/generate.png'),
    },
    {
        id: '3',
        title: 'Secure & Synced',
        description: 'Your data is encrypted and synced across all your devices. Access your workspace from anywhere, anytime.',
        image: require('../assets/onboarding/secure.png'),
    }
];

// --- COMPONENTS ---

const Slide = ({ item, index, scrollX, theme }: any) => {
    const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];

    const imageStyle = useAnimatedStyle(() => {
        const scale = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
        return { transform: [{ scale }], opacity };
    });

    const textStyle = useAnimatedStyle(() => {
        const translateY = interpolate(scrollX.value, inputRange, [40, 0, -40], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP);
        return { transform: [{ translateY }], opacity };
    });

    return (
        <View style={styles.slideContainer}>
            <Animated.View style={[styles.imageContainer, imageStyle]}>
                <Image source={item.image} style={styles.slideImage} resizeMode="contain" />
            </Animated.View>
            <Animated.View style={[styles.slideTextContainer, textStyle]}>
                <Text style={[styles.slideTitle, { color: theme.colors.text }]}>{item.title}</Text>
                <Text style={[styles.slideDesc, { color: theme.colors.textSecondary }]}>{item.description}</Text>
            </Animated.View>
        </View>
    );
};

const PaginatorDot = ({ index, scrollX, theme }: { index: number, scrollX: SharedValue<number>, theme: any }) => {
    const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
    
    const animatedStyle = useAnimatedStyle(() => {
        const width = interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP);
        const backgroundColor = interpolateColor(scrollX.value, inputRange, 
            [theme.colors.border, theme.colors.primary, theme.colors.border]
        );
        return { width, opacity, backgroundColor };
    });

    return <Animated.View style={[styles.dot, animatedStyle]} />;
};

// --- MAIN SCREEN ---

export default function OnboardingScreen() {
    const { completeOnboarding } = useAuth();
    const router = useRouter();
    const theme = useAppTheme();
    const isDark = theme.dark;
    
    const [privacyVisible, setPrivacyVisible] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const flatListRef = useRef<Animated.FlatList<any>>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useSharedValue(0);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems[0]) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const handleNextSlide = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            setPrivacyVisible(true);
        }
    };

    const handlePrivacyAgreed = async () => {
        if (isProcessing) return; 
        setIsProcessing(true);
        setPrivacyVisible(false);

        try {
            const db = await getDB();
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.user) {
                const provider = session.user.app_metadata?.provider || 'email';
                
                if (provider === 'email') {
                    const profile: any = await db.getFirstAsync(
                        'SELECT first_name, last_name FROM profiles WHERE id = ?', 
                        [session.user.id]
                    );
                    
                    if (!profile?.first_name) {
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                        let randomSuffix = '';
                        for (let i = 0; i < 4; i++) {
                            randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                        const generatedName = `User${randomSuffix}`;

                        await db.runAsync(
                            'UPDATE profiles SET first_name = ?, full_name = ? WHERE id = ?', 
                            [generatedName, generatedName, session.user.id]
                        );

                        await queueSyncItem('profiles', session.user.id, 'UPDATE', {
                            first_name: generatedName,
                            full_name: generatedName
                        });
                    }
                }
            }
            
            if (completeOnboarding) await completeOnboarding();
            router.replace('/(tabs)/home');

        } catch (e) {
            console.log("Error checking missing data during onboarding:", e);
            setIsProcessing(false);
        }
    };

    // --- ANIMATED STYLES ---

    const skipStyle = useAnimatedStyle(() => {
        const isLastIndex = currentIndex === SLIDES.length - 1;
        return {
            opacity: withTiming(isLastIndex ? 0 : 1, { duration: 300 }),
            transform: [{ translateY: withTiming(isLastIndex ? -10 : 0, { duration: 300 }) }],
        };
    });

    const buttonStyle = useAnimatedStyle(() => {
        const isLastIndex = currentIndex === SLIDES.length - 1;
        return {
            // Increased width slightly to 180 to give the text plenty of room
            width: withTiming(isLastIndex ? 180 : 64, { duration: 350 }),
        };
    });

    const arrowIconStyle = useAnimatedStyle(() => {
        const isLastIndex = currentIndex === SLIDES.length - 1;
        return {
            opacity: withTiming(isLastIndex ? 0 : 1, { duration: 250 }),
        };
    });
    
    const checkIconStyle = useAnimatedStyle(() => {
        const isLastIndex = currentIndex === SLIDES.length - 1;
        return {
            opacity: withTiming(isLastIndex ? 1 : 0, { duration: 250 }),
        };
    });

    const getStartedTextStyle = useAnimatedStyle(() => {
        const isLastIndex = currentIndex === SLIDES.length - 1;
        return {
            opacity: withTiming(isLastIndex ? 1 : 0, { duration: 350 }),
            transform: [{ translateX: withTiming(isLastIndex ? 0 : 20, { duration: 350 }) }],
        };
    });

    return (
        <Animated.View entering={FadeInDown.duration(600).springify()} style={[styles.container, { backgroundColor: theme.colors.background }]}>
             <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
             
             <SafeAreaView style={styles.headerContainer}>
                 <Animated.View style={skipStyle} pointerEvents={currentIndex === SLIDES.length - 1 ? 'none' : 'auto'}>
                    <TouchableOpacity onPress={() => setPrivacyVisible(true)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>Skip</Text>
                    </TouchableOpacity>
                 </Animated.View>
             </SafeAreaView>

             <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onScroll={onScroll}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewConfig}
                renderItem={({ item, index }) => <Slide item={item} index={index} scrollX={scrollX} theme={theme} />}
             />

             <View style={styles.footerContainer}>
                 <View style={styles.paginationContainer}>
                     {SLIDES.map((_, i) => (
                         <PaginatorDot key={i.toString()} index={i} scrollX={scrollX} theme={theme} />
                     ))}
                 </View>
                 
                 <TouchableOpacity onPress={handleNextSlide} activeOpacity={0.8} disabled={isProcessing}>
                    <Animated.View style={[styles.actionButton, { backgroundColor: theme.colors.primary }, buttonStyle]}>
                        {isProcessing ? (
                             <View style={styles.loaderContainer}>
                                 <ActivityIndicator color="white" />
                             </View>
                        ) : (
                            <>
                                {/* Text Container: Aligned to the left of the icon wrapper */}
                                <Animated.View style={[styles.textContainer, getStartedTextStyle]}>
                                    <Text style={styles.getStartedText} numberOfLines={1}>Get Started</Text>
                                </Animated.View>

                                {/* Icon Wrapper: Permanently pinned to the right edge */}
                                <View style={styles.iconWrapper}>
                                    <Animated.View style={[StyleSheet.absoluteFill, styles.centerIcon, arrowIconStyle]}>
                                        <HugeiconsIcon icon={ArrowRight01Icon} size={28} color="white" strokeWidth={2.5} />
                                    </Animated.View>
                                    <Animated.View style={[StyleSheet.absoluteFill, styles.centerIcon, checkIconStyle]}>
                                        <HugeiconsIcon icon={Tick01Icon} size={26} color="white" strokeWidth={2.5} />
                                    </Animated.View>
                                </View>
                            </>
                        )}
                    </Animated.View>
                </TouchableOpacity>
             </View>

             <PrivacyModal visible={privacyVisible} onClose={() => {
                 if(!isProcessing) setPrivacyVisible(false);
             }} onAgree={handlePrivacyAgreed} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { width: '100%', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 10, zIndex: 10, minHeight: 60 },
    skipText: { fontSize: 16, fontFamily: 'Nunito_600SemiBold', opacity: 0.8 },
    
    slideContainer: { width: SCREEN_WIDTH, alignItems: 'center', padding: 32, justifyContent: 'center' },
    imageContainer: { width: SCREEN_WIDTH * 0.8, height: SCREEN_WIDTH * 0.8, justifyContent: 'center', alignItems: 'center', marginBottom: 50 },
    slideImage: { width: '100%', height: '100%' },
    
    slideTextContainer: { alignItems: 'center', maxWidth: '90%' },
    slideTitle: { fontSize: 32, fontFamily: 'Nunito_800ExtraBold', marginBottom: 16, textAlign: 'center' },
    slideDesc: { fontSize: 16, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 26, opacity: 0.8 },
    
    footerContainer: { paddingHorizontal: 32, paddingBottom: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paginationContainer: { flexDirection: 'row', height: 64, alignItems: 'center' },
    dot: { height: 8, borderRadius: 4, marginHorizontal: 4 },
    
    // Removed shadows completely for a clean flat appearance
    actionButton: { height: 64, borderRadius: 32, overflow: 'hidden', position: 'relative' },
    iconWrapper: { position: 'absolute', right: 0, width: 64, height: 64 },
    centerIcon: { alignItems: 'center', justifyContent: 'center' },
    loaderContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    
    // Adjusted left padding to center the text nicely within the new 180px width
    textContainer: { position: 'absolute', left: 30, right: 50, height: 64, justifyContent: 'center' },
    getStartedText: { color: 'white', fontFamily: 'Nunito_700Bold', fontSize: 18 }
});