import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useAppTheme } from '../constants/theme';

interface ActionItem {
  label: string;
  icon: any;
  onPress: () => void;
  color?: string; 
  destructive?: boolean;
}

interface ActionMenuProps {
  visible: boolean;
  onClose: () => void;
  actions: ActionItem[];
  // anchor: { x: global X of tap/element, y: global Y of bottom of element }
  anchor?: { x: number, y: number }; 
}

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = 220;

export default function ActionMenu({ visible, onClose, actions, anchor }: ActionMenuProps) {
  const theme = useAppTheme();
  
  // Animation values
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      // HyperOS 3.0 style spring physics: Snappy but fluid
      const springConfig = {
        damping: 15,
        mass: 0.8,
        stiffness: 160,
        overshootClamping: false,
      };

      opacity.value = withTiming(1, { duration: 200 }); // Slightly slower for smoother fade
      scale.value = withSpring(1, springConfig);
      translateY.value = withSpring(0, springConfig);
      translateX.value = withSpring(0, springConfig);
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.5, { duration: 150, easing: Easing.in(Easing.ease) });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ]
  }));

  // Backdrop darkening animation
  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      opacity.value,
      [0, 1],
      ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.4)'] // Significantly darker (0.4) for HyperOS feel
    ),
  }));

  if (!visible) return null;

  // Position Calculation
  const topPosition = anchor ? anchor.y : 80;
  // Ensure menu stays within screen bounds (right edge)
  const rightPosition = anchor ? Math.max(16, SCREEN_WIDTH - anchor.x - 10) : 20;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <AnimatedPressable style={[styles.overlay, backdropStyle]} onPress={onClose}>
        <AnimatedView 
            style={[
                styles.menuContainer, 
                { 
                  backgroundColor: theme.colors.card, 
                  borderColor: theme.colors.border,
                  width: MENU_WIDTH,
                  top: topPosition,
                  right: rightPosition,
                },
                animatedStyle
            ]}
        >
            {actions.map((action, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => {
                   // Visual feedback before closing
                   setTimeout(() => {
                     onClose();
                     requestAnimationFrame(() => action.onPress());
                   }, 80);
                }}
                style={[
                    styles.menuItem,
                    index < actions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                ]}
                activeOpacity={0.6}
              >
                <View style={[styles.iconBox, { backgroundColor: action.destructive ? theme.colors.danger + '15' : theme.colors.primary + '10' }]}>
                    <HugeiconsIcon 
                        icon={action.icon} 
                        size={20} 
                        color={action.destructive ? theme.colors.danger : theme.colors.primary} 
                    />
                </View>
                <Text style={[
                    styles.menuText, 
                    { color: action.destructive ? theme.colors.danger : theme.colors.text }
                ]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
        </AnimatedView>
      </AnimatedPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // Background color is handled by animated style now
  },
  menuContainer: {
    position: 'absolute',
    borderRadius: 20, // HyperOS rounded corners
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
    paddingVertical: 4, 
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  }
});