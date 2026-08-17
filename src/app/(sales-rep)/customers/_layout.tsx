import { Stack } from 'expo-router';

import { Platform } from 'react-native';

export default function CustomersStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackButtonDisplayMode: Platform.OS === 'ios' ? 'minimal' : 'default',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Customer Details', headerShown: Platform.OS === 'ios' }}
      />
    </Stack>
  );
}
