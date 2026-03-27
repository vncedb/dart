import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../constants/theme';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface SkeletonBlockProps {
    style?: StyleProp<ViewStyle>;
}

interface SkeletonCircleProps {
    size: number;
    style?: StyleProp<ViewStyle>;
}

export function useSkeletonPalette() {
    const theme = useAppTheme();

    return {
        base: theme.dark ? '#2A2F37' : '#E2E8F0',
        highlight: theme.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.78)',
        surface: theme.dark ? '#1C2128' : '#F4F7FA',
        mutedSurface: theme.dark ? '#171B21' : '#EEF2F6',
        border: theme.dark ? '#313844' : '#D8E0E8',
    };
}

export function SkeletonBlock({ style }: SkeletonBlockProps) {
    const { base, highlight } = useSkeletonPalette();
    const progress = useSharedValue(0);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: 1400, easing: Easing.linear }),
            -1,
            false
        );
    }, [progress]);

    const handleLayout = (event: LayoutChangeEvent) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== width) {
            setWidth(nextWidth);
        }
    };

    const shimmerStyle = useAnimatedStyle(() => {
        const measuredWidth = width || 220;
        const shimmerWidth = Math.max(measuredWidth * 0.55, 96);

        return {
            width: shimmerWidth,
            transform: [
                {
                    translateX: interpolate(
                        progress.value,
                        [0, 1],
                        [-shimmerWidth, measuredWidth + shimmerWidth]
                    ),
                },
            ],
        };
    });

    return (
        <View onLayout={handleLayout} style={[styles.block, { backgroundColor: base }, style]}>
            <AnimatedLinearGradient
                colors={['transparent', highlight, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.shimmer, shimmerStyle]}
            />
        </View>
    );
}

export function SkeletonCircle({ size, style }: SkeletonCircleProps) {
    return <SkeletonBlock style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}

const styles = StyleSheet.create({
    block: {
        overflow: 'hidden',
        borderRadius: 12,
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
    },
});
