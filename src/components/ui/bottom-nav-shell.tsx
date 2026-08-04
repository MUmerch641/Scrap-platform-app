import React from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { semanticColors, spacing } from '@/shared/theme';

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
          borderTopColor: isDark ? '#27272a' : '#e4e4e7',
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const activeColor = colors.primary;
        const inactiveColor = isDark ? '#71717a' : '#9ca3af';

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
    fontSize: 11,
    fontWeight: '500',
  },
});
