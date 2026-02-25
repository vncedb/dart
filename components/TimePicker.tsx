import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "../constants/theme";
import Button from "./Button";
import ModalHeader from "./ModalHeader";

const ITEM_HEIGHT = 60; 
const CONTENT_HEIGHT = 300; 
const PADDING_VERTICAL = (CONTENT_HEIGHT - ITEM_HEIGHT) / 2;
const COLUMN_WIDTH = 90;

// --- WHEEL ITEM ---
const WheelItem = React.memo(
  ({ item, index, scrollY, onPress, formatLabel, primaryColor, textSecondaryColor }: any) => {
    const animatedStyle = useAnimatedStyle(() => {
      const itemCenter = index * ITEM_HEIGHT;
      const viewCenter = scrollY.value;
      const distance = Math.abs(viewCenter - itemCenter);

      const scale = interpolate(
        distance,
        [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
        [1.15, 0.9, 0.8],
        Extrapolation.CLAMP
      );
      const opacity = interpolate(
        distance,
        [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
        [1, 0.4, 0.2],
        Extrapolation.CLAMP
      );
      const color = interpolateColor(
        distance,
        [0, ITEM_HEIGHT],
        [primaryColor, textSecondaryColor]
      );

      return { transform: [{ scale }], opacity, color };
    });

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onPress(index)}
        style={{ height: ITEM_HEIGHT, width: '100%', justifyContent: "center", alignItems: "center" }}
      >
        <Animated.Text style={[{ fontSize: 18, fontWeight: "600", textAlign: "center" }, animatedStyle]}>
          {formatLabel(item)}
        </Animated.Text>
      </TouchableOpacity>
    );
  },
  (prev, next) => prev.item === next.item && prev.index === next.index
);
WheelItem.displayName = "WheelItem";

// --- WHEEL PICKER ---
const WheelPicker = React.memo(
  ({ data, initialValue, onChange, formatLabel, primaryColor, textSecondaryColor, isInfinite = false }: any) => {
    
    const MULTIPLIER = 100;
    const baseLength = data.length;
    
    const extendedData = useMemo(() => {
      if (!isInfinite) return data;
      return Array.from({ length: baseLength * MULTIPLIER }, (_, i) => data[i % baseLength]);
    }, [data, isInfinite, baseLength]);

    const initialBaseIndex = data.indexOf(initialValue) !== -1 ? data.indexOf(initialValue) : 0;
    const startIndex = isInfinite
      ? Math.floor(MULTIPLIER / 2) * baseLength + initialBaseIndex
      : initialBaseIndex;

    const scrollY = useSharedValue(startIndex * ITEM_HEIGHT);
    const [activeIndex, setActiveIndex] = useState(startIndex);
    const flatListRef = useRef<FlatList>(null);

    const onScroll = useAnimatedScrollHandler((event) => {
      scrollY.value = event.contentOffset.y;
    });

    const handleMomentumEnd = useCallback(
      (e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
        const safeIndex = Math.max(0, Math.min(index, extendedData.length - 1));
        if (safeIndex !== activeIndex) {
          setActiveIndex(safeIndex);
          onChange(extendedData[safeIndex]);
          if (Platform.OS !== "web") Haptics.selectionAsync();
        }
      },
      [extendedData, activeIndex, onChange]
    );

    const handlePress = useCallback(
      (index: number) => {
        flatListRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: true });
        setActiveIndex(index);
        onChange(extendedData[index]);
        if (Platform.OS !== "web") Haptics.selectionAsync();
      },
      [extendedData, onChange]
    );

    return (
      <View style={{ flex: 1, height: CONTENT_HEIGHT, overflow: "hidden", width: '100%' }}>
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
              primaryColor={primaryColor}
              textSecondaryColor={textSecondaryColor}
            />
          )}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          initialScrollIndex={startIndex}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="normal"
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumEnd}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>
    );
  }
);
WheelPicker.displayName = "WheelPicker";

// --- MAIN COMPONENT ---
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

  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [period, setPeriod] = useState<"AM" | "PM">(initialPeriod || "AM");

  const translateY = useSharedValue(CONTENT_HEIGHT + 350);
  const backdropOpacity = useSharedValue(0);

  const hoursData = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const minutesData = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const periodData = useMemo(() => ["AM", "PM"], []);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      
      let h = initialHours;
      if (h === 0) h = 12;
      if (h > 12) h -= 12;
      setHours(h);
      setMinutes(initialMinutes || 0);
      setPeriod(initialPeriod || "AM");

      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 150, mass: 0.8 });
    } else {
      if (showModal) closeModal();
    }
  }, [visible, initialHours, initialMinutes, initialPeriod]);

  const closeModal = (callback?: () => void) => {
    translateY.value = withTiming(CONTENT_HEIGHT + 350, { duration: 250 });
    backdropOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
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
      onConfirm(hours, minutes, period);
      onClose();
    });
  };

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

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

          <View style={styles.pickersContainer}>
            <View style={[styles.selectionBand, { backgroundColor: theme.colors.primary }]} pointerEvents="none" />

            <View style={styles.column}>
              <WheelPicker
                data={hoursData}
                initialValue={hours}
                onChange={setHours}
                formatLabel={(h: number) => h.toString().padStart(2, "0")}
                primaryColor={theme.colors.primary}
                textSecondaryColor={theme.colors.textSecondary}
                isInfinite={true}
              />
            </View>
            
            <View style={styles.spacerCenter}>
              <Text style={[styles.colon, { color: theme.colors.text }]}>:</Text>
            </View>
            
            <View style={styles.column}>
              <WheelPicker
                data={minutesData}
                initialValue={minutes}
                onChange={setMinutes}
                formatLabel={(m: number) => m.toString().padStart(2, "0")}
                primaryColor={theme.colors.primary}
                textSecondaryColor={theme.colors.textSecondary}
                isInfinite={true}
              />
            </View>
            
            <View style={styles.spacer} />
            <View style={styles.column}>
              <WheelPicker
                data={periodData}
                initialValue={period}
                onChange={(p: "AM" | "PM") => setPeriod(p)}
                formatLabel={(p: string) => p}
                primaryColor={theme.colors.primary}
                textSecondaryColor={theme.colors.textSecondary}
                isInfinite={false} 
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
    width: "100%", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 20,
  },
  handleContainer: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, opacity: 0.4 },
  
  headersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLabel: {
    width: COLUMN_WIDTH,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.6,
  },
  spacer: { width: 16 }, 
  
  pickersContainer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: CONTENT_HEIGHT, position: 'relative',
  },
  column: {
    width: COLUMN_WIDTH,
    alignItems: 'center',
  },
  spacerCenter: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBand: {
    position: 'absolute', top: '50%', left: 24, right: 24, height: ITEM_HEIGHT,
    marginTop: -ITEM_HEIGHT / 2, borderRadius: 12, opacity: 0.1,
  },
  colon: { fontSize: 28, fontWeight: "700", opacity: 0.3 },
  footer: { flexDirection: "row", padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1 },
});