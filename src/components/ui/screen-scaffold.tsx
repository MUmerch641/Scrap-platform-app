import React, { RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native';
import {
  Edge,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { semanticColors, spacing } from '@/shared/theme';

export interface ScreenScaffoldProps {
  children: React.ReactNode;

  /**
   * standard
   * Basic non-scrollable View container
   *
   * scroll
   * Standard ScrollView container
   *
   * form
   * Keyboard-aware ScrollView optimized for forms
   */
  mode?: 'standard' | 'scroll' | 'form';

  /** Optional header rendered inside the safe area */
  header?: React.ReactNode;

  /**
   * Safe-area edges applied to the screen
   *
   * Default
   * top left right
   *
   * Tab screens normally do not require bottom because
   * the native tab bar manages the bottom area
   */
  edges?: Edge[];

  /** Adds space for the platform native tab bar. Default true. */
  avoidFloatingTabBar?: boolean;

  /** Use Android keyboard resizing for a form when native window resize is insufficient. */
  androidKeyboardAvoidance?: boolean;

  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;

  /** Optional access to the primary scroll container for focused form fields. */
  scrollViewRef?: RefObject<ScrollView | null>;
}

const IOS_GLASS_TAB_BAR_HEIGHT = 62;
const IOS_GLASS_TAB_BAR_BOTTOM_MARGIN = 14;
const ANDROID_NATIVE_TAB_BAR_HEIGHT = 56;

export function ScreenScaffold({
  children,
  mode = 'standard',
  header,
  edges = ['top', 'left', 'right'],
  avoidFloatingTabBar = true,
  androidKeyboardAvoidance = false,
  style,
  contentContainerStyle,
  scrollViewRef,
}: ScreenScaffoldProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const colors =
    semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  const isForm = mode === 'form';
  const isScrollable = mode === 'form' || mode === 'scroll';

  const extraBottomPadding =
    !avoidFloatingTabBar
      ? 0
      : Platform.OS === 'ios'
        ? IOS_GLASS_TAB_BAR_HEIGHT +
          IOS_GLASS_TAB_BAR_BOTTOM_MARGIN +
          Math.max(insets.bottom, spacing.sm)
        : ANDROID_NATIVE_TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.sm);

  const containerStyle = [
    styles.container,
    {
      backgroundColor: colors.background,
    },
    style,
  ];

  const contentPadding: ViewStyle = {
    padding: spacing.md,
    paddingBottom: spacing.md + extraBottomPadding,
  };

  if (isScrollable) {
    const scrollContent = (
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          contentPadding,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios' ? 'interactive' : 'none'
        }
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );

    return (
      <SafeAreaView
        style={containerStyle}
        edges={edges}
      >
        {header}

        {isForm && (Platform.OS === 'ios' || androidKeyboardAvoidance) ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
            enabled
          >
            {scrollContent}
          </KeyboardAvoidingView>
        ) : (
          scrollContent
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={containerStyle}
      edges={edges}
    >
      {header}

      <View
        style={[
          styles.innerContainer,
          contentPadding,
          contentContainerStyle,
        ]}
      >
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  innerContainer: {
    flex: 1,
  },
});
