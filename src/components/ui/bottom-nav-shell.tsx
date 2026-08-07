import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { semanticColors, spacing, typography } from '@/shared/theme';

export interface TabItem {
  key: string;
  label: string;
  icon: string;
}

interface BottomNavShellProps {
  tabs: TabItem[];
  activeTab: string;
  onTabSelect: (tabKey: string) => void;
}

export function BottomNavShell({ tabs, activeTab, onTabSelect }: BottomNavShellProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const activeColor = colors.accent;
        const inactiveColor = colors.textMuted;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabSelect(tab.key)}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityLabel={`${tab.label} tab`}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text
              style={[
                styles.label,
                { color: isActive ? activeColor : inactiveColor },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xs,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  icon: {
    fontSize: 18,
    marginBottom: 2,
  },
  label: {
    fontFamily: typography.fontFamily.bodyMedium,
    fontSize: 11,
  },
});
