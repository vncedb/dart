import {
    Alert02Icon,
    AlertCircleIcon,
    Cancel01Icon,
    CheckmarkCircle02Icon,
    InformationCircleIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    StyleProp,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from 'react-native';

export type TooltipType = 'error' | 'info' | 'warning' | 'success';

interface AnimatedTooltipProps {
  visible: boolean;
  message: string;
  type?: TooltipType;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  className?: string;
  arrowPosition?: 'right' | 'left' | 'center';
}

const TOOLTIP_CONFIG = {
  error: {
    icon: AlertCircleIcon,
    bgLight: 'bg-white',
    bgDark: 'bg-slate-800',
    borderLight: 'border-red-200',
    borderDark: 'border-red-900/50',
    titleColorLight: 'text-red-600',
    titleColorDark: 'text-red-400',
    textLight: 'text-slate-600',
    textDark: 'text-slate-300',
    iconColor: '#ef4444',
    title: 'Attention Needed',
  },
  info: {
    icon: InformationCircleIcon,
    bgLight: 'bg-white',
    bgDark: 'bg-slate-800',
    borderLight: 'border-blue-200',
    borderDark: 'border-blue-900/50',
    titleColorLight: 'text-blue-600',
    titleColorDark: 'text-blue-400',
    textLight: 'text-slate-600',
    textDark: 'text-slate-300',
    iconColor: '#3b82f6',
    title: 'Did you know?',
  },
  warning: {
    icon: Alert02Icon,
    bgLight: 'bg-white',
    bgDark: 'bg-slate-800',
    borderLight: 'border-amber-200',
    borderDark: 'border-amber-900/50',
    titleColorLight: 'text-amber-600',
    titleColorDark: 'text-amber-400',
    textLight: 'text-slate-600',
    textDark: 'text-slate-300',
    iconColor: '#f59e0b',
    title: 'Warning',
  },
  success: {
    icon: CheckmarkCircle02Icon,
    bgLight: 'bg-white',
    bgDark: 'bg-slate-800',
    borderLight: 'border-green-200',
    borderDark: 'border-green-900/50',
    titleColorLight: 'text-green-600',
    titleColorDark: 'text-green-400',
    textLight: 'text-slate-600',
    textDark: 'text-slate-300',
    iconColor: '#22c55e',
    title: 'Good to go!',
  },
};

export default function AnimatedTooltip({
  visible,
  message,
  type = 'info',
  onDismiss,
  style,
  className = '',
  arrowPosition = 'right',
}: AnimatedTooltipProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isRendered, setIsRendered] = useState(visible);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5)),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
        Animated.timing(slideAnim, {
          toValue: 10,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsRendered(false);
      });
    }
  }, [visible]);

  if (!isRendered) return null;

  const config = TOOLTIP_CONFIG[type];
  const { icon: Icon } = config;

  // Arrow Positioning
  let arrowClass = 'right-5';
  if (arrowPosition === 'left') arrowClass = 'left-5';
  if (arrowPosition === 'center') arrowClass = 'left-1/2 -ml-2';

  return (
    <Animated.View
      style={[
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        style,
      ]}
      // Changed: Removed 'right-0' default. Now relies on className or default layout.
      className={`absolute z-50 w-64 top-14 ${className}`}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View className="w-full">
          {/* Triangle Pointer */}
          <View
            className={`absolute -top-2 w-4 h-4 rotate-45 border-l border-t ${arrowClass}
              ${isDark ? config.bgDark : config.bgLight} 
              ${isDark ? config.borderDark : config.borderLight}`}
          />
          {/* Card */}
          <View
            className={`p-4 rounded-xl shadow-xl border 
              ${isDark ? config.bgDark : config.bgLight} 
              ${isDark ? config.borderDark : config.borderLight}`}
          >
            <View className="flex-row items-start gap-3">
              <View className="mt-1">
                <HugeiconsIcon
                  icon={Icon}
                  size={20}
                  color={config.iconColor}
                  variant="solid"
                />
              </View>
              <View className="flex-1">
                <Text className={`text-xs font-bold mb-1 ${isDark ? config.titleColorDark : config.titleColorLight}`}>
                  {config.title}
                </Text>
                <Text className={`text-xs leading-5 ${isDark ? config.textDark : config.textLight}`}>
                  {message}
                </Text>
              </View>
              {onDismiss && (
                <TouchableOpacity onPress={onDismiss} hitSlop={10}>
                    <HugeiconsIcon icon={Cancel01Icon} size={14} color={isDark ? '#94a3b8' : '#cbd5e1'} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}