import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppSplash() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* EXACT LAYOUT REPLICATION OF index.tsx 
         We use the same padding and flex structure to ensure the logo 
         is in the exact same pixel position.
      */}
      <View 
        className="justify-between flex-1 px-6"
        style={{ 
            paddingTop: insets.top + 32, 
            paddingBottom: insets.bottom + 32 
        }}
      >
        
        {/* GHOST ELEMENT: Top Bar (Invisible) */}
        <View className="flex-row justify-end opacity-0">
            <View className="w-12 h-12 border rounded-full" />
        </View>

        {/* VISIBLE CONTENT: Logo (Exact match to index.tsx) */}
        <View className="items-center">
            <View className="items-center justify-center w-40 h-40 mb-8 bg-white shadow-2xl shadow-black/50 rounded-[40px]">
                <Image 
                    source={require('../assets/images/dart-logo-transparent.png')} 
                    style={{ width: 110, height: 110 }} 
                    resizeMode="contain" 
                />
            </View>
            <Text className={`text-lg font-medium text-center max-w-[90%] ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                Daily Accomplishment Report Tools
            </Text>
        </View>

        {/* BOTTOM SECTION: Placeholder + Loader */}
        <View className="relative w-full gap-4 mb-4">
            
            {/* GHOST ELEMENTS: Bottom Buttons (Invisible) 
                These reserve the exact height so the logo above doesn't shift.
            */}
            <View className="w-full h-16 opacity-0" /> 
            <View className="w-full h-16 opacity-0" />
            <Text className="mt-4 text-xs font-medium text-center opacity-0">
                Powered by Project Vdb
            </Text>

            {/* LOADER: Positioned absolutely over the invisible buttons */}
            <View className="absolute inset-0 items-center justify-center -top-8">
                <ActivityIndicator size="large" color={isDark ? "#ffffff" : "#4f46e5"} />
                <Text className={`mt-4 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Loading...
                </Text>
            </View>

        </View>

      </View>
    </View>
  );
}