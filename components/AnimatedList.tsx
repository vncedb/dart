import React from 'react';
import { ScrollViewProps, ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  LinearTransition
} from 'react-native-reanimated';

interface AnimatedListProps<T> extends Omit<ScrollViewProps, 'style'> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemStyle?: ViewStyle;
  style?: ViewStyle;
  delay?: number;
  initialDelay?: number;
  showScrollbar?: boolean;
}

export function AnimatedList<T>({ 
  data, 
  renderItem, 
  itemStyle, 
  style, 
  delay = 100, 
  initialDelay = 0,
  showScrollbar = false,
  contentContainerStyle,
  ...props 
}: AnimatedListProps<T>) {
  return (
    <Animated.ScrollView
      style={style}
      showsVerticalScrollIndicator={showScrollbar}
      showsHorizontalScrollIndicator={showScrollbar}
      contentContainerStyle={[
          { paddingBottom: 120 }, 
          contentContainerStyle
      ]}
      // FIX: Use LinearTransition with duration to remove list reorder bounce
      layout={LinearTransition.duration(250)}
      {...props}
    >
      {data.map((item, index) => (
        <Animated.View
          key={(item as any).id || index}
          // FIX: Removed .springify() to stop the entrance bounce
          entering={FadeInDown.delay(initialDelay + index * delay).duration(300)}
          exiting={FadeOutDown.duration(200)}
          // FIX: overflow: 'visible' prevents shadow clipping/grey artifacts during move
          style={[itemStyle, { overflow: 'visible' }]} 
        >
          {renderItem(item, index)}
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
}