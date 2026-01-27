import {
  ArrowLeft02Icon,
  MoreVerticalCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../constants/theme";
import ActionMenu from "./ActionMenu";

export interface HeaderAction {
  label: string;
  icon: any;
  onPress: () => void;
  color?: string;
  destructive?: boolean;
}

interface HeaderProps {
  title: string | React.ReactNode;
  onBack?: () => void;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  menuActions?: HeaderAction[];
}

export default function Header({
  title,
  onBack,
  leftElement,
  rightElement,
  menuActions,
}: HeaderProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const containerRef = useRef<View>(null);

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<
    { x: number; y: number } | undefined
  >(undefined);

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const handleMenuPress = () => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        setMenuAnchor({
          x: pageX + width - 16,
          y: pageY + height + 4,
        });
        setMenuVisible(true);
      });
    }
  };

  return (
    <View
      ref={containerRef}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
        },
      ]}
      collapsable={false}
    >
      {/* 1. Left Action */}
      <View style={styles.leftContainer}>
        {leftElement ? (
          leftElement
        ) : (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={ArrowLeft02Icon}
              size={24}
              color={theme.colors.icon}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Title Layer */}
      {typeof title === "string" ? (
        <View style={styles.titleWrapperAbsolute} pointerEvents="none">
          <Text
            style={[styles.titleText, { color: theme.colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>
      ) : (
        // Flex wrapper for Search Input to ensure it centers perfectly
        <View style={styles.titleWrapperFlex}>{title}</View>
      )}

      {/* 3. Right Action */}
      <View style={styles.rightContainer}>
        {rightElement}

        {menuActions && (
          <TouchableOpacity
            onPress={handleMenuPress}
            style={[styles.iconButton, { marginLeft: 4 }]}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={MoreVerticalCircle01Icon}
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        )}
      </View>

      {menuActions && (
        <ActionMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          actions={menuActions}
          anchor={menuAnchor}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: "row",
    alignItems: "center", // This aligns left/right icons vertically
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    position: "relative",
    zIndex: 10,
  },
  titleWrapperAbsolute: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: -1,
    paddingHorizontal: 60,
  },
  titleWrapperFlex: {
    flex: 1,
    height: "100%", // Take full height of header
    justifyContent: "center", // Vertical Center
    paddingHorizontal: 8,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  leftContainer: {
    alignItems: "flex-start",
    justifyContent: "center",
    zIndex: 20,
    minWidth: 40,
    height: "100%", // Full height to ensure alignment
  },
  rightContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 20,
    minWidth: 40,
    height: "100%", // Full height to ensure alignment
  },
  iconButton: {
    padding: 8,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
});