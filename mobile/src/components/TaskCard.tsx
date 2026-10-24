import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Task } from '../types';
import { PriorityBadge, CategoryBadge, TagBadge } from './ui';
import { colors, spacing, shadows } from '../theme';

/** Formats an ISO string as "12 Oct 2026, 5:30 PM" (local time). */
export function formatDateTime(iso: string | null, fallback = 'No date'): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isOverdue(task: Task): boolean {
  if (task.status === 'completed' || !task.deadline) return false;
  return new Date(task.deadline).getTime() < Date.now();
}

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onToggleComplete: () => void;
  onLongPress?: () => void;
}

export function TaskCard({ task, onPress, onToggleComplete, onLongPress }: TaskCardProps) {
  const done = task.status === 'completed';
  const overdue = isOverdue(task);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        done && styles.cardDone,
        { opacity: pressed ? 0.92 : 1 },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}>
      {/* Checkbox */}
      <Pressable
        onPress={onToggleComplete}
        hitSlop={8}
        style={[styles.checkbox, done && styles.checkboxDone]}>
        {done ? <Text style={styles.checkmark}>✓</Text> : null}
      </Pressable>

      <View style={styles.cardBody}>
        {/* Title */}
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
          {task.title}
        </Text>

        {/* Description */}
        {task.description ? (
          <Text style={[styles.description, done && styles.descriptionDone]} numberOfLines={2}>
            {task.description}
          </Text>
        ) : null}

        {/* Badges row */}
        <View style={styles.badgeRow}>
          <PriorityBadge priority={task.priority} />
          <CategoryBadge category={task.category} />
          {task.tags && task.tags.length > 0 ? (
            task.tags.slice(0, 2).map(tag => <TagBadge key={tag} tag={tag} />)
          ) : null}
        </View>

        {/* Schedule & Deadline Dates */}
        <View style={styles.dateRow}>
          {task.scheduledAt ? (
            <Text style={styles.dateText}>
              📅 {formatDateTime(task.scheduledAt)}
            </Text>
          ) : null}
          {task.deadline ? (
            <Text style={[styles.dateText, overdue && styles.overdue]}>
              ⏰ {formatDateTime(task.deadline)}
              {overdue ? ' (Overdue!)' : ''}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardDone: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  cardBody: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  description: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  descriptionDone: { color: colors.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  dateText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  overdue: { color: colors.error, fontWeight: '700' },
});
