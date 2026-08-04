import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/ui/app-header';
import { BottomNavShell, TabItem } from '@/components/ui/bottom-nav-shell';
import { ListItem } from '@/components/ui/list-item';
import { PageHeader } from '@/components/ui/page-header';
import { ScreenContainer } from '@/components/ui/screen-container';
import { SearchField } from '@/components/ui/search-field';
import { showInfoMessage } from '@/services/native-feedback-service';
import { spacing } from '@/shared/theme';

export default function DriverDashboardScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const driverTabs: TabItem[] = [
    { key: 'overview', label: 'Overview', icon: '📋' },
    { key: 'schedule', label: 'Schedule', icon: '📅' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ];

  const handleItemPress = (title: string) => {
    showInfoMessage(`${title} selected`);
  };

  return (
    <View style={styles.flex}>
      <AppHeader title="Driver Workspace" subtitle="Mobile Platform Foundation" />

      <ScreenContainer scrollable contentContainerStyle={styles.container}>
        <PageHeader
          title="Driver Dashboard"
          subtitle="Neutral mobile interface foundation — business workflows pending specification"
        />

        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search placeholder items..."
        />

        <View style={styles.listSection}>
          <ListItem
            title="Placeholder Schedule Queue"
            subtitle="Item #1 — Foundation UI component verification"
            statusLabel="Active"
            statusVariant="success"
            onPress={() => handleItemPress('Schedule Queue')}
          />
          <ListItem
            title="Placeholder Assignment"
            subtitle="Item #2 — Pending backend specification"
            statusLabel="Pending"
            statusVariant="warning"
            onPress={() => handleItemPress('Assignment')}
          />
          <ListItem
            title="Placeholder Task Log"
            subtitle="Item #3 — Neutral template container"
            statusLabel="Completed"
            statusVariant="neutral"
            onPress={() => handleItemPress('Task Log')}
          />
        </View>
      </ScreenContainer>

      <BottomNavShell
        tabs={driverTabs}
        activeTab={activeTab}
        onTabSelect={(tab) => {
          showInfoMessage(`Switched to ${tab} tab`);
          setActiveTab(tab);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: spacing.md,
  },
  listSection: {
    marginTop: spacing.xs,
  },
});
