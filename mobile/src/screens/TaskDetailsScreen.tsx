import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, ErrorBanner, PriorityBadge, CategoryBadge, TagBadge } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { getTask, setTaskStatus, deleteTask } from '../services/taskService';
import { extractErrorMessage } from '../services/api';
import { formatDateTime, isOverdue } from '../components/TaskCard';
import type { Task } from '../types';
import type { AppStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'TaskDetails'>;

export default function TaskDetailsScreen({ route, navigation }: Props) {
  const taskId = route.params.taskId;
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTask(await getTask(taskId));
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleStatus = async () => {
    if (!task) return;
    const next = task.status === 'completed' ? 'pending' : 'completed';
    try {
      setTask(await setTaskStatus(task._id, next));
    } catch (e) {
      setError(extractErrorMessage(e));
    }
  };

  const confirmDelete = () => {
    if (!task) return;
    Alert.alert('Delete Task', 'This task will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(task._id);
            navigation.goBack();
          } catch (e) {
            setError(extractErrorMessage(e));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <ErrorBanner message={error} />
        <Text style={typography.secondary}>{error ? 'Please try again.' : 'Task not found.'}</Text>
      </View>
    );
  }

  const done = task.status === 'completed';
  const overdue = isOverdue(task);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} />

      <Text style={[typography.title, done && styles.doneTitle]}>{task.title}</Text>

      <View style={styles.metaRow}>
        <PriorityBadge priority={task.priority} />
        <CategoryBadge category={task.category} />
        <Text style={[styles.status, done && styles.statusDone]}>
          {done ? '✓ Completed' : '⏳ Pending'}
        </Text>
      </View>

      {task.tags && task.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {task.tags.map(t => (
            <TagBadge key={t} tag={t} />
          ))}
        </View>
      ) : null}

      {task.description ? (
        <>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.bodyText}>{task.description}</Text>
        </>
      ) : null}

      {task.scheduledAt ? (
        <>
          <Text style={styles.sectionLabel}>📅 Scheduled Date & Time</Text>
          <Text style={styles.bodyText}>{formatDateTime(task.scheduledAt, 'Not scheduled')}</Text>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>⏰ Deadline Date & Time</Text>
      <Text style={[styles.bodyText, overdue && styles.overdue]}>
        {formatDateTime(task.deadline, 'No deadline set')}
        {overdue ? ' (Overdue!)' : ''}
      </Text>

      <View style={styles.actions}>
        <PrimaryButton
          label={done ? 'Mark as Pending' : 'Mark as Completed'}
          variant={done ? 'secondary' : 'primary'}
          onPress={toggleStatus}
        />
        <PrimaryButton label="Edit Task" variant="secondary" onPress={() => navigation.navigate('TaskForm', { taskId })} />
        <PrimaryButton label="Delete Task" variant="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  doneTitle: { textDecorationLine: 'line-through', color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  status: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  statusDone: { color: colors.success },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  bodyText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  overdue: { color: colors.error, fontWeight: '700' },
  actions: { gap: spacing.md, marginTop: spacing.xxl },
});
