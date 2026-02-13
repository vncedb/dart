import {
    ArrowRight01Icon,
    CheckmarkCircle02Icon,
    File02Icon,
    Shield02Icon,
    Target02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken
} from 'react-native';
import Animated, {
    FadeInDown,
    interpolate,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrivacyModal from '../components/PrivacyModal';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Track Your Work',
        description: 'Effortlessly log your daily attendance and activities. Keep a precise record of your productivity.',
        image: require('../assets/images/intro/track.png'),
        icon: Target02Icon
    },
    {
        id: '2',
        title: 'Stay Secure',
        description: 'Your data is protected with enterprise-grade security. Enable biometrics for quick and safe access.',
        image: require('../assets/images/intro/security.png'),
        icon: Shield02Icon
    },
    {
        id: '3',
        title: 'Get Reports',
        description: 'Generate comprehensive reports in PDF or Excel formats instantly. Ready to submit, anytime.',
        image: require('../assets/images/intro/get-started.png'),
        icon: File02Icon
    }
];

// Extracted Component to fix "Rules of Hooks" violation
const PaginatorDot = ({ index, scrollX, theme }: { index: number, scrollX: Animated.SharedValue<number>, theme: any }) => {
    const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
    
    const animatedStyle = useAnimatedStyle(() => {
        const width = interpolate(scrollX.value, inputRange, [10, 30, 10], 'clamp');
        const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], 'clamp');
        return { width, opacity };
    });

    return (
        <Animated.View
            style={[
                { height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginHorizontal: 4 },
                animatedStyle
            ]}
        />
    );
};

const Paginator = ({ data, scrollX, theme }: any) => {
    return (
        <View style={{ flexDirection: 'row', height: 64, justifyContent: 'center', alignItems: 'center' }}>
            {data.map((_: any, i: number) => (
                <PaginatorDot key={i.toString()} index={i} scrollX={scrollX} theme={theme} />
            ))}
        </View>
    );
};

export default function OnboardingScreen() {
    const { completeOnboarding } = useAuth();
    const router = useRouter();
    const theme = useAppTheme();
    const isDark = theme.dark;
    
    const [privacyVisible, setPrivacyVisible] = useState(false);
    
    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useSharedValue(0);

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const handleNextSlide = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            setPrivacyVisible(true);
        }
    };

    const handlePrivacyAgreed = async () => {
        setPrivacyVisible(false);
        await completeOnboarding();
        router.replace('/(tabs)/home');
    };

    return (
        <Animated.View entering={FadeInDown} style={[styles.container, { backgroundColor: theme.colors.background }]}>
             <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
             
             <SafeAreaView style={styles.skipContainer}>
                 <TouchableOpacity onPress={() => setPrivacyVisible(true)}>
                     <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>Skip</Text>
                 </TouchableOpacity>
             </SafeAreaView>

             <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onScroll={(e) => { scrollX.value = e.nativeEvent.contentOffset.x; }}
                scrollEventThrottle={16}
                onViewableItemsChanged={onViewableItemsChanged}
                renderItem={({ item }) => (
                    <View style={styles.slideContainer}>
                        <Image source={item.image} style={styles.slideImage} resizeMode="contain" />
                        <View style={styles.slideTextContainer}>
                            <HugeiconsIcon icon={item.icon} size={32} color={theme.colors.primary} style={{ marginBottom: 16 }} />
                            <Text style={[styles.slideTitle, { color: theme.colors.text }]}>{item.title}</Text>
                            <Text style={[styles.slideDesc, { color: theme.colors.textSecondary }]}>{item.description}</Text>
                        </View>
                    </View>
                )}
             />

             <View style={styles.footerContainer}>
                 <Paginator data={SLIDES} scrollX={scrollX} theme={theme} />
                 
                 <TouchableOpacity 
                    onPress={handleNextSlide}
                    style={[styles.circleButton, { backgroundColor: theme.colors.primary }]}
                >
                    {currentIndex === SLIDES.length - 1 ? (
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={28} color="white" />
                    ) : (
                        <HugeiconsIcon icon={ArrowRight01Icon} size={28} color="white" />
                    )}
                </TouchableOpacity>
             </View>

             <PrivacyModal
                visible={privacyVisible}
                onClose={() => setPrivacyVisible(false)}
                onAgree={handlePrivacyAgreed}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    skipContainer: { alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 10 },
    skipText: { fontSize: 16, fontWeight: '600' },
    
    slideContainer: { width: SCREEN_WIDTH, alignItems: 'center', padding: 32, justifyContent: 'center' },
    slideImage: { width: SCREEN_WIDTH * 0.8, height: SCREEN_WIDTH * 0.8, marginBottom: 40 },
    slideTextContainer: { alignItems: 'center' },
    slideTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    slideDesc: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
    
    footerContainer: { 
        paddingHorizontal: 32, 
        paddingBottom: 50, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
    },
    circleButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    }
});