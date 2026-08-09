import { Stack } from 'expo-router';

export default function SalesRepHomeStackLayout() {
  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
