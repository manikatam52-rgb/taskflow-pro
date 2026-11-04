import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  PrimaryButton,
  ErrorBanner,
  PriorityBadge,
  CategoryBadge,
  TagBadge,
} from '../components/ui';
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
  const [updating, setUpdating] = useState(false);

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
    setUpdating(true);
    try {
      setTask(await setTaskStatus(task._id, next));
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setUpdating(false);
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
        <Text style={typography.secondary}>
          {error ? 'Please try again.' : 'Task not found.'}
        </Text>
      </View>
    );
  }

  const done = task.status === 'completed';
  const overdue = isOverdue(task);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.detailsCard}>
        <ErrorBanner message={error} />

        <Text
          style={[typography.title, styles.title, done && styles.doneTitle]}
        >
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          <PriorityBadge priority={task.priority} />
          <CategoryBadge category={task.category} />
          <View style={[styles.statusPill, done && styles.statusPillDone]}>
            <MaterialCommunityIcons
              name={done ? 'check-circle' : 'progress-clock'}
              size={15}
              color={done ? colors.success : colors.primary}
            />
            <Text style={[styles.status, done && styles.statusDone]}>
              {done ? 'Completed' : 'In progress'}
            </Text>
          </View>
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
            <Text style={styles.sectionLabel}>Scheduled</Text>
            <Text style={styles.bodyText}>
              {formatDateTime(task.scheduledAt, 'Not scheduled')}
            </Text>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Deadline</Text>
        <Text style={[styles.bodyText, overdue && styles.overdue]}>
          {formatDateTime(task.deadline, 'No deadline set')}
          {overdue ? ' (Overdue!)' : ''}
        </Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton
          label={done ? 'Mark as Pending' : 'Mark as Completed'}
          variant={done ? 'secondary' : 'primary'}
          onPress={toggleStatus}
          loading={updating}
          disabled={updating}
        />
        <PrimaryButton
          label="Edit Task"
          variant="secondary"
          onPress={() => navigation.navigate('TaskForm', { taskId })}
        />
        <PrimaryButton
          label="Delete Task"
          variant="danger"
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    padding: spacing.lg,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: spacing.xl,
  },
  title: { lineHeight: 34 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  doneTitle: { textDecorationLine: 'line-through', color: colors.textMuted },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  status: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  statusDone: { color: colors.success },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
  },
  statusPillDone: { backgroundColor: colors.successLight },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  bodyText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  overdue: { color: colors.error, fontWeight: '700' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
