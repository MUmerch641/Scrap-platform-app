import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { semanticColors, spacing } from '@/shared/theme';

export interface ScreenScaffoldProps {
  children: React.ReactNode;
  /**
   * - 'standard': basic View container
   * - 'scroll': standard ScrollView container
   * - 'form': includes KeyboardAvoidingView and ScrollView optimized for inputs
   */
  mode?: 'standard' | 'scroll' | 'form';
  /** Optional header element to render inside the safe area scaffold. */
  header?: React.ReactNode;
  /**
   * Safe area edges to apply.
   * Default: ['top', 'left', 'right'].
   * Note: Tab screens typically do not need 'bottom' as the tab bar handles it.
   */
  edges?: Edge[];
  /** Add padding to the bottom to avoid the iOS floating tab bar (default: true) */
  avoidFloatingTabBar?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

const IOS_GLASS_TAB_BAR_HEIGHT = 62;
const IOS_GLASS_TAB_BAR_BOTTOM_MARGIN = 14;

export function ScreenScaffold({
  children,
  mode = 'standard',
  header,
  edges = ['top', 'left', 'right'],
  avoidFloatingTabBar = true,
  style,
  contentContainerStyle,
}: ScreenScaffoldProps) {
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const extraBottomPadding =
    Platform.OS === 'ios' && avoidFloatingTabBar
      ? IOS_GLASS_TAB_BAR_HEIGHT +
        IOS_GLASS_TAB_BAR_BOTTOM_MARGIN +
        Math.max(insets.bottom, 8)
      : 0;

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.background },
    style,
  ];

  const contentPadding = {
    padding: spacing.md,
    paddingBottom: spacing.md + extraBottomPadding,
  };

  if (mode === 'form' || mode === 'scroll') {
    const isForm = mode === 'form';
    const content = (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentPadding, contentContainerStyle]}
        keyboardShouldPersistTaps={isForm ? 'handled' : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );

    return (
      <SafeAreaView style={containerStyle} edges={edges}>
        {header}
        {isForm ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={containerStyle} edges={edges}>
      {header}
      <View style={[styles.innerContainer, contentPadding, contentContainerStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
  },
});
