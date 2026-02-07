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
  View
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

interface DatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  selectedDate?: Date;
  title?: string;
  markedDates?: string[];
}

type ViewMode = "calendar" | "month" | "year";

// --- MEMOIZED DAY CELL ---
// Extracting this prevents the entire grid from re-rendering on selection
const DayCell = React.memo(
  ({
    day,
    isSelected,
    isCurrentMonth,
    isToday,
    hasIndicator,
    onSelect,
    theme,
  }: {
    day: Date;
    isSelected: boolean;
    isCurrentMonth: boolean;
    isToday: boolean;
    hasIndicator: boolean;
    onSelect: (date: Date) => void;
    theme: any;
  }) => {
    return (
      <View style={styles.dayCellWrapper}>
        <TouchableOpacity
          onPress={() => onSelect(day)}
          style={[
            styles.dayCell,
            {
              backgroundColor: isSelected ? theme.colors.primary : "transparent",
            },
            !isSelected &&
              isToday && {
                borderWidth: 1.5,
                borderColor: theme.colors.primary,
              },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                color: isCurrentMonth
                  ? theme.colors.text
                  : theme.colors.textSecondary,
              },
              !isSelected &&
                isToday && {
                  color: theme.colors.primary,
                  fontWeight: "700",
                },
              isSelected && { color: "#fff", fontWeight: "800" },
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
                backgroundColor: isSelected ? "#fff" : theme.colors.primary,
              }}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  },
  (prev, next) => {
    return (
      prev.isSelected === next.isSelected &&
      prev.isCurrentMonth === next.isCurrentMonth &&
      prev.hasIndicator === next.hasIndicator &&
      prev.theme === next.theme &&
      prev.day.getTime() === next.day.getTime()
    );
  }
);
DayCell.displayName = "DayCell";

// --- WHEEL ITEM ---
const WheelItem = React.memo(
  ({ item, index, scrollY, onPress, formatLabel, theme }: any) => {
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
        [theme.colors.primary, theme.colors.textSecondary]
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
        <Animated.Text
          style={[{ fontSize: 18, fontWeight: "600" }, animatedStyle]}
        >
          {formatLabel(item)}
        </Animated.Text>
      </TouchableOpacity>
    );
  }
);
WheelItem.displayName = "WheelItem";

// --- WHEEL PICKER ---
const WheelPicker = React.memo(
  ({ data, initialIndex, onChange, formatLabel }: any) => {
    const theme = useAppTheme();
    const scrollY = useSharedValue(initialIndex * ITEM_HEIGHT); // Initialize directly
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const flatListRef = React.useRef<FlatList>(null);

    // Removed setTimeout/isReady state. getItemLayout handles the positioning efficiently.

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
        flatListRef.current?.scrollToOffset({
          offset: index * ITEM_HEIGHT,
          animated: true,
        });
        setActiveIndex(index);
        onChange(index);
        if (Platform.OS !== "web") Haptics.selectionAsync();
      },
      [onChange]
    );

    return (
      <View
        style={{
          height: CONTENT_HEIGHT,
          width: "100%",
          overflow: "hidden",
        }}
      >
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
              theme={theme}
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
          removeClippedSubviews={true}
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
  const animation = useSharedValue(0);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(0, i)),
    []
  );

  const years = useMemo(() => {
    const startYear = 1900;
    const currentYear = new Date().getFullYear();
    // Pre-calculate to avoid loop on every render if not needed, 
    // though useMemo handles it well.
    return Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => startYear + i
    );
  }, []);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      setTempDate(new Date(selectedDate));
      setCurrentMonth(new Date(selectedDate));
      setViewMode("calendar");

      animation.value = withSpring(1, {
        damping: 18,
        stiffness: 120,
        mass: 1,
      });
    } else {
      if (showModal) {
        closeModal();
      }
    }
  }, [visible, selectedDate]);

  const closeModal = (callback?: () => void) => {
    animation.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setShowModal)(false);
        if (callback) runOnJS(callback)();
      }
    });
  };

  const handleClose = () => {
    closeModal(onClose);
  };

  const handleConfirm = () => {
    closeModal(() => {
      onClose();
      onSelect(tempDate);
    });
  };

  const handleDaySelect = useCallback((day: Date) => {
    setTempDate(day);
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }, []);

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: animation.value,
  }));

  const animatedContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(animation.value, [0, 1], [0.92, 1]);
    return {
      opacity: animation.value,
      transform: [{ scale }],
    };
  });

  const formatMonth = useCallback((item: Date) => format(item, "MMMM"), []);
  const formatYear = useCallback((item: number) => item.toString(), []);

  const handleMonthChange = useCallback((index: number) => {
    setCurrentMonth((prev) => {
      const newDate = setMonth(prev, index);
      // Optional: keep selection in sync with month scroll
      // setTempDate((d) => setMonth(d, index)); 
      return newDate;
    });
  }, []);

  const handleYearChange = useCallback(
    (index: number) => {
      const year = years[index];
      if (year) {
        setCurrentMonth((prev) => {
          const newDate = setYear(prev, year);
          // Optional: keep selection in sync with year scroll
          // setTempDate((d) => setYear(d, year)); 
          return newDate;
        });
      }
    },
    [years]
  );

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
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <Text
            key={day}
            style={[styles.weekText, { color: theme.colors.textSecondary }]}
          >
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
              theme={theme}
            />
          );
        })}
      </View>
    </Animated.View>
  );

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />

      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.container,
              { backgroundColor: theme.colors.card },
              animatedContainerStyle,
            ]}
          >
            <ModalHeader title={title} position="center" />

            <View style={styles.navBar}>
              <TouchableOpacity
                onPress={() =>
                  viewMode === "calendar"
                    ? setCurrentMonth(subMonths(currentMonth, 1))
                    : setViewMode("calendar")
                }
                style={styles.navBtn}
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
              <View style={styles.viewToggleContainer}>
                <TouchableOpacity
                  onPress={() =>
                    setViewMode(viewMode === "month" ? "calendar" : "month")
                  }
                  style={[
                    styles.dropdownBtn,
                    { width: 110 },
                    viewMode === "month" && {
                      backgroundColor: theme.colors.primary + "15",
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.dropdownText,
                      {
                        color:
                          viewMode === "month"
                            ? theme.colors.primary
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {format(currentMonth, "MMMM")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setViewMode(viewMode === "year" ? "calendar" : "year")
                  }
                  style={[
                    styles.dropdownBtn,
                    { width: 75 },
                    viewMode === "year" && {
                      backgroundColor: theme.colors.primary + "15",
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.dropdownText,
                      {
                        color:
                          viewMode === "year"
                            ? theme.colors.primary
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {format(currentMonth, "yyyy")}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() =>
                  viewMode === "calendar"
                    ? setCurrentMonth(addMonths(currentMonth, 1))
                    : setViewMode("calendar")
                }
                style={styles.navBtn}
              >
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.contentFrame}>
              {viewMode === "calendar" && renderCalendar()}
              {viewMode === "month" && (
                <WheelPicker
                  data={months}
                  initialIndex={months.findIndex(
                    (m) => m.getMonth() === currentMonth.getMonth()
                  )}
                  onChange={handleMonthChange}
                  formatLabel={formatMonth}
                />
              )}
              {viewMode === "year" && (
                <WheelPicker
                  data={years}
                  initialIndex={Math.max(
                    0,
                    years.indexOf(currentMonth.getFullYear())
                  )}
                  onChange={handleYearChange}
                  formatLabel={formatYear}
                />
              )}
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
              <View style={{ width: 12 }} />
              <Button
                title="Select"
                variant="primary"
                onPress={handleConfirm}
                style={{ flex: 1 }}
              />
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
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
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
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
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownText: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  contentFrame: { height: CONTENT_HEIGHT, overflow: "hidden" },
  calendarContainer: { flex: 1, paddingHorizontal: 16 },
  weekHeader: {
    flexDirection: "row",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    paddingBottom: 8,
  },
  weekText: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.6,
  },
  daysGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 4 },
  dayCellWrapper: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  dayText: { fontSize: 15, fontWeight: "500" },
  footer: { flexDirection: "row", padding: 20, borderTopWidth: 1 },
});