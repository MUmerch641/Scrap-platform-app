import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function SalesRepHomeStackLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="pickups"
        options={{ title: 'My Pickups', headerShown: Platform.OS === 'ios' }}
      />
      <Stack.Screen
        name="pickup/[id]"
        options={{ title: 'Pickup Details', headerShown: Platform.OS === 'ios' }}
      />
    </Stack>
  );
}
