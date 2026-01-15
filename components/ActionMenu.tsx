import { HugeiconsIcon } from '@hugeicons/react-native';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
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
  // Position is optional, defaults to center or specific coordinates
  anchor?: { x: number, y: number }; 
}

const AnimatedView = Animated.createAnimatedComponent(View);

export default function ActionMenu({ visible, onClose, actions, anchor }: ActionMenuProps) {
  const theme = useAppTheme();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.9, { duration: 150 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  if (!visible) return null;

  // Calculate position: default to top-right if no anchor provided, otherwise use anchor
  const menuStyle = anchor ? {
      top: anchor.y + 10,
      right: 20, // Keep some padding from screen edge
  } : {
      top: 60,
      right: 20
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <AnimatedView 
            style={[
                styles.menuContainer, 
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                menuStyle,
                animatedStyle
            ]}
        >
            {actions.map((action, index) => (
              <TouchableOpacity 
                key={index} 
                onPress={() => {
                    // Slight delay to allow ripple/press effect to be seen
                    setTimeout(() => {
                        onClose();
                        action.onPress();
                    }, 50);
                }}
                style={[
                    styles.menuItem,
                    index < actions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: action.destructive ? theme.colors.danger + '15' : theme.colors.primary + '10' }]}>
                    <HugeiconsIcon 
                        icon={action.icon} 
                        size={18} 
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
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)', // Very subtle dimming
  },
  menuContainer: {
    position: 'absolute',
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
  }
});