import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function CustomersStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: Platform.OS === 'ios' }}>
      <Stack.Screen name="index" options={{ title: 'Customers' }} />
    </Stack>
  );
}
