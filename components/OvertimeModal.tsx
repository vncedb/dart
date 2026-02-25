import {
  ArrowRight01Icon,
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
  View
} from "react-native";
import Animated, {
  Easing,
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

const MODAL_OFFSET = 500;

export default function OvertimeModal({
  visible,
  onClose,
  onConfirm,
  theme,
}: OvertimeModalProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showModal, setShowModal] = useState(visible);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(MODAL_OFFSET);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) });
    }
  }, [visible]);

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(MODAL_OFFSET, { duration: 250, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) {
            runOnJS(onClose)();
            runOnJS(setShowModal)(false);
        }
    });
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

    const diff = (targetDate.getTime() - now.getTime()) / 3600000;
    const finalHours = Math.max(0, diff);

    if (finalHours >= 0) {
      handleClose();
      setTimeout(() => onConfirm(finalHours), 100);
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({ 
      opacity: opacity.value,
      backgroundColor: 'rgba(0,0,0,0.5)'
  }));
  
  const containerStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }]
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
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <Pressable onPress={handleClose} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', alignItems: 'center' }}>
          <Animated.View
            style={[
              styles.container,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
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
                Overtime Log
              </Text>
              <Text
                style={[styles.subtitle, { color: theme.colors.textSecondary }]}
              >
                Your session has exceeded your scheduled shift. Please log the excess time appropriately.
              </Text>
            </View>

            <View style={styles.actionList}>
              <TouchableOpacity
                onPress={() => setShowDurationPicker(true)}
                activeOpacity={0.7}
                style={[styles.actionCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              >
                <View style={[styles.actionIconBox, { backgroundColor: theme.colors.primary + "10" }]}>
                  <HugeiconsIcon icon={HourglassIcon} size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.actionTextContent}>
                  <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Set Duration</Text>
                  <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>Add the exact total of hours</Text>
                </View>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={theme.colors.icon} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
                style={[styles.actionCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              >
                <View style={[styles.actionIconBox, { backgroundColor: theme.colors.primary + "10" }]}>
                  <HugeiconsIcon icon={Clock01Icon} size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.actionTextContent}>
                  <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Set End Time</Text>
                  <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>Pick your actual checkout time</Text>
                </View>
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={theme.colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
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
              : new Date().getHours() === 0 ? 12 : new Date().getHours()
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
    paddingHorizontal: 24, // Matches standard Selection Modal padding
    zIndex: 999,
  },
  container: {
    width: '100%', // Removes max-width constraint to match selection modal
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 15,
  },
  headerContent: {
    alignItems: "center",
    paddingTop: 32,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito_500Medium",
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.7,
  },
  actionList: {
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  actionTextContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  actionSub: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    opacity: 0.6,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
});