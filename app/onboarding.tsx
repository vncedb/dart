import { ArrowRight01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from 'nativewind';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import Animated, {
    Extrapolation,
    FadeInRight,
    FadeOutLeft,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrivacyModal from '../components/PrivacyModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

// --- SLIDESHOW DATA ---
const SLIDES = [
  {
    id: '1',
    title: 'Track Daily',
    subtitle: 'Efficiency Redefined',
    description: 'Log your daily accomplishments effortlessly. Keep your productivity aligned with your goals.',
    image: require('../assets/images/intro/track.png'), 
  },
  {
    id: '2',
    title: 'Stay Secure',
    subtitle: 'Private & Encrypted',
    description: 'Your data is yours alone. Work offline securely and sync only when you want to.',
    image: require('../assets/images/intro/security.png'),
  },
  {
    id: '3',
    title: 'Generate Reports',
    subtitle: 'Instant Insights',
    description: 'Turn your daily logs into comprehensive PDF reports with a single tap.',
    image: require('../assets/images/intro/welcome.png'),
  }
];

// --- COMPONENT: PAGINATION DOT ---
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

export default function OnboardingScreen() {
  const { completeOnboarding, user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State: 'welcome' (slides) OR 'info' (form)
  const [viewState, setViewState] = useState<'welcome' | 'info'>('welcome');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Slideshow Logic
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<Animated.FlatList<any>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Form Logic
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');

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

  const handleNextSlide = () => {
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
    // If Guest -> Complete immediately
    // If User -> Show Info Form
    if (user?.is_guest) {
        await completeOnboarding();
    } else {
        setViewState('info');
    }
  };

  const handleSaveInfo = async () => {
    if (!name || !jobTitle) return; // Basic validation
    setIsLoading(true);
    try {
      if (user?.id) {
        await supabase.from('profiles').upsert({
            id: user.id,
            full_name: name,
            email: user.email,
            updated_at: new Date(),
        });

        await supabase.from('job_positions').upsert({
            user_id: user.id,
            title: jobTitle,
            department: department || 'General',
            is_active: true
        });
      }
      await completeOnboarding();
    } catch (error) {
        console.error("Error saving profile:", error);
        // Fallback: complete anyway to not block user
        await completeOnboarding();
    } finally {
        setIsLoading(false);
    }
  };

  // --- RENDER ITEM FOR SLIDESHOW ---
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

  // --- VIEW: SLIDESHOW ---
  if (viewState === 'welcome') {
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
                    onPress={handleNextSlide}
                    className="items-center justify-center w-16 h-16 bg-indigo-600 rounded-full shadow-lg shadow-indigo-500/40"
                >
                    <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="white" strokeWidth={2.5} />
                </TouchableOpacity>
            </View>
          </View>
        </View>
      );
  }

  // --- VIEW: INFO FORM ---
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Animated.View 
            entering={FadeInRight} 
            exiting={FadeOutLeft} 
            className="flex-1 bg-white dark:bg-slate-950"
        >
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            <View style={{ paddingTop: insets.top + 20, paddingHorizontal: 32 }}>
                <View className="mb-8">
                    <Text className={`text-4xl font-black mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        About You
                    </Text>
                    <Text className={`text-base font-medium leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Let's personalize your experience. These details will appear on your generated reports.
                    </Text>
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="gap-6">
                    <View>
                        <Text className={`mb-2 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Full Name</Text>
                        <TextInput 
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Juan Dela Cruz"
                            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                            className={`w-full h-14 border rounded-2xl px-4 font-medium text-lg ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        />
                    </View>

                    <View>
                        <Text className={`mb-2 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Job Title</Text>
                        <TextInput 
                            value={jobTitle}
                            onChangeText={setJobTitle}
                            placeholder="e.g. Software Engineer"
                            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                            className={`w-full h-14 border rounded-2xl px-4 font-medium text-lg ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        />
                    </View>

                    <View>
                        <Text className={`mb-2 font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Department (Optional)</Text>
                        <TextInput 
                            value={department}
                            onChangeText={setDepartment}
                            placeholder="e.g. IT Department"
                            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                            className={`w-full h-14 border rounded-2xl px-4 font-medium text-lg ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        />
                    </View>
                </KeyboardAvoidingView>
            </View>

            <View className="absolute bottom-0 w-full px-8" style={{ paddingBottom: insets.bottom + 20 }}>
                <TouchableOpacity 
                    onPress={handleSaveInfo}
                    disabled={!name || !jobTitle || isLoading}
                    className={`w-full h-16 rounded-2xl flex-row items-center justify-center gap-3 shadow-lg ${(!name || !jobTitle) ? 'bg-slate-300 dark:bg-slate-800 opacity-50' : 'bg-indigo-600 shadow-indigo-500/30'}`}
                >
                    {isLoading ? (
                        <Text className="text-lg font-bold text-white">Saving...</Text>
                    ) : (
                        <>
                            <Text className="text-xl font-bold tracking-wide text-white">Complete Setup</Text>
                            <HugeiconsIcon icon={Tick02Icon} size={24} color="white" strokeWidth={3} />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </Animated.View>
    </TouchableWithoutFeedback>
  );
}