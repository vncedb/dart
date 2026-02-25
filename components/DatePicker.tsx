import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  FadeIn,
  FadeOut,
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
const CONTENT_HEIGHT = 340;
const PADDING_VERTICAL = (CONTENT_HEIGHT - ITEM_HEIGHT) / 2;

const MONTHS_DATA = Array.from({ length: 12 }, (_, i) => new Date(0, i));
const START_YEAR = 1900;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS_DATA = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 1 },
  (_, i) => START_YEAR + i
);
const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface DatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  selectedDate?: Date;
  title?: string;
  markedDates?: string[];
}

type ViewMode = "calendar" | "month" | "year";

const DayCell = React.memo(
  ({
    day,
    isSelected,
    isCurrentMonth,
    isToday,
    hasIndicator,
    onSelect,
    primaryColor,
    textColor,
    textSecondaryColor,
  }: {
    day: Date;
    isSelected: boolean;
    isCurrentMonth: boolean;
    isToday: boolean;
    hasIndicator: boolean;
    onSelect: (date: Date) => void;
    primaryColor: string;
    textColor: string;
    textSecondaryColor: string;
  }) => {
    
    let cellTextColor = textColor;
    if (isToday && !isSelected) cellTextColor = primaryColor;
    if (isSelected) cellTextColor = "#FFFFFF";

    let cellOpacity = (isCurrentMonth || isSelected) ? 1 : 0.4; 

    // Using exact font families instead of font weights
    let cellFontFamily = isSelected ? "Nunito_700Bold" : (isToday ? "Nunito_700Bold" : "Nunito_600SemiBold");

    return (
      <View style={styles.dayCellWrapper}>
        <TouchableOpacity
          onPress={() => onSelect(day)}
          style={[
            styles.dayCell,
            { backgroundColor: isSelected ? primaryColor : "transparent" },
            !isSelected && isToday && { borderWidth: 1.5, borderColor: primaryColor },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                color: cellTextColor,
                fontFamily: cellFontFamily,
                opacity: cellOpacity,
              },
            ]}
          >
            {format(day, "d")}
          </Text>

          {hasIndicator && (
            <View
              style={{
                position: "absolute",
                bottom: 6,
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: isSelected ? "#fff" : primaryColor,
              }}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.isCurrentMonth === next.isCurrentMonth &&
    prev.isToday === next.isToday &&
    prev.hasIndicator === next.hasIndicator &&
    prev.day.getTime() === next.day.getTime() &&
    prev.primaryColor === next.primaryColor
);
DayCell.displayName = "DayCell";

const WheelItem = React.memo(
  ({ item, index, scrollY, onPress, formatLabel, primaryColor, textSecondaryColor }: any) => {
    const animatedStyle = useAnimatedStyle(() => {
      const itemCenter = index * ITEM_HEIGHT;
      const viewCenter = scrollY.value;
      const distance = Math.abs(viewCenter - itemCenter);

      const scale = interpolate(
        distance,
        [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
        [1.2, 0.85, 0.7],
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
        style={{
          height: ITEM_HEIGHT,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Animated.Text style={[{ fontSize: 18, fontFamily: "Nunito_700Bold" }, animatedStyle]}>
          {formatLabel(item)}
        </Animated.Text>
      </TouchableOpacity>
    );
  },
  (prev, next) => prev.item === next.item && prev.index === next.index
);
WheelItem.displayName = "WheelItem";

const WheelPicker = React.memo(
  ({ data, initialIndex, onChange, formatLabel, primaryColor, textSecondaryColor }: any) => {
    const scrollY = useSharedValue(initialIndex * ITEM_HEIGHT);
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const flatListRef = React.useRef<FlatList>(null);

    const onScroll = useAnimatedScrollHandler((event) => {
      scrollY.value = event.contentOffset.y;
    });

    const handleMomentumEnd = useCallback(
      (e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
        const safeIndex = Math.max(0, Math.min(index, data.length - 1));
        if (safeIndex !== activeIndex) {
          setActiveIndex(safeIndex);
          onChange(safeIndex);
          if (Platform.OS !== "web") Haptics.selectionAsync();
        }
      },
      [data.length, activeIndex, onChange]
    );

    const handlePress = useCallback(
      (index: number) => {
        flatListRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: true });
        setActiveIndex(index);
        onChange(index);
        if (Platform.OS !== "web") Haptics.selectionAsync();
      },
      [onChange]
    );

    return (
      <View style={{ height: CONTENT_HEIGHT, width: "100%", overflow: "hidden" }}>
        <Animated.FlatList
          ref={flatListRef}
          data={data}
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
          initialScrollIndex={initialIndex}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumEnd}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>
    );
  }
);
WheelPicker.displayName = "WheelPicker";

export default function DatePicker({
  visible,
  onClose,
  onSelect,
  selectedDate = new Date(),
  title = "Select Date",
  markedDates = [],
}: DatePickerProps) {
  const theme = useAppTheme();
  const [tempDate, setTempDate] = useState(new Date(selectedDate));
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const [showModal, setShowModal] = useState(visible);
  
  const translateY = useSharedValue(CONTENT_HEIGHT + 350);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      setTempDate(new Date(selectedDate));
      setCurrentMonth(new Date(selectedDate));
      setViewMode("calendar");

      backdropOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 150, mass: 0.8 });
    } else {
      if (showModal) closeModal();
    }
  }, [visible, selectedDate]);

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
      onSelect(tempDate);
      onClose();
    });
  };

  const handleDaySelect = useCallback((day: Date) => {
    setTempDate(day);
    setCurrentMonth(day);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }, []);

  const animatedBackdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const animatedSheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const formatMonth = useCallback((item: Date) => format(item, "MMMM"), []);
  const formatYear = useCallback((item: number) => item.toString(), []);

  const handleMonthChange = useCallback((index: number) => {
    setCurrentMonth((prev) => setMonth(prev, index));
    setTempDate((prev) => setMonth(prev, index));
  }, []);

  const handleYearChange = useCallback((index: number) => {
    const year = YEARS_DATA[index];
    if (year) {
      setCurrentMonth((prev) => setYear(prev, year));
      setTempDate((prev) => setYear(prev, year));
    }
  }, []);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = addDays(startDate, 41);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const renderCalendar = () => (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.calendarContainer}
    >
      <View style={styles.weekHeader}>
        {WEEK_DAYS.map((day) => (
          <Text key={day} style={[styles.weekText, { color: theme.colors.textSecondary }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.daysGrid}>
        {calendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isSelected = isSameDay(day, tempDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const hasIndicator = markedDates.includes(dateStr);

          return (
            <DayCell
              key={day.toISOString()}
              day={day}
              isSelected={isSelected}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              hasIndicator={hasIndicator}
              onSelect={handleDaySelect}
              primaryColor={theme.colors.primary}
              textColor={theme.colors.text}
              textSecondaryColor={theme.colors.textSecondary}
            />
          );
        })}
      </View>
    </Animated.View>
  );

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

          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => {
                if (viewMode === "calendar") {
                  setCurrentMonth((prev) => subMonths(prev, 1));
                  setTempDate((prev) => subMonths(prev, 1)); 
                } else setViewMode("calendar");
              }}
              style={styles.navBtn}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.viewToggleContainer}>
              <TouchableOpacity
                onPress={() => setViewMode("calendar")}
                style={[
                  styles.dropdownBtn, { width: 50 },
                  viewMode === "calendar" && { backgroundColor: theme.colors.primary + "15" }
                ]}
              >
                <Text numberOfLines={1} style={[styles.dropdownText, { color: viewMode === "calendar" ? theme.colors.primary : theme.colors.text }]}>
                  {format(tempDate, "dd")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setViewMode(viewMode === "month" ? "calendar" : "month")}
                style={[
                  styles.dropdownBtn, { width: 110 },
                  viewMode === "month" && { backgroundColor: theme.colors.primary + "15" }
                ]}
              >
                <Text numberOfLines={1} style={[styles.dropdownText, { color: viewMode === "month" ? theme.colors.primary : theme.colors.text }]}>
                  {format(currentMonth, "MMMM")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setViewMode(viewMode === "year" ? "calendar" : "year")}
                style={[
                  styles.dropdownBtn, { width: 75 },
                  viewMode === "year" && { backgroundColor: theme.colors.primary + "15" }
                ]}
              >
                <Text numberOfLines={1} style={[styles.dropdownText, { color: viewMode === "year" ? theme.colors.primary : theme.colors.text }]}>
                  {format(currentMonth, "yyyy")}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (viewMode === "calendar") {
                  setCurrentMonth((prev) => addMonths(prev, 1));
                  setTempDate((prev) => addMonths(prev, 1)); 
                } else setViewMode("calendar");
              }}
              style={styles.navBtn}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentFrame}>
            {viewMode === "calendar" && renderCalendar()}
            {viewMode === "month" && (
              <WheelPicker
                data={MONTHS_DATA}
                initialIndex={MONTHS_DATA.findIndex((m) => m.getMonth() === currentMonth.getMonth())}
                onChange={handleMonthChange}
                formatLabel={formatMonth}
                primaryColor={theme.colors.primary}
                textSecondaryColor={theme.colors.textSecondary}
              />
            )}
            {viewMode === "year" && (
              <WheelPicker
                data={YEARS_DATA}
                initialIndex={Math.max(0, YEARS_DATA.indexOf(currentMonth.getFullYear()))}
                onChange={handleYearChange}
                formatLabel={formatYear}
                primaryColor={theme.colors.primary}
                textSecondaryColor={theme.colors.textSecondary}
              />
            )}
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
    borderTopLeftRadius: 32, // Increased for a smoother curve
    borderTopRightRadius: 32,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  handleContainer: { width: '100%', alignItems: 'center', paddingTop: 14, paddingBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3, opacity: 0.3 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  viewToggleContainer: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 4,
  },
  dropdownBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownText: { fontSize: 15, fontFamily: "Nunito_700Bold", letterSpacing: 0.3 },
  contentFrame: { height: CONTENT_HEIGHT, overflow: "hidden", marginVertical: 8 },
  calendarContainer: { flex: 1, paddingHorizontal: 20 },
  weekHeader: {
    flexDirection: "row",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    paddingBottom: 8,
  },
  weekText: { width: "14.28%", textAlign: "center", fontSize: 11, fontFamily: "Nunito_700Bold", textTransform: "uppercase", opacity: 0.5, letterSpacing: 1 },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  dayCellWrapper: { width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCell: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dayText: { fontSize: 16 },
  footer: { flexDirection: "row", padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1 },
});