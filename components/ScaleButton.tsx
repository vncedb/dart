import React from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

interface ScaleButtonProps {
    onPress?: () => void;
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    disabled?: boolean;
    activeScale?: number;
}

export default function ScaleButton({ 
    onPress, 
    children, 
    style, 
    disabled = false, 
    activeScale = 0.96 
}: ScaleButtonProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(activeScale, { damping: 10, stiffness: 300 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 10, stiffness: 300 });
    };

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={{ width: '100%' }} // Ensures it takes full width in your layouts
        >
            <Animated.View style={[style, animatedStyle, { opacity: disabled ? 0.7 : 1 }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}