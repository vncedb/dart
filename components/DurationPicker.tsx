import React, { useEffect, useRef, useState } from "react";
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
import { useAppTheme } from "../constants/theme";
import Button from "./Button";
import ModalHeader from "./ModalHeader";

interface DurationPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number, minutes: number) => void;
  initialHours?: number;
  initialMinutes?: number;
}

const SMOOTH_EASING = Easing.out(Easing.cubic);

const TickerNumber = ({ value, max }: { value: number; max: number }) => {
  const theme = useAppTheme();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      const direction = value > prevValue.current ? -1 : 1;
      const effectiveDir =
        prevValue.current === 0 && value === max
          ? 1
          : prevValue.current === max && value === 0
            ? -1
            : direction;

      translateY.value = withTiming(effectiveDir * 20, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 }, (finished) => {
        if (finished) {
          runOnJS(setDisplayValue)(value);
          translateY.value = -effectiveDir * 20;
          translateY.value = withTiming(0, {
            duration: 200,
            easing: SMOOTH_EASING,
          });
          opacity.value = withTiming(1, { duration: 200 });
        }
      });
      prevValue.current = value;
    }
  }, [value, max]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <View
      style={{
        height: 40,
        width: 60,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Animated.Text
        style={[
          { fontSize: 32, fontWeight: "800", color: theme.colors.text },
          animatedStyle,
        ]}
      >
        {displayValue.toString().padStart(2, "0")}
      </Animated.Text>
    </View>
  );
};

export default function DurationPicker({
  visible,
  onClose,
  onConfirm,
  initialHours = 0,
  initialMinutes = 0,
}: DurationPickerProps) {
  const theme = useAppTheme();
  const [durHours, setDurHours] = useState(initialHours);
  const [durMins, setDurMins] = useState(initialMinutes);
  const [showModal, setShowModal] = useState(visible);

  const openAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      setDurHours(initialHours);
      setDurMins(initialMinutes);
      openAnim.value = 0;
      openAnim.value = withTiming(1, { duration: 350, easing: SMOOTH_EASING });
    } else {
      openAnim.value = withTiming(
        0,
        { duration: 250, easing: SMOOTH_EASING },
        (finished) => {
          if (finished) runOnJS(setShowModal)(false);
        },
      );
    }
  }, [visible, initialHours, initialMinutes]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: openAnim.value }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: openAnim.value,
    transform: [{ scale: interpolate(openAnim.value, [0, 1], [0.9, 1]) }],
  }));

  if (!showModal) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Removed onPress={onClose} */}
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.container,
              { backgroundColor: theme.colors.card },
              containerStyle,
            ]}
          >
            <ModalHeader title="Set Duration" position="center" />
            <View style={styles.content}>
              <View style={{ gap: 40, alignItems: "center" }}>
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: theme.colors.textSecondary,
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Hours
                  </Text>
                  <View
                    style={[
                      styles.tickerContainer,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        setDurHours(durHours === 0 ? 23 : durHours - 1)
                      }
                      style={[
                        styles.roundBtn,
                        { backgroundColor: theme.colors.card },
                      ]}
                    >
                      <Text
                        style={[styles.btnText, { color: theme.colors.text }]}
                      >
                        -
                      </Text>
                    </TouchableOpacity>
                    <TickerNumber value={durHours} max={23} />
                    <TouchableOpacity
                      onPress={() =>
                        setDurHours(durHours === 23 ? 0 : durHours + 1)
                      }
                      style={[
                        styles.roundBtn,
                        { backgroundColor: theme.colors.card },
                      ]}
                    >
                      <Text
                        style={[styles.btnText, { color: theme.colors.text }]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: theme.colors.textSecondary,
                      marginBottom: 12,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Minutes
                  </Text>
                  <View
                    style={[
                      styles.tickerContainer,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        setDurMins(durMins === 0 ? 59 : durMins - 1)
                      }
                      style={[
                        styles.roundBtn,
                        { backgroundColor: theme.colors.card },
                      ]}
                    >
                      <Text
                        style={[styles.btnText, { color: theme.colors.text }]}
                      >
                        -
                      </Text>
                    </TouchableOpacity>
                    <TickerNumber value={durMins} max={59} />
                    <TouchableOpacity
                      onPress={() =>
                        setDurMins(durMins === 59 ? 0 : durMins + 1)
                      }
                      style={[
                        styles.roundBtn,
                        { backgroundColor: theme.colors.card },
                      ]}
                    >
                      <Text
                        style={[styles.btnText, { color: theme.colors.text }]}
                      >
                        +
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
            <View
              style={[styles.footer, { borderTopColor: theme.colors.border }]}
            >
              <Button
                title="Cancel"
                variant="neutral"
                onPress={onClose}
                style={{ flex: 1 }}
              />
              <View style={{ width: 12 }} />
              <Button
                title="Confirm"
                variant="primary"
                onPress={() => {
                  onConfirm(durHours, durMins);
                  onClose();
                }}
                style={{ flex: 1 }}
              />
            </View>
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  container: {
    width: 340,
    borderRadius: 28,
    overflow: "hidden",
    elevation: 20,
  },
  content: { paddingVertical: 40, alignItems: "center" },
  tickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  roundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  btnText: { fontSize: 24, fontWeight: "600" },
  footer: { padding: 16, borderTopWidth: 1, flexDirection: "row" },
});
