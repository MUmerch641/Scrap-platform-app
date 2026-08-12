import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, useColorScheme } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { semanticColors } from '@/shared/theme';

export default function SalesRepHomeStackLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = semanticColors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        headerBackButtonDisplayMode: Platform.OS === 'ios' ? 'minimal' : 'default',
        headerLeft: Platform.OS === 'ios'
          ? () => (
              <Pressable
                onPress={() => router.back()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={({ pressed }) => [
                  styles.iosBackButton,
                  pressed && styles.iosBackButtonPressed,
                ]}
              >
                <AppIcon name="chevron-back" size={28} color={colors.primary} />
              </Pressable>
            )
          : undefined,
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

const styles = StyleSheet.create({
  iosBackButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iosBackButtonPressed: {
    opacity: 0.5,
  },
});
