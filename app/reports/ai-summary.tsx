import {
  Notification01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import Header from "../../components/Header";
import { useAppTheme } from "../../constants/theme";
import { FontFamily, Typography } from "../../constants/typography";

export default function AISummaryScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <Header title="Summary" />

      <View style={styles.container}>
        <Animated.View entering={FadeInDown.duration(600).delay(100)} style={styles.content}>
          {/* Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.colors.primary + "12" },
              pulseStyle,
            ]}
          >
            <View style={[styles.iconInner, { backgroundColor: theme.colors.primary + "18" }]}>
              <HugeiconsIcon icon={SparklesIcon} size={40} color={theme.colors.primary} />
            </View>
          </Animated.View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text }]}>Coming Soon</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            AI-Powered Summary
          </Text>

          {/* Description */}
          <View style={[styles.descCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Text style={[styles.descText, { color: theme.colors.text }]}>
              We're building an intelligent summary feature powered by Google Gemini that will automatically draft performance reviews and analytics insights based on your daily logs.
            </Text>
          </View>

          {/* Feature List */}
          <View style={styles.featureList}>
            {[
              "Auto-generated weekly performance reviews",
              "Smart analytics from attendance patterns",
              "AI-driven productivity insights",
              "One-tap export and sharing",
            ].map((feature, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.duration(400).delay(300 + i * 100)}
                style={styles.featureRow}
              >
                <View style={[styles.featureDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                  {feature}
                </Text>
              </Animated.View>
            ))}
          </View>

          {/* Notification CTA */}
          <View style={[styles.notifCard, { backgroundColor: theme.dark ? theme.colors.primary + '10' : '#EEF2FF', borderColor: theme.colors.primary + '20' }]}>
            <HugeiconsIcon icon={Notification01Icon} size={18} color={theme.colors.primary} />
            <Text style={[styles.notifText, { color: theme.colors.primary }]}>
              You'll be notified when this feature is available.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <Button title="Go Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.h1,
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.bodyMedium,
    marginBottom: 24,
  },
  descCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 28,
  },
  descText: {
    ...Typography.body,
    textAlign: "center",
    lineHeight: 24,
  },
  featureList: { alignSelf: "stretch", gap: 14, marginBottom: 28, paddingHorizontal: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureDot: { width: 6, height: 6, borderRadius: 3 },
  featureText: { ...Typography.smallMedium, flex: 1 },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  notifText: { ...Typography.caption, flex: 1 },
  footer: { paddingHorizontal: 24, paddingBottom: 32 },
});
