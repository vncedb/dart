import {
  AlertCircleIcon,
  CheckmarkCircle03Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../constants/theme";

export type AlertType = "success" | "error" | "info" | "warning";
export type AlertPosition = "top" | "bottom";

interface FloatingAlertProps {
  visible: boolean;
  message: string;
  type?: AlertType;
  position?: AlertPosition;
  onHide?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

const ICONS = {
  success: CheckmarkCircle03Icon,
  error: AlertCircleIcon,
  info: InformationCircleIcon,
  warning: AlertCircleIcon,
};

export default function FloatingAlert({
  visible,
  message,
  type = "success",
  position = "top",
  onHide,
  actionLabel,
  onAction,
  duration = 3000,
}: FloatingAlertProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && onHide && duration > 0) {
      const timer = setTimeout(onHide, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onHide]);

  if (!visible) return null;

  const Icon = ICONS[type];
  const isTop = position === "top";

  // Status Colors
  const getStatusColor = () => {
    switch (type) {
      case "success":
        return theme.colors.success;
      case "error":
        return theme.colors.danger;
      case "warning":
        return "#f59e0b";
      default:
        return theme.colors.primary;
    }
  };
  const color = getStatusColor();

  return (
    <Animated.View
      layout={LinearTransition}
      entering={
        isTop
          ? FadeInUp.duration(300).easing(Easing.out(Easing.cubic))
          : FadeInDown.duration(300).easing(Easing.out(Easing.cubic))
      }
      exiting={
        isTop
          ? FadeOutUp.duration(250).easing(Easing.out(Easing.cubic))
          : FadeOutDown.duration(250).easing(Easing.out(Easing.cubic))
      }
      style={[
        styles.container,
        isTop ? { top: insets.top + 10 } : { bottom: insets.bottom + 20 },
        {
          backgroundColor: theme.dark ? "#1F2937" : "#FFFFFF",
          borderColor: theme.colors.border,
          shadowColor: "#000", // FIXED: Used standard hex color instead of theme prop
        },
      ]}
    >
      <View style={styles.content}>
        {/* Icon Section */}
        <View style={[styles.iconBadge, { backgroundColor: color + "15" }]}>
          <HugeiconsIcon icon={Icon} size={20} color={color} />
        </View>

        {/* Message Section */}
        <Text
          style={[styles.message, { color: theme.colors.text }]}
          numberOfLines={2}
        >
          {message}
        </Text>

        {/* Action Button (Right Side) */}
        {actionLabel && onAction && (
          <TouchableOpacity
            onPress={onAction}
            style={[styles.actionBtn, { backgroundColor: color + "10" }]}
          >
            <Text style={[styles.actionText, { color: color }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 9999,
    // Modern Soft Shadow
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
