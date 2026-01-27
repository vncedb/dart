import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router'; // Import Router
import { useColorScheme } from 'nativewind';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  StatusBar,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrivacyModal from '../../components/PrivacyModal';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Track Daily',
    subtitle: 'Efficiency Redefined',
    description: 'Log your daily accomplishments effortlessly. Keep your productivity aligned with your goals.',
    image: require('../../assets/images/intro/track.png'), 
  },
  {
    id: '2',
    title: 'Stay Secure',
    subtitle: 'Private & Encrypted',
    description: 'Your data is yours alone. Work offline securely and sync only when you want to.',
    image: require('../../assets/images/intro/security.png'),
  },
  {
    id: '3',
    title: 'Generate Reports',
    subtitle: 'Instant Insights',
    description: 'Turn your daily logs into comprehensive PDF reports with a single tap.',
    image: require('../../assets/images/intro/welcome.png'),
  }
];

const Dot = ({ index, currentIndex, isDark }: { index: number, currentIndex: number, isDark: boolean }) => {
    const dotStyle = useAnimatedStyle(() => {
        const active = index === currentIndex;
        return {
            width: withSpring(active ? 24 : 8),
            backgroundColor: withSpring(active ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0')),
        };
    });
    return <Animated.View style={[dotStyle, { height: 8, borderRadius: 4 }]} />;
};

export default function WelcomeScreen() {
  const router = useRouter(); // Initialize Router
  const { completeOnboarding, user } = useAuth(); // Get User
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<Animated.FlatList<any>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  const requestPermissions = async () => {
    try {
      await MediaLibrary.requestPermissionsAsync();
      await Notifications.requestPermissionsAsync();
      setShowPrivacy(true);
    } catch {
      setShowPrivacy(true); 
    }
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      requestPermissions();
    }
  };

  const handlePrivacyAgree = async () => {
    setShowPrivacy(false);
    
    // BRANCHING LOGIC:
    // If Guest -> Complete Onboarding & Go Home
    // If User -> Go to Profile Setup (Info)
    if (user?.is_guest) {
        await completeOnboarding();
    } else {
        router.push('/onboarding/info');
    }
  };

  const RenderItem = ({ item, index }: any) => {
    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
      const scale = interpolate(scrollX.value, inputRange, [0.8, 1, 0.8], Extrapolation.CLAMP);
      const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
      const translateY = interpolate(scrollX.value, inputRange, [50, 0, 50], Extrapolation.CLAMP);
      return { transform: [{ scale }, { translateY }], opacity };
    });

    return (
      <View style={{ width, alignItems: 'center', paddingTop: 60 }}>
        <Animated.View 
            style={[animatedStyle, { 
                width: width * 0.85, 
                height: height * 0.5, 
                borderRadius: 40,
                overflow: 'hidden',
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                elevation: 10,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20
            }]}
        >
             <Image source={item.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Animated.View>

        <View className="items-center px-8 mt-10">
            <Text className="mb-2 text-xs font-bold tracking-widest text-indigo-500 uppercase">
                {item.subtitle}
            </Text>
            <Text className={`text-3xl font-black text-center mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {item.title}
            </Text>
            <Text className={`text-base text-center leading-7 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {item.description}
            </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white dark:bg-slate-950">
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <PrivacyModal visible={showPrivacy} onAgree={handlePrivacyAgree} onDismiss={() => setShowPrivacy(false)} isDark={isDark} />
      
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={({ item, index }) => <RenderItem item={item} index={index} />}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View className="absolute bottom-0 w-full px-8 pb-10" style={{ paddingBottom: insets.bottom + 20 }}>
        <View className="flex-row items-center justify-between">
            <View className="flex-row gap-2">
                {SLIDES.map((_, i) => (
                    <Dot key={i} index={i} currentIndex={currentIndex} isDark={isDark} />
                ))}
            </View>

            <TouchableOpacity 
                onPress={handleNext}
                className="items-center justify-center w-16 h-16 bg-indigo-600 rounded-full shadow-lg shadow-indigo-500/40"
            >
                <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="white" strokeWidth={2.5} />
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}