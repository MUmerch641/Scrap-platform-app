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

export default function SalesRepDashboardScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const salesTabs: TabItem[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'accounts', label: 'Accounts', icon: '🏢' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ];

  const handleItemPress = (title: string) => {
    showInfoMessage(`${title} selected`);
  };

  return (
    <View style={styles.flex}>
      <AppHeader title="Sales Workspace" subtitle="Mobile Platform Foundation" />

      <ScreenContainer scrollable contentContainerStyle={styles.container}>
        <PageHeader
          title="Sales Rep Dashboard"
          subtitle="Neutral mobile interface foundation — business workflows pending specification"
        />

        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search placeholder accounts..."
        />

        <View style={styles.listSection}>
          <ListItem
            title="Placeholder Account Record"
            subtitle="Record #101 — Interface shell validation"
            statusLabel="Active"
            statusVariant="success"
            onPress={() => handleItemPress('Account Record')}
          />
          <ListItem
            title="Placeholder Follow-up"
            subtitle="Record #102 — Pending backend specification"
            statusLabel="Review"
            statusVariant="warning"
            onPress={() => handleItemPress('Follow-up')}
          />
          <ListItem
            title="Placeholder Activity"
            subtitle="Record #103 — Neutral template container"
            statusLabel="Archived"
            statusVariant="neutral"
            onPress={() => handleItemPress('Activity')}
          />
        </View>
      </ScreenContainer>

      <BottomNavShell
        tabs={salesTabs}
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
