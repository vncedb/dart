import { HugeiconsIcon } from "@hugeicons/react-native";
import React, { useEffect } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "../constants/theme";

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
  /** * Exact position for the top-right corner of the menu.
   */
  anchor?: { x: number; y: number };
}

const AnimatedView = Animated.createAnimatedComponent(View);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MENU_WIDTH = 180;

export default function ActionMenu({
  visible,
  onClose,
  actions,
  anchor,
}: ActionMenuProps) {
  const theme = useAppTheme();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(-10);
  const translateX = useSharedValue(10);

  useEffect(() => {
    if (visible) {
      const springConfig = {
        damping: 18,
        mass: 0.6,
        stiffness: 220,
        overshootClamping: false,
      };
      opacity.value = withTiming(1, { duration: 150 });
      scale.value = withSpring(1, springConfig);
      translateY.value = withSpring(0, springConfig);
      translateX.value = withSpring(0, springConfig);
    } else {
      opacity.value = withTiming(0, { duration: 120 });
      scale.value = withTiming(0.8, {
        duration: 120,
        easing: Easing.in(Easing.quad),
      });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    transformOrigin: ["100%", "0%", 0],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      opacity.value,
      [0, 1],
      ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.2)"],
    ),
  }));

  if (!visible) return null;

  // Anchoring Logic
  // Default to 80px top if no anchor.
  // We place the menu *below* the anchor Y.
  const topPosition = anchor ? anchor.y : 80;

  // We align the *right* edge of the menu with the anchor X.
  // Ensure it doesn't go off-screen (padding 16px).
  const rightPosition = anchor ? Math.max(16, SCREEN_WIDTH - anchor.x) : 20;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <AnimatedPressable
        style={[styles.overlay, backdropStyle]}
        onPress={onClose}
      >
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
            animatedStyle,
          ]}
        >
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setTimeout(() => {
                  onClose();
                  requestAnimationFrame(() => action.onPress());
                }, 50);
              }}
              style={[
                styles.menuItem,
                index < actions.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border + "40",
                },
              ]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: action.destructive
                      ? theme.colors.danger + "10"
                      : theme.colors.primary + "08",
                  },
                ]}
              >
                <HugeiconsIcon
                  icon={action.icon}
                  size={18}
                  color={
                    action.destructive
                      ? theme.colors.danger
                      : theme.colors.primary
                  }
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.menuText,
                  {
                    color: action.destructive
                      ? theme.colors.danger
                      : theme.colors.text,
                  },
                ]}
              >
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
  },
  menuContainer: {
    position: "absolute",
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    overflow: "hidden",
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  menuText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
    flex: 1,
  },
});
