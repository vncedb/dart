import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';

interface AnimatedListProps<T> {
    data: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    style?: StyleProp<ViewStyle>;
    delay?: number;
}

export function AnimatedList<T>({ data, renderItem, style, delay = 80 }: AnimatedListProps<T>) {
    return (
        <View style={style}>
            {data.map((item, index) => {
                // Securely extract a key to avoid re-renders
                const key = (item as any)?.id || index.toString();
                
                return (
                    <Animated.View
                        key={key}
                        // Smooth, consistent easing with no spring/bounce effects
                        entering={FadeInDown.delay(index * delay).duration(300).easing(Easing.out(Easing.ease))}
                        exiting={FadeOutUp.duration(200).easing(Easing.in(Easing.ease))}
                        layout={LinearTransition.duration(300).easing(Easing.out(Easing.ease))}
                        // CRITICAL: These prevent the Android black shadow box glitch during opacity animations
                        renderToHardwareTextureAndroid={Platform.OS === 'android'}
                        needsOffscreenAlphaCompositing={Platform.OS === 'android'}
                        style={{ backgroundColor: 'transparent' }}
                    >
                        {renderItem(item, index)}
                    </Animated.View>
                );
            })}
        </View>
    );
}