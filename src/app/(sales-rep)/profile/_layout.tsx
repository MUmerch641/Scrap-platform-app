import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function ProfileStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: Platform.OS === 'ios' }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
    </Stack>
  );
}
