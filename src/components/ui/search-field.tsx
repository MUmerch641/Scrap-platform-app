import { Ionicons } from '@expo/vector-icons';
import {
    Pressable,
    StyleSheet,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';

import { radius, semanticColors, spacing, typography } from '@/shared/theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
}: SearchFieldProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = semanticColors[isDark ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputSurface,
          borderColor: colors.inputBorder,
        },
      ]}
    >
      <Ionicons
        name="search-outline"
        size={16}
        color={colors.textMuted}
        style={styles.searchIcon}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inputPlaceholder}
        style={[styles.input, { color: colors.inputText }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 42,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  input: {
    fontFamily: typography.fontFamily.body,
    flex: 1,
    height: '100%',
    fontSize: typography.fontSize.sm,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
});
