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

// Define ActionItem shape locally (or import if exported)
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
  rightElement?: React.ReactNode;
  /**
   * If provided, renders a "More" icon on the right and handles the ActionMenu
   * positioned below the header edge.
   */
  menuActions?: HeaderAction[];
}

export default function Header({
  title,
  onBack,
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
    // Measure the Header container to determine the anchor point
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        // Anchor Y: pageY + height (Bottom of the header)
        // Anchor X: pageX + width (Right edge of the header)
        // We subtract padding (16) to align with content visually
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
      collapsable={false} // Important for Android measurement
    >
      {/* 1. Title Layer */}
      <View style={styles.titleWrapper} pointerEvents="none">
        {typeof title === "string" ? (
          <Text
            style={[styles.titleText, { color: theme.colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        ) : (
          title
        )}
      </View>

      {/* 2. Left Action */}
      <View style={styles.leftContainer}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={theme.colors.icon} />
        </TouchableOpacity>
      </View>

      {/* 3. Right Action */}
      <View style={styles.rightContainer}>
        {rightElement}

        {/* Integrated Action Menu Trigger */}
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

      {/* Integrated Action Menu Modal */}
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    position: "relative",
    zIndex: 10, // Ensure header sits above content for menu logic
  },
  titleWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: "60%",
  },
  leftContainer: {
    alignItems: "flex-start",
    zIndex: 20,
  },
  rightContainer: {
    flexDirection: "row", // Support multiple right elements
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 20,
    minWidth: 40,
  },
  iconButton: {
    padding: 8,
    borderRadius: 9999,
    // Negative margins help hit-slop feel natural without visual spacing issues
    // marginLeft: -8, // Removed negative margin for right container to avoid overlap
  },
});
