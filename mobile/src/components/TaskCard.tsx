import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import type { Task } from '../types';
import { PriorityBadge, CategoryBadge, TagBadge } from './ui';
import { colors, spacing, shadows } from '../theme';

/** Formats an ISO string as "12 Oct 2026, 5:30 PM" (local time). */
export function formatDateTime(
  iso: string | null,
  fallback = 'No date',
): string {
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

export const TaskCard = React.memo(function TaskCard({
  task,
  onPress,
  onToggleComplete,
  onLongPress,
}: TaskCardProps) {
  const done = task.status === 'completed';
  const overdue = isOverdue(task);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        done && styles.cardDone,
        {
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${done ? 'completed' : 'pending'}, ${
        task.priority
      } priority`}
      accessibilityHint="Opens task details. Long press to delete."
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Checkbox */}
      <Pressable
        onPress={event => {
          event.stopPropagation();
          onToggleComplete();
        }}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${task.title} ${
          done ? 'pending' : 'completed'
        }`}
        accessibilityState={{ checked: done }}
        style={[styles.checkbox, done && styles.checkboxDone]}
      >
        {done ? (
          <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
        ) : null}
      </Pressable>

      <View style={styles.cardBody}>
        {/* Title */}
        <Text
          style={[styles.title, done && styles.titleDone]}
          numberOfLines={1}
        >
          {task.title}
        </Text>

        {/* Description */}
        {task.description ? (
          <Text
            style={[styles.description, done && styles.descriptionDone]}
            numberOfLines={2}
          >
            {task.description}
          </Text>
        ) : null}

        {/* Badges row */}
        <View style={styles.badgeRow}>
          <PriorityBadge priority={task.priority} />
          <CategoryBadge category={task.category} />
          {task.tags && task.tags.length > 0
            ? task.tags.slice(0, 2).map(tag => <TagBadge key={tag} tag={tag} />)
            : null}
        </View>

        {/* Schedule & Deadline Dates */}
        <View style={styles.dateRow}>
          {task.scheduledAt ? (
            <View style={styles.dateItem}>
              <MaterialCommunityIcons
                name="calendar-outline"
                size={14}
                color={colors.textMuted}
              />
              <Text style={styles.dateText}>
                {formatDateTime(task.scheduledAt)}
              </Text>
            </View>
          ) : null}
          {task.deadline ? (
            <View style={styles.dateItem}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color={overdue ? colors.error : colors.textMuted}
              />
              <Text style={[styles.dateText, overdue && styles.overdue]}>
                {overdue ? 'Overdue · ' : ''}
                {formatDateTime(task.deadline)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardDone: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.border,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  cardBody: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.15,
  },
  titleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  description: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  descriptionDone: { color: colors.textMuted },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  overdue: { color: colors.error, fontWeight: '700' },
});
