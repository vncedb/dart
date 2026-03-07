import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  type SharedValue,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "../constants/theme";
import Button from "./Button";
import ModalHeader from "./ModalHeader";

const ITEM_HEIGHT = 56;
const CONTENT_HEIGHT = 280;
const PADDING_VERTICAL = (CONTENT_HEIGHT - ITEM_HEIGHT) / 2;
const COLUMN_WIDTH = 90;

interface WheelItemProps {
  item: string | number;
  index: number;
  scrollY: SharedValue<number>;
  onPress: (index: number) => void;
  formatLabel: (item: string | number) => string;
  activeColor: string;
  inactiveColor: string;
}

const WheelItem = React.memo(
  function WheelItem({ item, index, scrollY, onPress, formatLabel, activeColor, inactiveColor }: WheelItemProps) {
    const animatedStyle = useAnimatedStyle(() => {
      const itemCenter = index * ITEM_HEIGHT;
      const viewCenter = scrollY.value;
      const distance = Math.abs(viewCenter - itemCenter);

      const scale = interpolate(distance, [0, ITEM_HEIGHT, ITEM_HEIGHT * 2], [1.2, 0.9, 0.76], Extrapolation.CLAMP);
      const opacity = interpolate(distance, [0, ITEM_HEIGHT, ITEM_HEIGHT * 2], [1, 0.5, 0.25], Extrapolation.CLAMP);
      const color = interpolateColor(distance, [0, ITEM_HEIGHT], [activeColor, inactiveColor]);

      return { transform: [{ scale }], opacity, color };
    });

    return (
      <TouchableOpacity activeOpacity={1} onPress={() => onPress(index)} style={styles.wheelItem}>
        <Animated.Text style={[styles.wheelText, animatedStyle]}>{formatLabel(item)}</Animated.Text>
      </TouchableOpacity>
    );
  },
  (prev, next) => prev.item === next.item && prev.index === next.index
);

interface WheelPickerProps {
  data: (string | number)[];
  initialValue: string | number;
  onChange: (value: string | number) => void;
  formatLabel: (item: string | number) => string;
  activeColor: string;
  inactiveColor: string;
  isInfinite?: boolean;
}

const WheelPicker = React.memo(function WheelPicker({
  data,
  initialValue,
  onChange,
  formatLabel,
  activeColor,
  inactiveColor,
  isInfinite = false,
}: WheelPickerProps) {
  const multiplier = isInfinite ? 60 : 1;
  const baseLength = data.length;

  const extendedData = useMemo(() => {
    if (!isInfinite) return data;
    return Array.from({ length: baseLength * multiplier }, (_, i) => data[i % baseLength]);
  }, [baseLength, data, isInfinite, multiplier]);

  const initialBaseIndex = data.indexOf(initialValue) !== -1 ? data.indexOf(initialValue) : 0;
  const startIndex = isInfinite ? Math.floor(multiplier / 2) * baseLength + initialBaseIndex : initialBaseIndex;

  const scrollY = useSharedValue(startIndex * ITEM_HEIGHT);
  const lastScrollNotifiedIndex = useSharedValue(startIndex);
  const flatListRef = useRef<FlatList<string | number>>(null);
  const lastCommittedIndex = useRef(startIndex);
  const lastHapticMs = useRef(0);

  const fireHaptic = useCallback(() => {
    if (Platform.OS === "web") return;
    const now = Date.now();
    if (now - lastHapticMs.current < 45) return;
    lastHapticMs.current = now;
    Haptics.selectionAsync();
  }, []);

  const normalizeInfiniteIndex = useCallback(
    (index: number) => {
      if (!isInfinite) return index;
      const mod = ((index % baseLength) + baseLength) % baseLength;
      return Math.floor(multiplier / 2) * baseLength + mod;
    },
    [baseLength, isInfinite, multiplier]
  );

  const commitIndex = useCallback(
    (index: number, withHaptic = true) => {
      if (!extendedData.length) return;
      const safeIndex = Math.max(0, Math.min(index, extendedData.length - 1));
      if (safeIndex !== lastCommittedIndex.current) {
        lastCommittedIndex.current = safeIndex;
        onChange(extendedData[safeIndex]);
        if (withHaptic) fireHaptic();
      }
    },
    [extendedData, fireHaptic, onChange]
  );

  const settleAtOffset = useCallback(
    (offsetY: number, withHaptic = true) => {
      const rawIndex = Math.round(offsetY / ITEM_HEIGHT);
      const normalizedIndex = normalizeInfiniteIndex(rawIndex);

      if (isInfinite && normalizedIndex !== rawIndex) {
        flatListRef.current?.scrollToOffset({ offset: normalizedIndex * ITEM_HEIGHT, animated: false });
      }

      commitIndex(normalizedIndex, withHaptic);
    },
    [commitIndex, isInfinite, normalizeInfiniteIndex]
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;

    const rawIndex = Math.round(event.contentOffset.y / ITEM_HEIGHT);
    const normalizedIndex = isInfinite
      ? Math.floor(multiplier / 2) * baseLength + (((rawIndex % baseLength) + baseLength) % baseLength)
      : rawIndex;

    if (normalizedIndex !== lastScrollNotifiedIndex.value) {
      lastScrollNotifiedIndex.value = normalizedIndex;
      runOnJS(commitIndex)(normalizedIndex);
    }
  });

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      settleAtOffset(event.nativeEvent.contentOffset.y);
    },
    [settleAtOffset]
  );

  const handleEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = Math.abs(event.nativeEvent.velocity?.y || 0);
      if (velocityY < 0.05) {
        settleAtOffset(event.nativeEvent.contentOffset.y);
      }
    },
    [settleAtOffset]
  );

  const handlePress = useCallback(
    (index: number) => {
      flatListRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: true });
      commitIndex(index);
    },
    [commitIndex]
  );

  return (
    <View style={styles.wheelContainer}>
      <Animated.FlatList
        ref={flatListRef}
        data={extendedData}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => (
          <WheelItem
            item={item}
            index={index}
            scrollY={scrollY}
            onPress={handlePress}
            formatLabel={formatLabel}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
          />
        )}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialScrollIndex={startIndex}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleEndDrag}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={15}
        maxToRenderPerBatch={12}
        windowSize={5}
      />
    </View>
  );
});

interface TimePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number, minutes: number, period?: "AM" | "PM") => void;
  title?: string;
  initialHours?: number;
  initialMinutes?: number;
  initialPeriod?: "AM" | "PM";
}

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
  const [showModal, setShowModal] = useState(visible);

  const hoursRef = useRef(initialHours);
  const minutesRef = useRef(initialMinutes);
  const periodRef = useRef<"AM" | "PM">(initialPeriod || "AM");

  const translateY = useSharedValue(CONTENT_HEIGHT + 350);
  const backdropOpacity = useSharedValue(0);

  const hoursData = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutesData = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const periodData: ("AM" | "PM")[] = useMemo(() => ["AM", "PM"], []);

  const formatHours = useCallback((h: string | number) => h.toString(), []);
  const formatMinutes = useCallback((m: string | number) => Number(m).toString().padStart(2, "0"), []);
  const formatPeriod = useCallback((p: string | number) => String(p), []);

  const handleHoursChange = useCallback((v: string | number) => {
    hoursRef.current = Number(v);
  }, []);

  const handleMinutesChange = useCallback((v: string | number) => {
    minutesRef.current = Number(v);
  }, []);

  const handlePeriodChange = useCallback((v: string | number) => {
    periodRef.current = String(v) as "AM" | "PM";
  }, []);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      let h = initialHours;
      if (h === 0) h = 12;
      if (h > 12) h -= 12;
      hoursRef.current = h;
      minutesRef.current = initialMinutes || 0;
      periodRef.current = initialPeriod || "AM";

      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else if (showModal) {
      translateY.value = withTiming(CONTENT_HEIGHT + 350, { duration: 240, easing: Easing.in(Easing.cubic) });
      backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setShowModal)(false);
      });
    }
  }, [visible, initialHours, initialMinutes, initialPeriod, showModal, backdropOpacity, translateY]);

  const closeModal = (callback?: () => void) => {
    translateY.value = withTiming(CONTENT_HEIGHT + 350, { duration: 240, easing: Easing.in(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setShowModal)(false);
        if (callback) runOnJS(callback)();
      }
    });
  };

  const handleClose = () => closeModal(onClose);

  const handleConfirm = () => {
    closeModal(() => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onConfirm(hoursRef.current, minutesRef.current, periodRef.current);
      onClose();
    });
  };

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const selectedPreview = `${hoursRef.current.toString().padStart(2, "0")}:${minutesRef.current
    .toString()
    .padStart(2, "0")} ${periodRef.current}`;

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
        <Pressable onPress={handleClose} style={StyleSheet.absoluteFill} />

        <Animated.View style={[styles.bottomSheet, { backgroundColor: theme.colors.card }, animatedSheetStyle]}>
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>
          <ModalHeader title={title} onClose={handleClose} position="bottom" />

          <View style={styles.headersRow}>
            <Text style={[styles.headerLabel, { color: theme.colors.textSecondary }]}>HOURS</Text>
            <View style={styles.spacer} />
            <Text style={[styles.headerLabel, { color: theme.colors.textSecondary }]}>MINUTES</Text>
            <View style={styles.spacer} />
            <Text style={[styles.headerLabel, { color: theme.colors.textSecondary }]}>AM/PM</Text>
          </View>

          <View style={styles.previewRow}>
            <Text style={[styles.previewText, { color: theme.colors.textSecondary }]}>Selected: {selectedPreview}</Text>
          </View>

          <View style={styles.pickersContainer}>
            <View style={[styles.selectionBand, { backgroundColor: theme.colors.primary + "15" }]} pointerEvents="none" />

            <View style={styles.column}>
              <WheelPicker
                data={hoursData}
                initialValue={hoursRef.current}
                onChange={handleHoursChange}
                formatLabel={formatHours}
                activeColor={theme.colors.text}
                inactiveColor={theme.colors.textSecondary}
                isInfinite
              />
            </View>
            <View style={styles.spacerCenter}>
              <Text style={[styles.colon, { color: theme.colors.text }]}>:</Text>
            </View>

            <View style={styles.column}>
              <WheelPicker
                data={minutesData}
                initialValue={minutesRef.current}
                onChange={handleMinutesChange}
                formatLabel={formatMinutes}
                activeColor={theme.colors.text}
                inactiveColor={theme.colors.textSecondary}
                isInfinite
              />
            </View>
            <View style={styles.spacer} />

            <View style={styles.column}>
              <WheelPicker
                data={periodData}
                initialValue={periodRef.current}
                onChange={handlePeriodChange}
                formatLabel={formatPeriod}
                activeColor={theme.colors.text}
                inactiveColor={theme.colors.textSecondary}
              />
            </View>
          </View>

          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Button title="Cancel" variant="neutral" onPress={handleClose} style={{ flex: 1 }} />
            <View style={{ width: 12 }} />
            <Button title="Confirm" variant="primary" onPress={handleConfirm} style={{ flex: 1 }} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  bottomSheet: {
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  handleContainer: { width: "100%", alignItems: "center", paddingTop: 14, paddingBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.3 },
  headersRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingTop: 12, paddingBottom: 6 },
  headerLabel: { width: COLUMN_WIDTH, textAlign: "center", fontSize: 10, fontFamily: "Nunito_700Bold", letterSpacing: 1.5, opacity: 0.5 },
  previewRow: { alignItems: "center", marginBottom: 4 },
  previewText: { fontSize: 12, fontFamily: "Nunito_600SemiBold" },
  spacer: { width: 16 },
  pickersContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: CONTENT_HEIGHT, position: "relative" },
  column: { width: COLUMN_WIDTH, alignItems: "center" },
  spacerCenter: { width: 16, alignItems: "center", justifyContent: "center" },
  selectionBand: { position: "absolute", top: (CONTENT_HEIGHT - ITEM_HEIGHT) / 2, left: 24, right: 24, height: ITEM_HEIGHT, borderRadius: 18 },
  colon: { fontSize: 24, fontFamily: "Nunito_700Bold", opacity: 0.4 },
  footer: { flexDirection: "row", padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24, borderTopWidth: 1 },
  wheelContainer: { flex: 1, height: CONTENT_HEIGHT, overflow: "hidden", width: "100%" },
  wheelItem: { height: ITEM_HEIGHT, width: "100%", justifyContent: "center", alignItems: "center" },
  wheelText: { fontSize: 22, fontFamily: "Nunito_700Bold", textAlign: "center" },
});

