import {
    Briefcase01Icon,
    Clock01Icon,
    HourglassIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import React, { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Button from "./Button";
import DurationPicker from "./DurationPicker";
import TimePicker from "./TimePicker";

interface OvertimeModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number) => void;
  theme: any;
}

const ANIMATION_EASING = Easing.out(Easing.quad);

export default function OvertimeModal({
  visible,
  onClose,
  onConfirm,
  theme,
}: OvertimeModalProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showModal, setShowModal] = useState(visible);

  const openAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      openAnim.value = 0;
      openAnim.value = withTiming(1, {
        duration: 300,
        easing: ANIMATION_EASING,
      });
    }
  }, [visible]);

  const handleClose = () => {
    openAnim.value = withTiming(
      0,
      { duration: 250, easing: ANIMATION_EASING },
      (finished) => {
        if (finished) runOnJS(onClose)();
        if (finished) runOnJS(setShowModal)(false);
      },
    );
  };

  const handleDurationConfirm = (h: number, m: number) => {
    const totalHours = h + m / 60;
    if (totalHours > 0) {
      handleClose();
      setTimeout(() => onConfirm(totalHours), 100);
    }
  };

  const handleTimeConfirm = (h: number, m: number, p?: "AM" | "PM") => {
    const now = new Date();
    const targetDate = new Date();
    let hour = h;

    if (p === "PM" && h < 12) hour += 12;
    if (p === "AM" && h === 12) hour = 0;

    targetDate.setHours(hour);
    targetDate.setMinutes(m);

    // Calculate difference
    const diff = (targetDate.getTime() - now.getTime()) / 3600000;
    const finalHours = Math.max(0, diff);

    if (finalHours >= 0) {
      handleClose();
      setTimeout(() => onConfirm(finalHours), 100);
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: openAnim.value }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: openAnim.value,
    transform: [{ scale: interpolate(openAnim.value, [0, 1], [0.95, 1]) }],
  }));

  if (!showModal) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <Pressable onPress={handleClose} style={StyleSheet.absoluteFill}>
          <View style={styles.overlay} />
        </Pressable>

        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.container,
              { backgroundColor: theme.colors.card },
              containerStyle,
            ]}
          >
            <View style={styles.headerContent}>
              <View
                style={[
                  styles.iconWrapper,
                  { backgroundColor: theme.colors.warning + "15" },
                ]}
              >
                <HugeiconsIcon
                  icon={Briefcase01Icon}
                  size={32}
                  color={theme.colors.warning}
                />
              </View>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Overtime Detected
              </Text>
              <Text
                style={[styles.subtitle, { color: theme.colors.textSecondary }]}
              >
                You are checking out late. How would you like to record this
                overtime?
              </Text>
            </View>

            <View style={styles.selectionGrid}>
              <TouchableOpacity
                onPress={() => setShowDurationPicker(true)}
                activeOpacity={0.8}
                style={[
                  styles.selectionBtn,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.btnIcon,
                    { backgroundColor: theme.colors.primary + "15" },
                  ]}
                >
                  <HugeiconsIcon
                    icon={HourglassIcon}
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={[styles.btnTitle, { color: theme.colors.text }]}>
                  Set Duration
                </Text>
                <Text
                  style={[styles.btnSub, { color: theme.colors.textSecondary }]}
                >
                  Add total hours
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.8}
                style={[
                  styles.selectionBtn,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.btnIcon,
                    { backgroundColor: theme.colors.primary + "15" },
                  ]}
                >
                  <HugeiconsIcon
                    icon={Clock01Icon}
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={[styles.btnTitle, { color: theme.colors.text }]}>
                  Set End Time
                </Text>
                <Text
                  style={[styles.btnSub, { color: theme.colors.textSecondary }]}
                >
                  Pick checkout time
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[styles.footer, { borderTopColor: theme.colors.border }]}
            >
              <Button
                title="Cancel"
                variant="neutral"
                onPress={handleClose}
                style={{ flex: 1 }}
              />
            </View>
          </Animated.View>
        </Pressable>

        {/* Pickers */}
        <TimePicker
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onConfirm={handleTimeConfirm}
          initialHours={
            new Date().getHours() > 12
              ? new Date().getHours() - 12
              : new Date().getHours() === 0
                ? 12
                : new Date().getHours()
          }
          initialMinutes={new Date().getMinutes()}
          initialPeriod={new Date().getHours() >= 12 ? "PM" : "AM"}
          title="Set Check Out Time"
        />

        <DurationPicker
          visible={showDurationPicker}
          onClose={() => setShowDurationPicker(false)}
          onConfirm={handleDurationConfirm}
          initialHours={0}
          initialMinutes={0}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  container: {
    width: 340,
    borderRadius: 28,
    overflow: "hidden", // Changed back to hidden so padding applies correctly inside
    elevation: 20,
  },
  headerContent: {
    alignItems: "center",
    paddingTop: 24, // Moved padding here to match standard modal look
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  selectionGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  selectionBtn: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  btnTitle: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  btnSub: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    opacity: 0.8,
  },

  footer: {
    flexDirection: "row", // Matches TimePicker layout
    padding: 20, // Matches TimePicker padding
    borderTopWidth: 1,
  },
});
