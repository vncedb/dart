import { ArrowRight01Icon, CheckmarkCircle01Icon, Shield02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
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
  useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to DART',
    description: 'Your all-in-one daily accomplishment report tracker designed for efficiency.',
    image: require('../assets/images/intro/welcome.png'), 
  },
  {
    id: '2',
    title: 'Track Progress',
    description: 'Log your daily tasks, monitor your performance, and generate reports instantly.',
    image: require('../assets/images/intro/track.png'),
  },
  {
    id: '3',
    title: 'Secure & Private',
    description: 'We use bank-grade encryption to ensure your data stays safe and strictly yours.',
    image: require('../assets/images/intro/security.png'),
  },
  {
    id: '4',
    title: 'Get Started',
    description: "Let's set up your profile to personalize your experience.",
    image: require('../assets/images/intro/get-started.png'),
  }
];

const PrivacyModal = ({ visible, onAgree, isDark }: { visible: boolean, onAgree: () => void, isDark: boolean }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View 
          style={{ 
            height: height * 0.75, 
            backgroundColor: isDark ? '#1e293b' : '#ffffff', 
            borderTopLeftRadius: 32, 
            borderTopRightRadius: 32,
            padding: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 20
          }}
        >
          <View className="items-center mb-6">
            <View className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mb-6" />
            <View className="p-4 bg-indigo-100 rounded-full dark:bg-indigo-900/30">
               <HugeiconsIcon icon={Shield02Icon} size={32} color="#6366f1" />
            </View>
            <Text className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Privacy Agreement</Text>
          </View>

          <ScrollView className="flex-1 mb-6" showsVerticalScrollIndicator={false}>
            <Text className="mb-4 leading-6 text-slate-600 dark:text-slate-300">
              Your privacy is important to us. Before you continue, please review how we handle your data.
            </Text>
            
            <Text className="mb-2 font-bold text-slate-900 dark:text-white">1. Data Collection</Text>
            <Text className="mb-4 leading-6 text-slate-600 dark:text-slate-300">
              We collect information you provide directly to us, such as when you create an account, update your profile, or use our interactive features.
            </Text>

            <Text className="mb-2 font-bold text-slate-900 dark:text-white">2. Data Usage</Text>
            <Text className="mb-4 leading-6 text-slate-600 dark:text-slate-300">
              We use the information we collect to operate, maintain, and improve our services. We do not sell your personal data to third parties.
            </Text>

            <Text className="mb-2 font-bold text-slate-900 dark:text-white">3. Security</Text>
            <Text className="mb-4 leading-6 text-slate-600 dark:text-slate-300">
              We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access.
            </Text>
          </ScrollView>

          <TouchableOpacity 
            onPress={onAgree}
            className="flex-row items-center justify-center w-full gap-2 bg-indigo-600 shadow-lg h-14 rounded-2xl shadow-indigo-500/30"
          >
            <Text className="text-lg font-bold text-white">I Agree & Continue</Text>
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function IntroductionScreen() {
  const router = useRouter();
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
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
      // Go to the Welcome (All Set) screen
      router.push('/onboarding/welcome');
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
      <View style={{ width, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Animated.View 
            style={[{ 
                width: width * 0.8, 
                height: width * 0.8, 
                marginBottom: 40, 
                borderRadius: 40, 
                backgroundColor: isDark ? '#27235E' : '#e0e7ff', 
                alignItems: 'center',
                justifyContent: 'center',
                padding: 30,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
                shadowColor: "#6366f1", 
                shadowOffset: {width: 0, height: 10}, 
                shadowOpacity: 0.2, 
                shadowRadius: 20, 
                elevation: 10 
            }, animatedStyle]}
        >
             <Image source={item.image} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Animated.View>
        <Text className="mb-4 text-3xl font-extrabold text-center text-slate-900 dark:text-white">{item.title}</Text>
        <Text className="px-5 text-base leading-6 text-center text-slate-500 dark:text-slate-300">{item.description}</Text>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
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
            ref={flatListRef as any}
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

        <View className="flex-1 justify-between items-center px-[30px] pb-[50px]">
          <View className="flex-row items-center h-10">
            {SLIDES.map((_, index) => {
              const animatedDotStyle = useAnimatedStyle(() => {
                const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
                const widthDot = interpolate(scrollX.value, inputRange, [10, 30, 10], Extrapolation.CLAMP);
                const opacity = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP);
                return { width: widthDot, opacity };
              });
              return <Animated.View key={index.toString()} className="h-2.5 rounded-full bg-indigo-500 mx-1.5" style={animatedDotStyle} />;
            })}
          </View>

          <TouchableOpacity 
            onPress={handleNext} 
            className="flex-row items-center justify-center w-full gap-3 bg-indigo-600 shadow-lg shadow-indigo-500/40 rounded-2xl py-[18px] px-10"
          >
            <Text className="text-lg font-bold text-white">
              {currentIndex === SLIDES.length - 1 ? "Let's Go" : "Next"}
            </Text>
            <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}