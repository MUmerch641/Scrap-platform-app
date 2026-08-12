import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function SalesRepHomeStackLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: Platform.OS === 'ios',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="pickups" options={{ title: 'My Pickups' }} />
      <Stack.Screen name="pickup/[id]" options={{ title: 'Pickup Details' }} />
    </Stack>
  );
}
