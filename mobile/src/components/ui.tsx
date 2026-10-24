import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing, shadows } from '../theme';
import type { Priority } from '../types';

/* ---------- PrimaryButton ---------- */

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary', style }: ButtonProps) {
  const bg =
    variant === 'danger' ? colors.error : variant === 'secondary' ? colors.primaryLight : colors.primary;
  const fg = variant === 'secondary' ? colors.primary : '#FFFFFF';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        shadows.sm,
        { backgroundColor: bg, opacity: disabled ? 0.6 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/* ---------- LabeledInput ---------- */

interface InputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
  error?: string | null;
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  autoCapitalize = 'none',
  keyboardType = 'default',
  error,
}: InputProps) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/* ---------- ErrorBanner ---------- */

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/* ---------- PriorityBadge ---------- */

const PRIORITY_LABEL: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export function PriorityBadge({ priority }: { priority: Priority }) {
  const bgKey = `${priority}Bg` as keyof typeof colors.priority;
  const color = colors.priority[priority];
  const bg = colors.priority[bgKey] || colors.primaryLight;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>
        {PRIORITY_LABEL[priority]}
      </Text>
    </View>
  );
}

/* ---------- CategoryBadge ---------- */

export function CategoryBadge({ category }: { category: string }) {
  if (!category || category === 'general') return null;
  const key = category.toLowerCase();
  const theme = colors.categories[key] || colors.categories.general;

  return (
    <View style={[styles.categoryBadge, { backgroundColor: theme.bg }]}>
      <Text style={[styles.categoryText, { color: theme.text }]}>
        🏷️ {category}
      </Text>
    </View>
  );
}

/* ---------- TagBadge ---------- */

export function TagBadge({ tag }: { tag: string }) {
  return (
    <View style={styles.tagBadge}>
      <Text style={styles.tagText}>#{tag}</Text>
    </View>
  );
}

/* ---------- StatCard ---------- */

interface StatCardProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  active?: boolean;
  onPress?: () => void;
}

export function StatCard({ label, count, color, bgColor, active, onPress }: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        shadows.sm,
        { backgroundColor: active ? color : colors.surface, opacity: pressed ? 0.9 : 1 },
      ]}>
      <View style={[styles.statIconCircle, { backgroundColor: active ? '#FFFFFF33' : bgColor }]}>
        <Text style={[styles.statCount, { color: active ? '#FFFFFF' : color }]}>{count}</Text>
      </View>
      <Text style={[styles.statLabel, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  inputWrap: { marginBottom: spacing.md },
  inputLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputMultiline: { height: 90, textAlignVertical: 'top' },
  inputError: { borderColor: colors.error },
  banner: {
    backgroundColor: colors.errorLight,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  categoryBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText: { fontSize: 11, fontWeight: '600' },
  tagBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statCount: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
});
