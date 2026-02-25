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
  Easing,
  Extrapolation,
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
const COLUMN_WIDTH = 110; 

const WheelItem = React.memo(
  ({ item, index, scrollY, onPress, formatLabel, activeColor, inactiveColor }: any) => {
    const animatedStyle = useAnimatedStyle(() => {
      const itemCenter = index * ITEM_HEIGHT;
      const viewCenter = scrollY.value;
      const distance = Math.abs(viewCenter - itemCenter);

      const scale = interpolate(distance, [0, ITEM_HEIGHT, ITEM_HEIGHT * 2], [1.25, 0.85, 0.7], Extrapolation.CLAMP);
      const opacity = interpolate(distance, [0, ITEM_HEIGHT, ITEM_HEIGHT * 2], [1, 0.35, 0.15], Extrapolation.CLAMP);
      const color = interpolateColor(distance, [0, ITEM_HEIGHT], [activeColor, inactiveColor]);

      return { transform: [{ scale }], opacity, color };
    });

    return (
      <TouchableOpacity activeOpacity={1} onPress={() => onPress(index)} style={styles.wheelItem}>
        <Animated.Text style={[styles.wheelText, animatedStyle]}>
          {formatLabel(item)}
        </Animated.Text>
      </TouchableOpacity>
    );
  },
  (prev, next) => prev.item === next.item && prev.index === next.index
);
WheelItem.displayName = "WheelItem";

const WheelPicker = React.memo(
  ({ data, initialValue, onChange, formatLabel, activeColor, inactiveColor, isInfinite = false }: any) => {
    const MULTIPLIER = 50; 
    const baseLength = data.length;
    
    const extendedData = useMemo(() => {
      if (!isInfinite) return data;
      return Array.from({ length: baseLength * MULTIPLIER }, (_, i) => data[i % baseLength]);
    }, [data, isInfinite, baseLength]);

    const initialBaseIndex = data.indexOf(initialValue) !== -1 ? data.indexOf(initialValue) : 0;
    const startIndex = isInfinite ? Math.floor(MULTIPLIER / 2) * baseLength + initialBaseIndex : initialBaseIndex;

    const scrollY = useSharedValue(startIndex * ITEM_HEIGHT);
    const currentIndex = useSharedValue(startIndex);
    const flatListRef = useRef<FlatList>(null);

    const onScroll = useAnimatedScrollHandler({
      onScroll: (event) => {
        scrollY.value = event.contentOffset.y;
        const index = Math.round(event.contentOffset.y / ITEM_HEIGHT);
        
        if (index !== currentIndex.value) {
          currentIndex.value = index;
          if (Platform.OS !== "web") runOnJS(Haptics.selectionAsync)();
          
          const safeIndex = Math.max(0, Math.min(index, extendedData.length - 1));
          runOnJS(onChange)(extendedData[safeIndex]);
        }
      },
      onMomentumEnd: (event) => {
        const index = Math.round(event.contentOffset.y / ITEM_HEIGHT);
        const safeIndex = Math.max(0, Math.min(index, extendedData.length - 1));
        runOnJS(onChange)(extendedData[safeIndex]);
      },
      onEndDrag: (event) => {
        const index = Math.round(event.contentOffset.y / ITEM_HEIGHT);
        const safeIndex = Math.max(0, Math.min(index, extendedData.length - 1));
        runOnJS(onChange)(extendedData[safeIndex]);
      }
    });

    const handlePress = useCallback((index: number) => {
        flatListRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: true });
        onChange(extendedData[index]);
        if (Platform.OS !== "web") Haptics.selectionAsync();
    }, [extendedData, onChange]);

    return (
      <View style={styles.wheelContainer}>
        <Animated.FlatList
          ref={flatListRef}
          data={extendedData}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => (
            <WheelItem item={item} index={index} scrollY={scrollY} onPress={handlePress} formatLabel={formatLabel} activeColor={activeColor} inactiveColor={inactiveColor} />
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
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>
    );
  }
);
WheelPicker.displayName = "WheelPicker";

interface DurationPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hours: number, minutes: number) => void;
  title?: string;
  initialHours?: number;
  initialMinutes?: number;
  maxHours?: number; 
}

export default function DurationPicker({
  visible,
  onClose,
  onConfirm,
  title = "Set Duration",
  initialHours = 0,
  initialMinutes = 0,
  maxHours = 24, 
}: DurationPickerProps) {
  const theme = useAppTheme();
  const [showModal, setShowModal] = useState(visible);

  const hoursRef = useRef(initialHours);
  const minutesRef = useRef(initialMinutes);

  const translateY = useSharedValue(CONTENT_HEIGHT + 350);
  const backdropOpacity = useSharedValue(0);

  const hoursData = useMemo(() => Array.from({ length: maxHours }, (_, i) => i), [maxHours]);
  const minutesData = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const formatHours = useCallback((h: number) => h.toString(), []);
  const formatMinutes = useCallback((m: number) => m.toString().padStart(2, "0"), []);

  const handleHoursChange = useCallback((v: number) => { hoursRef.current = v; }, []);
  const handleMinutesChange = useCallback((v: number) => { minutesRef.current = v; }, []);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      hoursRef.current = Math.min(initialHours, maxHours - 1);
      minutesRef.current = initialMinutes;

      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    } else {
      if (showModal) closeModal();
    }
  }, [visible, initialHours, initialMinutes, maxHours]);

  const closeModal = (callback?: () => void) => {
    translateY.value = withTiming(CONTENT_HEIGHT + 350, { duration: 300, easing: Easing.in(Easing.cubic) });
    backdropOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
      if (finished) { runOnJS(setShowModal)(false); if (callback) runOnJS(callback)(); }
    });
  };

  const handleClose = () => closeModal(onClose);

  const handleConfirm = () => {
    closeModal(() => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onConfirm(hoursRef.current, minutesRef.current);
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
          <View style={styles.handleContainer}><View style={[styles.handle, { backgroundColor: theme.colors.border }]} /></View>
          <ModalHeader title={title} onClose={handleClose} position="bottom" />

          <View style={styles.headersRow}>
            <Text style={[styles.headerLabel, { color: theme.colors.textSecondary }]}>HOURS</Text>
            <View style={styles.spacer} />
            <Text style={[styles.headerLabel, { color: theme.colors.textSecondary }]}>MINUTES</Text>
          </View>

          <View style={styles.pickersContainer}>
            <View style={[styles.selectionBand, { backgroundColor: theme.colors.primary + '15' }]} pointerEvents="none" />

            <View style={styles.column}>
              <WheelPicker data={hoursData} initialValue={hoursRef.current} onChange={handleHoursChange} formatLabel={formatHours} activeColor={theme.colors.text} inactiveColor={theme.colors.textSecondary} isInfinite={maxHours <= 100} />
            </View>
            
            <View style={styles.spacerCenter}><Text style={[styles.colon, { color: theme.colors.text }]}>:</Text></View>

            <View style={styles.column}>
              <WheelPicker data={minutesData} initialValue={minutesRef.current} onChange={handleMinutesChange} formatLabel={formatMinutes} activeColor={theme.colors.text} inactiveColor={theme.colors.textSecondary} isInfinite={true} />
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
  bottomSheet: { width: "100%", borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  handleContainer: { width: '100%', alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.3 },
  headersRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 16, paddingBottom: 10 },
  headerLabel: { width: COLUMN_WIDTH, textAlign: 'center', fontSize: 10, fontFamily: 'Nunito_700Bold', letterSpacing: 1.5, opacity: 0.5 },
  spacer: { width: 24 }, 
  pickersContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: CONTENT_HEIGHT, position: 'relative' },
  column: { width: COLUMN_WIDTH, alignItems: 'center' },
  spacerCenter: { width: 24, alignItems: 'center', justifyContent: 'center' },
  selectionBand: { position: 'absolute', top: (CONTENT_HEIGHT - ITEM_HEIGHT) / 2, left: 32, right: 32, height: ITEM_HEIGHT, borderRadius: 18 },
  colon: { fontSize: 24, fontFamily: "Nunito_700Bold", opacity: 0.4 },
  footer: { flexDirection: "row", padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1 },
  wheelContainer: { flex: 1, height: CONTENT_HEIGHT, overflow: "hidden", width: '100%' },
  wheelItem: { height: ITEM_HEIGHT, width: '100%', justifyContent: "center", alignItems: "center" },
  wheelText: { fontSize: 22, fontFamily: "Nunito_700Bold", textAlign: "center" }
});