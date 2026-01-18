import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
    Modal,
    PanResponder,
    Platform,
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
    useAnimatedProps,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { useAppTheme } from "../constants/theme";
import Button from "./Button";
import ModalHeader from "./ModalHeader";

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TimePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number, minutes: number, period?: "AM" | "PM") => void;
  title?: string;
  initialHours?: number;
  initialMinutes?: number;
  initialPeriod?: "AM" | "PM";
}

const CLOCK_SIZE = 260;
const CENTER = CLOCK_SIZE / 2;
const RADIUS = CLOCK_SIZE / 2 - 32;
const SMOOTH_EASING = Easing.out(Easing.cubic);

const snapToClosest = (current: number, target: number) => {
  const diff = ((target - (current % 360) + 540) % 360) - 180;
  return current + diff;
};

export default function TimePicker({
  visible,
  onClose,
  onConfirm,
  title = "Select Time",
  initialHours = 12,
  initialMinutes = 0,
  initialPeriod = "AM",
}: TimePickerProps) {
  const theme = useAppTheme();
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [period, setPeriod] = useState<"AM" | "PM">(initialPeriod || "AM");
  const [mode, setMode] = useState<"HOUR" | "MINUTE">("HOUR");
  const [showModal, setShowModal] = useState(visible);

  // Animations
  const openAnim = useSharedValue(0);
  const angle = useSharedValue(0);
  const modeRef = useRef<"HOUR" | "MINUTE">("HOUR");
  const lastHapticValue = useRef<number | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      let h = initialHours;
      if (h === 0) h = 12;
      if (h > 12) h -= 12;
      setHours(h);
      setMinutes(initialMinutes || 0);
      setPeriod(initialPeriod || "AM");
      setMode("HOUR");
      const startAngle = (h === 12 ? 0 : h) * 30;
      angle.value = startAngle;

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
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let targetAngle =
      mode === "HOUR" ? (hours === 12 ? 0 : hours) * 30 : minutes * 6;
    const current = angle.value;
    const next = snapToClosest(current, targetAngle);
    // Changed easing to standard cubic to remove bounce
    angle.value = withTiming(next, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [mode, hours, minutes]);

  const handleTouch = (x: number, y: number, finish: boolean) => {
    const dx = x - CENTER;
    const dy = y - CENTER;
    let theta = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (theta < 0) theta += 360;

    const currentMode = modeRef.current;
    let val = 0;
    let snappedAngle = 0;

    if (currentMode === "HOUR") {
      const step = 30;
      snappedAngle = Math.round(theta / step) * step;
      val = Math.round(snappedAngle / 30);
      if (val === 0) val = 12;
    } else {
      const step = 6;
      snappedAngle = Math.round(theta / step) * step;
      val = Math.round(snappedAngle / 6);
      if (val === 60) val = 0;
    }

    if (val !== lastHapticValue.current) {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      lastHapticValue.current = val;
    }

    angle.value = withTiming(snapToClosest(angle.value, snappedAngle), {
      duration: 50,
      easing: Easing.linear,
    });

    if (currentMode === "HOUR") {
      if (finish) {
        setHours(val);
        setMode("MINUTE");
      } else {
        setHours(val);
      }
    } else {
      setMinutes(val);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) =>
        handleTouch(
          evt.nativeEvent.locationX,
          evt.nativeEvent.locationY,
          false,
        ),
      onPanResponderMove: (evt) =>
        handleTouch(
          evt.nativeEvent.locationX,
          evt.nativeEvent.locationY,
          false,
        ),
      onPanResponderRelease: (evt) =>
        handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY, true),
    }),
  ).current;

  const handProps = useAnimatedProps(() => ({
    x2: CENTER + RADIUS * Math.cos((angle.value - 90) * (Math.PI / 180)),
    y2: CENTER + RADIUS * Math.sin((angle.value - 90) * (Math.PI / 180)),
  }));
  const knobProps = useAnimatedProps(() => ({
    cx: CENTER + RADIUS * Math.cos((angle.value - 90) * (Math.PI / 180)),
    cy: CENTER + RADIUS * Math.sin((angle.value - 90) * (Math.PI / 180)),
  }));

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
            <ModalHeader title={title} position="center" />
            <View style={styles.header}>
              <View style={styles.timeDisplay}>
                <TouchableOpacity
                  onPress={() => {
                    setMode("HOUR");
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.timeUnit,
                    mode === "HOUR"
                      ? {
                          backgroundColor: theme.colors.primary + "15",
                          borderRadius: 12,
                        }
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeText,
                      {
                        color:
                          mode === "HOUR"
                            ? theme.colors.primary
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {hours === 0 ? 12 : hours}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.colon, { color: theme.colors.text }]}>
                  :
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setMode("MINUTE");
                    if (Platform.OS !== "web")
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.timeUnit,
                    mode === "MINUTE"
                      ? {
                          backgroundColor: theme.colors.primary + "15",
                          borderRadius: 12,
                        }
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeText,
                      {
                        color:
                          mode === "MINUTE"
                            ? theme.colors.primary
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {minutes.toString().padStart(2, "0")}
                  </Text>
                </TouchableOpacity>
                <View style={styles.ampmContainer}>
                  {["AM", "PM"].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => {
                        setPeriod(p as any);
                        if (Platform.OS !== "web")
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Medium,
                          );
                      }}
                      style={[
                        styles.ampmButton,
                        period === p && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                        period !== p && { borderColor: theme.colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ampmText,
                          {
                            color:
                              period === p
                                ? "#FFF"
                                : theme.colors.textSecondary,
                          },
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.clockContainer} {...panResponder.panHandlers}>
              <Svg height={CLOCK_SIZE} width={CLOCK_SIZE}>
                <Circle
                  cx={CENTER}
                  cy={CENTER}
                  r={CLOCK_SIZE / 2 - 4}
                  fill={theme.colors.background}
                />
                <Circle
                  cx={CENTER}
                  cy={CENTER}
                  r={4}
                  fill={theme.colors.primary}
                />
                <AnimatedLine
                  x1={CENTER}
                  y1={CENTER}
                  stroke={theme.colors.primary}
                  strokeWidth="2"
                  animatedProps={handProps}
                />
                <AnimatedCircle
                  r="18"
                  fill={theme.colors.primary}
                  animatedProps={knobProps}
                />
                {mode === "HOUR" &&
                  Array.from({ length: 12 }).map((_, i) => {
                    const val = i + 1;
                    const angleRad = (val * 30 - 90) * (Math.PI / 180);
                    const isSelected =
                      hours === val || (hours === 0 && val === 12);
                    return (
                      <G key={i}>
                        <SvgText
                          x={CENTER + RADIUS * Math.cos(angleRad)}
                          y={CENTER + RADIUS * Math.sin(angleRad) + 5}
                          fill={isSelected ? "#FFFFFF" : theme.colors.text}
                          fontSize="16"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {val}
                        </SvgText>
                      </G>
                    );
                  })}
                {mode === "MINUTE" &&
                  Array.from({ length: 12 }).map((_, i) => {
                    const val = i * 5;
                    const angleRad = (i * 30 - 90) * (Math.PI / 180);
                    const isSelected = minutes === val;
                    return (
                      <G key={i}>
                        <SvgText
                          x={CENTER + RADIUS * Math.cos(angleRad)}
                          y={CENTER + RADIUS * Math.sin(angleRad) + 5}
                          fill={isSelected ? "#FFFFFF" : theme.colors.text}
                          fontSize="14"
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {val.toString().padStart(2, "0")}
                        </SvgText>
                      </G>
                    );
                  })}
              </Svg>
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
              <View style={{ width: 16 }} />
              <Button
                title="Confirm"
                variant="primary"
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  onConfirm(hours, minutes, period);
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
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 10 },
  timeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timeUnit: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  colon: { fontSize: 50, fontWeight: "700", marginBottom: 8, opacity: 0.5 },
  ampmContainer: { flexDirection: "column", marginLeft: 20, gap: 8 },
  ampmButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
  },
  ampmText: { fontSize: 13, fontWeight: "800" },
  clockContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  footer: { flexDirection: "row", padding: 20, borderTopWidth: 1 },
});
