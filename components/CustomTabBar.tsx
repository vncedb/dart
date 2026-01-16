import { File02Icon, Home01Icon, UserCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../constants/theme';

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  
  return (
    <View className="absolute bottom-0 items-center w-full pointer-events-box-none">
      <View 
        style={[
          styles.glassContainer,
          { 
            paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
            backgroundColor: theme.colors.glass,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.primary, 
          }
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

          const icons: any = {
            home: Home01Icon,
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
              theme={theme}
            />
          );
        })}
      </View>
    </View>
  );
}

// Memoized to prevent re-renders of non-active tabs during interactions
const TabIcon = memo(function TabIcon({ isFocused, onPress, IconComponent, theme }: any) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    // Adjusted spring config for a "snappier" (faster) feel
    // Higher stiffness = faster movement
    scale.value = withSpring(isFocused ? 1 : 0.9, { 
        stiffness: 300, 
        damping: 20,
        mass: 0.5 
    });
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
            { backgroundColor: isFocused ? theme.colors.primary : 'transparent' }
        ]}
      >
        <HugeiconsIcon 
          icon={IconComponent}
          size={24} 
          color={isFocused ? '#ffffff' : theme.colors.icon} 
          strokeWidth={2}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

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
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
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