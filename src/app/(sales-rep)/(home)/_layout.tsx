import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function SalesRepHomeStackLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        headerBackButtonDisplayMode: Platform.OS === 'ios' ? 'minimal' : 'default',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="pickups" />
      <Stack.Screen name="pickup/[id]" />
    </Stack>
  );
}
