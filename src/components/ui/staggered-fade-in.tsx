import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface StaggeredFadeInProps {
  children: React.ReactNode;
  index: number;
  runKey?: number | string;
  style?: StyleProp<ViewStyle>;
}

const MAX_STAGGERED_ITEMS = 8;
const ITEM_DELAY_MS = 32;
const ITEM_DURATION_MS = 220;
const START_OFFSET_Y = 10;

export function StaggeredFadeIn({
  children,
  index,
  runKey = 0,
  style,
}: StaggeredFadeInProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(START_OFFSET_Y);

  React.useEffect(() => {
    const safeIndex = Math.max(0, Math.min(index, MAX_STAGGERED_ITEMS - 1));
    const delay = reduceMotion ? 0 : safeIndex * ITEM_DELAY_MS;
    const duration = reduceMotion ? 0 : ITEM_DURATION_MS;
    const easing = Easing.out(Easing.cubic);

    opacity.value = 0;
    translateY.value = reduceMotion ? 0 : START_OFFSET_Y;
    opacity.value = withDelay(delay, withTiming(1, { duration, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing }));
  }, [index, opacity, reduceMotion, runKey, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
