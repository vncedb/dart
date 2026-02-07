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
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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

const CONTAINER_WIDTH = 340;
const CONTAINER_HEIGHT = 520;
const CLOCK_SIZE = 240;
const CENTER = CLOCK_SIZE / 2;
const RADIUS = CLOCK_SIZE / 2 - 32;

const getShortestPath = (current: number, target: number) => {
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
  const [viewMode, setViewMode] = useState<"DIGITAL" | "ANALOG">("DIGITAL");
  const [showModal, setShowModal] = useState(visible);

  // Animations
  const animation = useSharedValue(0); 
  const modeAnim = useSharedValue(0); 
  const angle = useSharedValue(0);
  
  const modeRef = useRef<"HOUR" | "MINUTE">("HOUR");
  const lastHapticValue = useRef<number | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      setViewMode("DIGITAL");
      modeAnim.value = 0; 
      
      let h = initialHours;
      if (h === 0) h = 12;
      if (h > 12) h -= 12;
      setHours(h);
      setMinutes(initialMinutes || 0);
      setPeriod(initialPeriod || "AM");
      setMode("HOUR");

      animation.value = withSpring(1, {
        damping: 18,
        stiffness: 120,
        mass: 1,
      });
    } else {
      animation.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setShowModal)(false);
        }
      });
    }
  }, [visible, initialHours, initialMinutes, initialPeriod]);

  useEffect(() => {
    if (viewMode === "ANALOG") {
      modeAnim.value = withTiming(1, { duration: 300 });
    } else {
      modeAnim.value = withTiming(0, { duration: 300 });
    }
  }, [viewMode]);

  const handleClose = () => {
    onClose();
  };

  const handleConfirm = () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onConfirm(hours, minutes, period);
    onClose();
  };

  const updateAngleForMode = (targetMode: "HOUR" | "MINUTE", h: number, m: number) => {
    const val = targetMode === "HOUR" ? (h === 12 ? 0 : h) : m;
    const step = targetMode === "HOUR" ? 30 : 6;
    const targetAngle = val * step;
    
    // Animate to new angle
    angle.value = withSpring(targetAngle, {
        damping: 16,
        stiffness: 120
    });
  };

  const openAnalog = (targetMode: "HOUR" | "MINUTE") => {
    setMode(targetMode);
    
    // Snap instantly when opening
    const val = targetMode === "HOUR" ? (hours === 12 ? 0 : hours) : minutes;
    const step = targetMode === "HOUR" ? 30 : 6;
    angle.value = val * step;
    
    setViewMode("ANALOG");
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };

  const switchToMinuteMode = () => {
      setMode("MINUTE");
      updateAngleForMode("MINUTE", hours, minutes);
  };

  const handleCenterTap = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setViewMode("DIGITAL");
  };

  const handleTouch = (x: number, y: number, finish: boolean) => {
    isDragging.current = !finish;

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
      if (val === 0 || val === 12) val = 12;
      else if (val > 12) val -= 12;
    } else {
      const step = 6;
      snappedAngle = Math.round(theta / step) * step;
      val = Math.round(snappedAngle / 6);
      if (val === 60) val = 0;
    }

    if (val !== lastHapticValue.current) {
      if (Platform.OS !== "web") Haptics.selectionAsync();
      lastHapticValue.current = val;
      if (currentMode === "HOUR") setHours(val);
      else setMinutes(val);
    }

    if (!finish) {
      angle.value = getShortestPath(angle.value, theta);
    } else {
      const finalSnap = getShortestPath(angle.value, snappedAngle);
      angle.value = withSpring(finalSnap, {
          damping: 15,
          stiffness: 150
      });

      // Smart Flow: Auto-advance
      if (currentMode === "HOUR") {
          // Wait briefly then switch to Minutes
          setTimeout(() => {
              runOnJS(switchToMinuteMode)();
          }, 450);
      } else {
          // Wait briefly then return to Digital
          setTimeout(() => {
            runOnJS(setViewMode)("DIGITAL");
          }, 450); 
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY, false),
      onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY, false),
      onPanResponderRelease: (evt) => handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY, true),
    }),
  ).current;

  const handProps = useAnimatedProps(() => {
    const rad = (angle.value - 90) * (Math.PI / 180);
    return {
      x2: CENTER + RADIUS * Math.cos(rad),
      y2: CENTER + RADIUS * Math.sin(rad),
    };
  });

  const knobProps = useAnimatedProps(() => {
    const rad = (angle.value - 90) * (Math.PI / 180);
    return {
      cx: CENTER + RADIUS * Math.cos(rad),
      cy: CENTER + RADIUS * Math.sin(rad),
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: animation.value }));
  const containerStyle = useAnimatedStyle(() => {
    const scale = interpolate(animation.value, [0, 1], [0.92, 1]);
    return {
        opacity: animation.value,
        transform: [{ scale }],
    };
  });

  const digitalViewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modeAnim.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(modeAnim.value, [0, 1], [1, 0.9]) }],
    zIndex: modeAnim.value < 0.5 ? 1 : 0, 
  }));

  const analogViewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modeAnim.value, [0, 1], [0, 1]),
    transform: [{ scale: interpolate(modeAnim.value, [0, 1], [1.1, 1]) }],
    zIndex: modeAnim.value > 0.5 ? 1 : 0,
  }));

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <Pressable onPress={handleClose} style={StyleSheet.absoluteFill} />

        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.container,
              { backgroundColor: theme.colors.card },
              containerStyle,
            ]}
          >
            <ModalHeader title={title} position="center" />
            
            <View style={styles.bodyContainer}>
              
              {/* DIGITAL VIEW */}
              <Animated.View 
                style={[styles.absoluteFill, digitalViewStyle]}
                pointerEvents={viewMode === "DIGITAL" ? "auto" : "none"}
              >
                <View style={styles.centerContent}>
                  <View style={styles.timeDisplay}>
                    {/* Hour Display */}
                    <TouchableOpacity
                      onPress={() => openAnalog('HOUR')}
                      activeOpacity={0.8}
                      style={[
                          styles.timeUnit,
                          mode === 'HOUR' && viewMode === 'ANALOG' && styles.activeTimeUnit,
                          { backgroundColor: theme.colors.background }
                      ]}
                    >
                      <Text style={[
                          styles.timeText, 
                          { color: theme.colors.text }
                      ]}>
                        {hours === 0 ? 12 : hours}
                      </Text>
                      <Text style={[styles.label, {color: theme.colors.textSecondary}]}>HOURS</Text>
                    </TouchableOpacity>
                    
                    <Text style={[styles.colon, { color: theme.colors.text }]}>:</Text>
                    
                    {/* Minute Display */}
                    <TouchableOpacity
                      onPress={() => openAnalog('MINUTE')}
                      activeOpacity={0.8}
                      style={[
                          styles.timeUnit,
                          mode === 'MINUTE' && viewMode === 'ANALOG' && styles.activeTimeUnit,
                          { backgroundColor: theme.colors.background }
                      ]}
                    >
                      <Text style={[
                          styles.timeText, 
                          { color: theme.colors.text }
                      ]}>
                        {minutes.toString().padStart(2, "0")}
                      </Text>
                      <Text style={[styles.label, {color: theme.colors.textSecondary}]}>MINUTES</Text>
                    </TouchableOpacity>
                    
                    {/* AM/PM Switcher */}
                    <View style={styles.ampmContainer}>
                      {["AM", "PM"].map((p) => (
                        <TouchableOpacity
                          key={p}
                          onPress={() => {
                            setPeriod(p as any);
                            if (Platform.OS !== "web")
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          style={[
                            styles.ampmButton,
                            period === p 
                                ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                                : { backgroundColor: 'transparent', borderColor: theme.colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.ampmText,
                              {
                                color: period === p ? "#FFF" : theme.colors.textSecondary,
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
              </Animated.View>

              {/* ANALOG VIEW */}
              <Animated.View 
                style={[styles.absoluteFill, analogViewStyle]}
                pointerEvents={viewMode === "ANALOG" ? "auto" : "none"}
              >
                <View style={styles.centerContent}>
                  <View style={styles.clockWrapper}>
                    <View style={styles.clockContainer} {...panResponder.panHandlers}>
                        <Svg height={CLOCK_SIZE} width={CLOCK_SIZE}>
                        {/* 1. Background Ring */}
                        <Circle
                            cx={CENTER}
                            cy={CENTER}
                            r={CLOCK_SIZE / 2 - 4}
                            fill={theme.colors.background}
                            stroke={theme.colors.border}
                            strokeWidth={1}
                        />

                        {/* 2. Hands & Selector Tip */}
                        <AnimatedLine
                            x1={CENTER}
                            y1={CENTER}
                            stroke={theme.colors.primary}
                            strokeWidth="3"
                            strokeLinecap="round"
                            animatedProps={handProps}
                        />
                        <AnimatedCircle
                            r="18"
                            fill={theme.colors.primary}
                            animatedProps={knobProps}
                        />

                        {/* 3. Numbers */}
                        {mode === "HOUR" &&
                            Array.from({ length: 12 }).map((_, i) => {
                            const val = i + 1;
                            const angleRad = (val * 30 - 90) * (Math.PI / 180);
                            const isSelected = hours === val || (hours === 0 && val === 12);
                            return (
                                <G key={i}>
                                <SvgText
                                    x={CENTER + RADIUS * Math.cos(angleRad)}
                                    y={CENTER + RADIUS * Math.sin(angleRad) + 5}
                                    fill={isSelected ? "#FFFFFF" : theme.colors.text}
                                    fontSize="16"
                                    fontWeight="700"
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
                        
                        {/* 4. Center Pivot */}
                        <Circle
                            cx={CENTER}
                            cy={CENTER}
                            r={4}
                            fill={theme.colors.primary}
                        />

                        {/* 5. Center Info Label */}
                        <Circle
                            cx={CENTER}
                            cy={CENTER}
                            r={26} 
                            fill={theme.colors.card}
                            stroke={theme.colors.border}
                            strokeWidth={0.5}
                        />
                        <SvgText
                            x={CENTER}
                            y={CENTER + 6}
                            fill={theme.colors.primary}
                            fontSize="20"
                            fontWeight="800"
                            textAnchor="middle"
                        >
                            {mode === "HOUR" 
                                ? (hours === 0 ? 12 : hours) 
                                : minutes.toString().padStart(2, '0')
                            }
                        </SvgText>
                        <SvgText
                            x={CENTER}
                            y={CENTER + 16}
                            fill={theme.colors.textSecondary}
                            fontSize="6"
                            fontWeight="700"
                            textAnchor="middle"
                            letterSpacing="0.5"
                        >
                            {mode === "HOUR" ? "HR" : "MIN"}
                        </SvgText>
                        </Svg>
                    </View>

                    {/* Button to confirm analog selection manually if needed */}
                    <TouchableOpacity 
                        style={styles.centerButtonOverlay}
                        onPress={handleCenterTap}
                        activeOpacity={0.7}
                    />
                  </View>
                  <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
                      {mode === "HOUR" ? "Select Hour" : "Select Minute"}
                  </Text>
                </View>
              </Animated.View>

            </View>

            <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
              <Button
                title="Cancel"
                variant="neutral"
                onPress={handleClose}
                style={{ flex: 1 }}
              />
              <View style={{ width: 16 }} />
              <Button
                title="Confirm"
                variant="primary"
                onPress={handleConfirm}
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
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    borderRadius: 28,
    overflow: "hidden",
    elevation: 20,
    flexDirection: 'column', 
  },
  bodyContainer: {
    flex: 1, 
    position: 'relative',
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockWrapper: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
  },
  clockContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerButtonOverlay: {
      position: 'absolute',
      top: (CLOCK_SIZE / 2) - 30, 
      left: (CLOCK_SIZE / 2) - 30,
      width: 60,
      height: 60,
      borderRadius: 30,
  },
  timeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timeUnit: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activeTimeUnit: {
      borderColor: '#3b82f6', // Example active color, usually theme.primary
      backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  timeText: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  label: {
      fontSize: 10,
      fontWeight: '700',
      marginTop: 4,
      letterSpacing: 1,
      opacity: 0.6,
  },
  colon: { 
      fontSize: 40, 
      fontWeight: "700", 
      marginBottom: 24, 
      opacity: 0.5,
      marginHorizontal: 8,
  },
  ampmContainer: { flexDirection: "column", marginLeft: 16, gap: 8 },
  ampmButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: 'center',
  },
  ampmText: { fontSize: 13, fontWeight: "800" },
  hintText: {
      marginTop: 24,
      fontSize: 14,
      fontWeight: '600',
      opacity: 0.8,
  },
  footer: { 
      flexDirection: "row", 
      padding: 20, 
      borderTopWidth: 1,
      marginTop: 'auto',
  },
});