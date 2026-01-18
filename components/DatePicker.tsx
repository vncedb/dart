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
  useRef,
  useState,
} from "react";
import {
  FlatList,
  ListRenderItemInfo,
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
  FadeIn,
  FadeOut,
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

// --- CONSTANTS ---
const ITEM_HEIGHT = 60;
const VISIBLE_ITEMS = 5;
const CONTENT_HEIGHT = 340;
const PADDING_VERTICAL = (CONTENT_HEIGHT - ITEM_HEIGHT) / 2;

interface DatePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  selectedDate?: Date;
  title?: string;
}

type ViewMode = "calendar" | "month" | "year";

// --- WHEEL ITEM COMPONENT ---
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
        Extrapolation.CLAMP,
      );
      const opacity = interpolate(
        distance,
        [0, ITEM_HEIGHT, ITEM_HEIGHT * 2],
        [1, 0.4, 0.2],
        Extrapolation.CLAMP,
      );
      const color = interpolateColor(
        distance,
        [0, ITEM_HEIGHT],
        [theme.colors.primary, theme.colors.textSecondary],
      );

      return {
        transform: [{ scale }],
        opacity,
        color,
      };
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
  },
);
WheelItem.displayName = "WheelItem";

// --- WHEEL PICKER COMPONENT ---
interface WheelPickerProps {
  data: any[];
  initialIndex: number;
  onChange: (index: number) => void;
  formatLabel: (item: any) => string;
  onClose: () => void;
}

const WheelPicker = React.memo(
  ({
    data,
    initialIndex,
    onChange,
    formatLabel,
    onClose,
  }: WheelPickerProps) => {
    const theme = useAppTheme();
    const scrollY = useSharedValue(0);
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const flatListRef = useRef<FlatList>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: initialIndex * ITEM_HEIGHT,
          animated: false,
        });
        scrollY.value = initialIndex * ITEM_HEIGHT;
        setIsReady(true);
      }, 50);
      return () => clearTimeout(timer);
    }, []);

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
      [data.length, activeIndex, onChange],
    );

    const handlePress = useCallback(
      (index: number) => {
        if (index === activeIndex) {
          if (Platform.OS !== "web") Haptics.selectionAsync();
          onClose();
        } else {
          flatListRef.current?.scrollToOffset({
            offset: index * ITEM_HEIGHT,
            animated: true,
          });
          setActiveIndex(index);
          onChange(index);
          if (Platform.OS !== "web") Haptics.selectionAsync();
        }
      },
      [activeIndex, onClose, onChange],
    );

    const getItemLayout = useCallback(
      (_: any, index: number) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      }),
      [],
    );

    const renderItem = useCallback(
      ({ item, index }: ListRenderItemInfo<any>) => {
        return (
          <WheelItem
            item={item}
            index={index}
            scrollY={scrollY}
            onPress={handlePress}
            formatLabel={formatLabel}
            theme={theme}
          />
        );
      },
      [handlePress, formatLabel, theme, scrollY],
    );

    return (
      <View
        style={{
          height: CONTENT_HEIGHT,
          width: "100%",
          overflow: "hidden",
          opacity: isReady ? 1 : 0,
        }}
      >
        <Animated.FlatList
          ref={flatListRef}
          data={data}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialScrollIndex={initialIndex}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="normal"
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: PADDING_VERTICAL }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumEnd}
          removeClippedSubviews={true}
          initialNumToRender={VISIBLE_ITEMS + 4}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      </View>
    );
  },
  (prev, next) => {
    return prev.data === next.data && prev.onChange === next.onChange;
  },
);
WheelPicker.displayName = "WheelPicker";

// --- MAIN DATE PICKER ---
export default function DatePicker({
  visible,
  onClose,
  onSelect,
  selectedDate = new Date(),
  title = "Select Date",
}: DatePickerProps) {
  const theme = useAppTheme();
  const [tempDate, setTempDate] = useState(new Date(selectedDate));
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const openAnim = useSharedValue(0);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(0, i)),
    [],
  );
  const years = useMemo(() => {
    const startYear = 1900;
    const currentYear = new Date().getFullYear();
    return Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => startYear + i,
    );
  }, []);

  useEffect(() => {
    if (visible) {
      setTempDate(new Date(selectedDate));
      setCurrentMonth(new Date(selectedDate));
      setViewMode("calendar");
      openAnim.value = 0;
      openAnim.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [visible, selectedDate, openAnim]);

  const handleClose = useCallback(() => {
    openAnim.value = withTiming(
      0,
      { duration: 250, easing: Easing.out(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  }, [onClose, openAnim]);

  const handleConfirm = () => {
    onSelect(tempDate);
    handleClose();
  };

  // Helper functions
  const formatMonth = useCallback((item: Date) => format(item, "MMMM"), []);
  const formatYear = useCallback((item: number) => item.toString(), []);

  // --- LOGIC FIX: Update Selection when Wheel Changes ---
  const handleMonthChange = useCallback((index: number) => {
    setCurrentMonth((prev) => {
      const newViewDate = setMonth(prev, index);
      // Also update the *selected* date (tempDate) so "Select" works immediately
      setTempDate((prevTemp) => {
        let newTemp = setYear(prevTemp, newViewDate.getFullYear());
        newTemp = setMonth(newTemp, index);
        return newTemp;
      });
      return newViewDate;
    });
  }, []);

  const handleYearChange = useCallback(
    (index: number) => {
      const year = years[index];
      if (year) {
        setCurrentMonth((prev) => {
          const newViewDate = setYear(prev, year);
          setTempDate((prevTemp) => setYear(prevTemp, year));
          return newViewDate;
        });
      }
    },
    [years],
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
          const isSelected = isSameDay(day, tempDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <View key={day.toISOString()} style={styles.dayCellWrapper}>
              <TouchableOpacity
                onPress={() => {
                  setTempDate(day);
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                }}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : "transparent",
                  },
                  !isSelected &&
                    isToday && {
                      borderWidth: 1.5,
                      borderColor: theme.colors.primary,
                    },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayText,
                    {
                      color: isCurrentMonth
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    },
                    isSelected && { color: "#fff", fontWeight: "800" },
                    !isSelected &&
                      isToday && {
                        color: theme.colors.primary,
                        fontWeight: "700",
                      },
                  ]}
                >
                  {format(day, "d")}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );

  const backdropStyle = useAnimatedStyle(() => ({ opacity: openAnim.value }));
  const containerStyle = useAnimatedStyle(() => ({
    opacity: openAnim.value,
    transform: [{ scale: interpolate(openAnim.value, [0, 1], [0.95, 1]) }],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
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

            <View style={styles.navBar}>
              {/* Prev Button */}
              <TouchableOpacity
                onPress={() => {
                  if (viewMode === "calendar")
                    setCurrentMonth(subMonths(currentMonth, 1));
                  else setViewMode("calendar");
                }}
                style={styles.navBtn}
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>

              {/* View Toggles - Adjusted Widths for no overlap */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  paddingHorizontal: 4,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    setViewMode(viewMode === "month" ? "calendar" : "month")
                  }
                  style={[
                    styles.dropdownBtn,
                    { width: 110 }, // Tuned Width
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
                    { width: 75 }, // Tuned Width
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

              {/* Next Button */}
              <TouchableOpacity
                onPress={() => {
                  if (viewMode === "calendar")
                    setCurrentMonth(addMonths(currentMonth, 1));
                  else setViewMode("calendar");
                }}
                style={styles.navBtn}
              >
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={20}
                  color={theme.colors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Content Frame */}
            <View style={styles.contentFrame}>
              {viewMode === "calendar" && renderCalendar()}

              {viewMode === "month" && (
                <Animated.View
                  entering={FadeIn}
                  exiting={FadeOut}
                  style={{ flex: 1 }}
                >
                  <WheelPicker
                    data={months}
                    initialIndex={months.findIndex(
                      (m) => m.getMonth() === currentMonth.getMonth(),
                    )}
                    onChange={handleMonthChange}
                    formatLabel={formatMonth}
                    onClose={() => setViewMode("calendar")}
                  />
                </Animated.View>
              )}

              {viewMode === "year" && (
                <Animated.View
                  entering={FadeIn}
                  exiting={FadeOut}
                  style={{ flex: 1 }}
                >
                  <WheelPicker
                    data={years}
                    initialIndex={Math.max(
                      0,
                      years.indexOf(currentMonth.getFullYear()),
                    )}
                    onChange={handleYearChange}
                    formatLabel={formatYear}
                    onClose={() => setViewMode("calendar")}
                  />
                </Animated.View>
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

  // Header Layout
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
