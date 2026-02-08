import {
  ArrowRight01Icon,
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
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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

export default function OnboardingScreen() {
    const { completeOnboarding } = useAuth();
    const router = useRouter();
    const theme = useAppTheme();
    const isDark = theme.dark;
    
    // State: 'WELCOME' or 'INTRO'
    const [step, setStep] = useState<'WELCOME' | 'INTRO'>('WELCOME');
    const [privacyVisible, setPrivacyVisible] = useState(false);
    
    // Carousel State
    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const handlePrivacyAgreed = () => {
        // Privacy Modal calls this when agreed
        setTimeout(() => {
            setStep('INTRO');
        }, 300);
    };

    const handleFinish = async () => {
        await completeOnboarding();
        router.replace('/(tabs)/home');
    };

    const handleNextSlide = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            handleFinish();
        }
    };

    // --- RENDER: WELCOME STEP ---
    if (step === 'WELCOME') {
        return (
            <Animated.View 
                entering={FadeIn} 
                exiting={FadeOut}
                style={{ flex: 1, backgroundColor: theme.colors.background }}
            >
                <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

                <SafeAreaView style={{ flex: 1 }}>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
                        
                        {/* LOGO CONTAINER (Matches Intro Slide Style) */}
                        <View style={[styles.imageContainer, { backgroundColor: theme.colors.card }]}>
                            <Image 
                                source={isDark ? require('../assets/images/dart-logo-transparent-light.png') : require('../assets/images/dart-logo-transparent-dark.png')} 
                                style={{ width: '60%', height: '60%' }} 
                                resizeMode="contain" 
                            />
                        </View>

                        {/* TEXT CONTENT */}
                        <View style={styles.textContainer}>
                            <View style={styles.titleRow}>
                                <Text style={[styles.slideTitle, { color: theme.colors.text, fontSize: 32 }]}>
                                    Welcome
                                </Text>
                            </View>
                            
                            <Text style={[styles.slideDesc, { color: theme.colors.textSecondary }]}>
                                To your personal companion for tracking daily accomplishments, generating reports, and more.
                            </Text>
                        </View>
                    </View>

                    {/* ACTIONS */}
                    <View style={styles.bottomControls}>
                        <TouchableOpacity 
                            onPress={() => setPrivacyVisible(true)}
                            activeOpacity={0.9} 
                            style={[styles.nextButton, { backgroundColor: theme.colors.primary, width: '100%', flexDirection: 'row', gap: 12 }]}
                        >
                            <Text style={styles.nextButtonText}>Let&apos;s Go</Text>
                            <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>

                <PrivacyModal
                    visible={privacyVisible}
                    onClose={() => setPrivacyVisible(false)}
                    onAgree={handlePrivacyAgreed}
                />
            </Animated.View>
        );
    }

    // --- RENDER: INTRO STEP ---
    return (
        <Animated.View entering={FadeIn} style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
                renderItem={({ item }) => (
                    <View style={styles.slideContainer}>
                         <View style={[styles.imageContainer, { backgroundColor: theme.colors.card }]}>
                            <Image source={item.image} style={styles.slideImage} resizeMode="contain" />
                         </View>
                         
                         <View style={styles.textContainer}>
                             <View style={styles.titleRow}>
                                 <HugeiconsIcon icon={item.icon} size={28} color={theme.colors.primary} />
                                 <Text style={[styles.slideTitle, { color: theme.colors.text }]}>{item.title}</Text>
                             </View>
                             
                             <Text style={[styles.slideDesc, { color: theme.colors.textSecondary }]}>
                                 {item.description}
                             </Text>
                         </View>
                    </View>
                )}
            />

            <View style={styles.bottomControls}>
                {/* Pagination Dots */}
                <View style={styles.paginationDots}>
                    {SLIDES.map((_, i) => (
                        <View 
                            key={i} 
                            style={{ 
                                width: i === currentIndex ? 24 : 8, 
                                height: 8, 
                                borderRadius: 4, 
                                backgroundColor: i === currentIndex ? theme.colors.primary : theme.colors.border 
                            }} 
                        />
                    ))}
                </View>

                {/* Next / Finish Button */}
                <TouchableOpacity
                    onPress={handleNextSlide}
                    style={[styles.nextButton, { backgroundColor: theme.colors.primary }]}
                    activeOpacity={0.8}
                >
                    <Text style={styles.nextButtonText}>
                        {currentIndex === SLIDES.length - 1 ? "Finish" : "Next"}
                    </Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    // Shared Styles
    slideContainer: { width: SCREEN_WIDTH, flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center' },
    
    imageContainer: { 
        width: SCREEN_WIDTH * 0.8, 
        height: SCREEN_WIDTH * 0.8, 
        borderRadius: 40,
        marginBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5
    },
    
    slideImage: { width: '80%', height: '80%' },
    
    textContainer: { alignItems: 'center', width: '100%' },
    
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
    
    slideTitle: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
    
    slideDesc: { fontSize: 16, textAlign: 'center', lineHeight: 26, paddingHorizontal: 10 },

    // Bottom Controls
    bottomControls: { padding: 32, paddingBottom: 50, width: '100%' },
    
    paginationDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
    
    nextButton: { 
        padding: 18, 
        borderRadius: 20, 
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    
    nextButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});