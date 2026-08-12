import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function CreatePickupStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: Platform.OS === 'ios' }}>
      <Stack.Screen name="index" options={{ title: 'Create Pickup' }} />
    </Stack>
  );
}
