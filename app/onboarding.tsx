import { ArrowRight01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
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
        // Assuming the file is located at assets/onboarding/track.png based on your path
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
        title: 'Stay Secure and Synchronized',
        description: 'Your data is encrypted and synced across all your devices. Access your workspace from anywhere, anytime.',
        image: require('../assets/onboarding/secure.png'),
    }
];

const PaginatorDot = ({ index, scrollX, theme }: { index: number, scrollX: Animated.SharedValue<number>, theme: any }) => {
    const inputRange = [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH];
    
    const animatedStyle = useAnimatedStyle(() => {
        const width = interpolate(scrollX.value, inputRange, [8, 24, 8], 'clamp');
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
        // Privacy Modal handles the async update if integrated, 
        // but here we ensure consistency with your previous flow
        setPrivacyVisible(false);
        if (completeOnboarding) await completeOnboarding();
        router.replace('/(tabs)/home');
    };

    return (
        <Animated.View entering={FadeInDown} style={[styles.container, { backgroundColor: theme.colors.background }]}>
             <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
             
             {/* Skip Button - Top Right */}
             <SafeAreaView style={styles.skipContainer}>
                 <TouchableOpacity 
                    onPress={() => setPrivacyVisible(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                 >
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
                        <View style={styles.imageContainer}>
                            <Image source={item.image} style={styles.slideImage} resizeMode="contain" />
                        </View>
                        <View style={styles.slideTextContainer}>
                            {/* Icons removed as requested */}
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
                    activeOpacity={0.8}
                    style={[styles.circleButton, { backgroundColor: theme.colors.primary }]}
                >
                    {currentIndex === SLIDES.length - 1 ? (
                        <HugeiconsIcon icon={Tick01Icon} size={28} color="white" strokeWidth={3} />
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
    skipContainer: { 
        width: '100%',
        alignItems: 'flex-end', 
        paddingHorizontal: 24, 
        paddingTop: 10,
        zIndex: 10
    },
    skipText: { fontSize: 16, fontWeight: '600', opacity: 0.8 },
    
    slideContainer: { width: SCREEN_WIDTH, alignItems: 'center', padding: 32, justifyContent: 'center' },
    imageContainer: {
        width: SCREEN_WIDTH * 0.8,
        height: SCREEN_WIDTH * 0.8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    slideImage: { width: '100%', height: '100%' },
    
    slideTextContainer: { alignItems: 'center', maxWidth: '90%' },
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