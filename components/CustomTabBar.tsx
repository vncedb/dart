import { File02Icon, Home01Icon, UserCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  
  return (
    <View className="absolute bottom-0 items-center w-full pointer-events-box-none">
      <View 
        style={[
          styles.glassContainer,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }
        ]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Updated Map
          const icons: any = {
            home: Home01Icon, // 'index' changed to 'home'
            reports: File02Icon,
            profile: UserCircleIcon,
          };

          const IconComponent = icons[route.name] || Home01Icon;
          
          return (
            <TabIcon 
              key={route.key}
              isFocused={isFocused}
              onPress={onPress}
              IconComponent={IconComponent}
            />
          );
        })}
      </View>
    </View>
  );
}

// ... TabIcon and styles remain the same as previously fixed ...
function TabIcon({ isFocused, onPress, IconComponent }: any) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1 : 0.9, { damping: 10 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.tabButton}
      activeOpacity={0.7}
    >
      <Animated.View 
        style={[
            styles.iconContainer, 
            animatedStyle, 
            { backgroundColor: isFocused ? '#6366f1' : 'transparent' }
        ]}
      >
        <HugeiconsIcon 
          icon={IconComponent}
          size={24} 
          color={isFocused ? 'white' : '#94a3b8'} 
          strokeWidth={2}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    flexDirection: 'row',
    width: '85%',
    borderRadius: 9999,
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 50,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    height: 44,
    width: 44,
  }
});