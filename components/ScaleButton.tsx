import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

interface ScaleButtonProps {
    onPress?: () => void;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
    activeScale?: number;
}

export default function ScaleButton({ 
    onPress, 
    children, 
    style, 
    disabled = false, 
    activeScale = 0.95 
}: ScaleButtonProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value
    }));

    const handlePressIn = () => {
        if (disabled) return;
        scale.value = withSpring(activeScale, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(0.9, { duration: 100, easing: Easing.out(Easing.quad) });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
    };

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={{ width: '100%' }}
        >
            <Animated.View style={[style, animatedStyle, { opacity: disabled ? 0.6 : 1 }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}