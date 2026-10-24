import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { PrimaryButton, LabeledInput, ErrorBanner } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import { createTask, updateTask, getTask } from '../services/taskService';
import { extractErrorMessage } from '../services/api';
import type { Priority, Task } from '../types';
import type { AppStackParamList } from '../navigation/types';

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const CATEGORY_PRESETS = ['general', 'work', 'personal', 'shopping', 'health'];

type Props = NativeStackScreenProps<AppStackParamList, 'TaskForm'>;

export default function TaskFormScreen({ route }: Props) {
  const navigation = useNavigation();
  const editingId = route.params?.taskId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [tagsInput, setTagsInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [activePicker, setActivePicker] = useState<{
    target: 'scheduledAt' | 'deadline';
    step: 'date' | 'time';
  } | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editingId);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string }>({});

  // Load the task being edited.
  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const task: Task = await getTask(editingId);
        setTitle(task.title);
        setDescription(task.description ?? '');
        setCategory(task.category ?? 'general');
        setTagsInput(task.tags ? task.tags.join(', ') : '');
        setPriority(task.priority);
        if (task.scheduledAt) setScheduledAt(new Date(task.scheduledAt));
        if (task.deadline) setDeadline(new Date(task.deadline));
      } catch (e) {
        setError(extractErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [editingId]);

  const submit = async () => {
    if (!title.trim()) {
      setFieldErrors({ title: 'Title is required' });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const input = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim().toLowerCase() || 'general',
      tags: parsedTags,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      deadline: deadline ? deadline.toISOString() : null,
      priority,
    };

    try {
      if (editingId) {
        await updateTask(editingId, input);
      } else {
        await createTask(input);
      }
      navigation.goBack();
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const renderPicker = () => {
    if (!activePicker) return null;
    const DateTimePicker = require('@react-native-community/datetimepicker').default;
    const isScheduled = activePicker.target === 'scheduledAt';
    const currentValue = isScheduled ? (scheduledAt ?? new Date()) : (deadline ?? new Date());

    if (activePicker.step === 'date') {
      return (
        <DateTimePicker
          value={currentValue}
          mode="date"
          display="default"
          onChange={(_e: unknown, d?: Date) => {
            if (d) {
              const base = new Date(currentValue);
              base.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              if (isScheduled) setScheduledAt(base);
              else setDeadline(base);
              setActivePicker({ target: activePicker.target, step: 'time' });
            } else {
              setActivePicker(null);
            }
          }}
        />
      );
    }
    return (
      <DateTimePicker
        value={currentValue}
        mode="time"
        display="default"
        onChange={(_e: unknown, d?: Date) => {
          if (d) {
            const base = new Date(currentValue);
            base.setHours(d.getHours(), d.getMinutes(), 0, 0);
            if (isScheduled) setScheduledAt(base);
            else setDeadline(base);
          }
          setActivePicker(null);
        }}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={typography.secondary}>Loading task details…</Text>
      </View>
    );
  }

  const formatDisplay = (d: Date | null) =>
    d
      ? d.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Select date & time';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'android' ? undefined : 'padding'}
      style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={error} />

        {/* Title */}
        <LabeledInput
          label="Title *"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Complete project report"
          error={fieldErrors.title}
        />

        {/* Description */}
        <LabeledInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Add details or notes..."
          multiline
        />

        {/* Category Selection */}
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.presetsRow}>
          {CATEGORY_PRESETS.map(cat => {
            const active = category.toLowerCase() === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <LabeledInput
          label="Or Custom Category"
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Finance, Health, Project"
        />

        {/* Tags */}
        <LabeledInput
          label="Tags (comma separated)"
          value={tagsInput}
          onChangeText={setTagsInput}
          placeholder="e.g. urgent, client, feature"
        />

        {/* Scheduled Date & Time */}
        <Text style={styles.sectionLabel}>📅 Scheduled Date & Time</Text>
        <View style={styles.dateRow}>
          <Pressable
            style={styles.dateButton}
            onPress={() => setActivePicker({ target: 'scheduledAt', step: 'date' })}>
            <Text style={styles.dateText}>{formatDisplay(scheduledAt)}</Text>
          </Pressable>
          {scheduledAt ? (
            <Pressable onPress={() => setScheduledAt(null)} hitSlop={8}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Deadline Date & Time */}
        <Text style={styles.sectionLabel}>⏰ Deadline Date & Time</Text>
        <View style={styles.dateRow}>
          <Pressable
            style={styles.dateButton}
            onPress={() => setActivePicker({ target: 'deadline', step: 'date' })}>
            <Text style={styles.dateText}>{formatDisplay(deadline)}</Text>
          </Pressable>
          {deadline ? (
            <Pressable onPress={() => setDeadline(null)} hitSlop={8}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        {renderPicker()}

        {/* Priority */}
        <Text style={styles.sectionLabel}>⚡ Priority</Text>
        <View style={styles.row}>
          {PRIORITIES.map(p => (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              style={[styles.chip, priority === p && styles.chipActive]}>
              <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>
                {p[0].toUpperCase() + p.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Submit Button */}
        <PrimaryButton
          label={editingId ? 'Save Changes' : 'Create Task'}
          onPress={submit}
          loading={saving}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  dateText: { fontSize: 15, color: colors.text, fontWeight: '500' },
  clear: { color: colors.primary, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
});
