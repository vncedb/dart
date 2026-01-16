import React from 'react';
import { ViewStyle } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

interface AnimatedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemStyle?: ViewStyle;
  style?: ViewStyle;
  delay?: number; // Delay between items in ms
}

export function AnimatedList<T>({ data, renderItem, itemStyle, style, delay = 100 }: AnimatedListProps<T>) {
  return (
    <Animated.View style={style} layout={Layout.springify()}>
      {data.map((item, index) => (
        <Animated.View
          key={(item as any).id || index}
          entering={FadeInDown.delay(index * delay).duration(600).springify().damping(12)}
          layout={Layout.springify()}
          style={itemStyle}
        >
          {renderItem(item, index)}
        </Animated.View>
      ))}
    </Animated.View>
  );
}