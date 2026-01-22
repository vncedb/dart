import { ArrowRight01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function IntroductionScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Pulse animation for the success icon
  const scale = useSharedValue(1);
  
  useEffect(() => {
    scale.value = withRepeat(withSpring(1.1, { damping: 10 }), -1, true);
  }, []);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleContinue = () => {
    router.replace('/onboarding/welcome');
  };

  return (
    <SafeAreaView className="justify-center flex-1 px-8 bg-white dark:bg-slate-900">
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View className="items-center justify-center flex-1">
        <Animated.View 
            entering={FadeInUp.delay(200).springify()}
            style={[animatedIconStyle]}
            className="p-8 mb-8 bg-green-100 rounded-full dark:bg-green-900/20"
        >
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={64} color="#22c55e" />
        </Animated.View>

        <Animated.Text 
            entering={FadeInUp.delay(400).springify()}
            className="mb-4 text-4xl font-black text-center text-slate-900 dark:text-white"
        >
            Account Created
        </Animated.Text>

        <Animated.Text 
            entering={FadeInUp.delay(600).springify()}
            className="text-lg font-medium leading-8 text-center text-slate-500 dark:text-slate-400"
        >
            Welcome to DART. Your journey to better efficiency starts here. Let's get your profile set up.
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.delay(800).springify()} className="mb-8">
        <TouchableOpacity 
            onPress={handleContinue}
            className="flex-row items-center justify-center w-full h-16 gap-3 bg-indigo-600 shadow-xl shadow-indigo-500/30 rounded-2xl active:opacity-90"
        >
            <Text className="text-xl font-bold tracking-wide text-white">Personalize Profile</Text>
            <HugeiconsIcon icon={ArrowRight01Icon} size={24} color="white" strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}