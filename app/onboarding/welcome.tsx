import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    StatusBar,
    Text,
    View
} from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Footer from '../../components/Footer';
import PrivacyModal from '../../components/PrivacyModal';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to DART',
    description: 'Your all-in-one daily accomplishment report tracker designed for efficiency.',
    image: require('../../assets/images/intro/welcome.png'), 
  },
  {
    id: '2',
    title: 'Track Progress',
    description: 'Log your daily tasks, monitor your performance, and generate reports instantly.',
    image: require('../../assets/images/intro/track.png'),
  },
  {
    id: '3',
    title: 'Secure & Private',
    description: 'We use bank-grade encryption to ensure your data stays safe and strictly yours.',
    image: require('../../assets/images/intro/security.png'),
  },
  {
    id: '4',
    title: 'Get Started',
    description: "Let's set up your profile to personalize your experience.",
    image: require('../../assets/images/intro/get-started.png'),
  }
];

const PaginationDot = ({ index, scrollX, isDark }: { index: number, scrollX: SharedValue<number>, isDark: boolean }) => {
    const animatedDotStyle = useAnimatedStyle(() => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
        const widthDot = interpolate(scrollX.value, inputRange, [8, 32, 8], Extrapolation.CLAMP);
        const opacity = interpolate(scrollX.value, inputRange, [0.4, 1, 0.4], Extrapolation.CLAMP);
        return { 
            width: widthDot, 
            opacity,
            backgroundColor: isDark ? '#6366f1' : '#4f46e5' 
        };
    });

    return <Animated.View style={[animatedDotStyle, { height: 8, borderRadius: 4, marginHorizontal: 4 }]} />;
};

export default function WelcomeScreen() {
  const router = useRouter();
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
    } catch (error) {
      console.log('Permission Error:', error);
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

  const handlePrivacyAgree = () => {
    setShowPrivacy(false);
    setTimeout(() => {
      router.replace('/onboarding/info');
    }, 300);
  };

  const RenderItem = ({ item, index }: { item: typeof SLIDES[0], index: number }) => {
    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * width,
        index * width,
        (index + 1) * width,
      ];
      const scale = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP);
      const opacity = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP);
      return { transform: [{ scale }], opacity };
    });

    return (
      <View style={{ width, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View 
            style={[{ 
                width: width * 0.8, 
                height: width * 0.8, 
                marginBottom: 40, 
                borderRadius: 40, 
                backgroundColor: isDark ? 'rgba(30, 27, 75, 0.5)' : 'rgba(255, 255, 255, 0.6)', 
                alignItems: 'center',
                justifyContent: 'center',
                padding: 30,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)',
                shadowColor: "#6366f1", 
                shadowOffset: {width: 0, height: 10}, 
                shadowOpacity: 0.15, 
                shadowRadius: 20, 
                elevation: 10 
            }, animatedStyle]}
        >
             <Image source={item.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Animated.View>
        <Text className={`mb-4 text-3xl font-extrabold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {item.title}
        </Text>
        <Text className={`px-4 text-base leading-6 text-center ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
            {item.description}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
      <PrivacyModal visible={showPrivacy} onAgree={handlePrivacyAgree} isDark={isDark} />
      
      <LinearGradient
        colors={isDark ? ['#0F172A', '#1E1B4B'] : ['#F8FAFC', '#E0E7FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flex: 3 }}>
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
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / width);
              setCurrentIndex(index);
            }}
          />
        </View>

        <View style={{ height: 140, justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 20 }}>
                {SLIDES.map((_, index) => (
                    <PaginationDot key={index.toString()} index={index} scrollX={scrollX} isDark={isDark} />
                ))}
            </View>

            <Footer>
                <Button 
                    title={currentIndex === SLIDES.length - 1 ? "Let's Get Started" : "Next"}
                    onPress={handleNext}
                    variant="primary"
                    style={{ width: '100%' }}
                    icon={<HugeiconsIcon icon={ArrowRight01Icon} color="white" size={20} />}
                />
            </Footer>
        </View>
      </View>
    </View>
  );
}