import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { fetchTasks, setTaskStatus, deleteTask } from '../services/taskService';
import { extractErrorMessage } from '../services/api';
import { TaskCard, isOverdue } from '../components/TaskCard';
import { ErrorBanner, StatCard } from '../components/ui';
import { colors, spacing, typography } from '../theme';
import type { Priority, Task, TaskStatus } from '../types';
import type { AppStackParamList } from '../navigation/types';

type StatusFilter = 'all' | TaskStatus | 'overdue';
type PriorityFilter = 'all' | Priority;
type SortOption = 'smart' | 'deadline' | 'priority' | 'newest';

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

/**
 * Mix algorithm for smart sorting:
 * 1. Overdue pending tasks appear at top.
 * 2. Pending tasks sorted by Priority Weight × Time remaining to deadline.
 * 3. Completed tasks move to the bottom.
 */
function sortTasks(tasks: Task[], sortBy: SortOption): Task[] {
  const dl = (t: Task) => (t.deadline ? new Date(t.deadline).getTime() : Infinity);
  const created = (t: Task) => new Date(t.createdAt).getTime();

  return [...tasks].sort((a, b) => {
    // Completed tasks placed at the bottom
    if ((a.status === 'completed') !== (b.status === 'completed')) {
      return a.status === 'completed' ? 1 : -1;
    }

    if (sortBy === 'priority') {
      return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || dl(a) - dl(b);
    }
    if (sortBy === 'deadline') {
      return dl(a) - dl(b) || created(b) - created(a);
    }
    if (sortBy === 'newest') {
      return created(b) - created(a);
    }

    // Smart mix algorithm
    const overdueA = isOverdue(a);
    const overdueB = isOverdue(b);
    if (overdueA !== overdueB) return overdueA ? -1 : 1;

    const prioDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (prioDiff !== 0) return prioDiff;

    return dl(a) - dl(b) || created(b) - created(a);
  });
}

const CATEGORY_CHIPS = ['all', 'work', 'personal', 'shopping', 'health', 'general'];

const PRIORITY_FILTERS: { label: string; value: PriorityFilter }[] = [
  { label: 'Any Priority', value: 'all' },
  { label: '🔥 High', value: 'high' },
  { label: '⚡ Medium', value: 'medium' },
  { label: '🌱 Low', value: 'low' },
];

const SORTS: { label: string; value: SortOption }[] = [
  { label: 'Smart Mix', value: 'smart' },
  { label: 'Deadline', value: 'deadline' },
  { label: 'Priority', value: 'priority' },
  { label: 'Newest', value: 'newest' },
];

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('smart');

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      setTasks(await fetchTasks());
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const counts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let overdue = 0;
    for (const t of tasks) {
      if (t.status === 'completed') completed++;
      else {
        pending++;
        if (isOverdue(t)) overdue++;
      }
    }
    return { total: tasks.length, pending, completed, overdue };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = tasks.filter(t => {
      // Status filter
      if (statusFilter === 'pending' && t.status !== 'pending') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
      if (statusFilter === 'overdue' && !isOverdue(t)) return false;

      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && (t.category || 'general').toLowerCase() !== categoryFilter) {
        return false;
      }

      // Search query (matches title, description, category, or tags)
      if (q) {
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const catMatch = (t.category || '').toLowerCase().includes(q);
        const tagMatch = t.tags ? t.tags.some(tg => tg.toLowerCase().includes(q)) : false;
        if (!titleMatch && !descMatch && !catMatch && !tagMatch) return false;
      }

      return true;
    });

    return sortTasks(filtered, sortBy);
  }, [tasks, statusFilter, priorityFilter, categoryFilter, searchQuery, sortBy]);

  const toggleComplete = async (task: Task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(prev => prev.map(t => (t._id === task._id ? { ...t, status: next } : t)));
    try {
      const updated = await setTaskStatus(task._id, next);
      setTasks(prev => prev.map(t => (t._id === updated._id ? updated : t)));
    } catch (e) {
      setTasks(prev => prev.map(t => (t._id === task._id ? task : t)));
      setError(extractErrorMessage(e));
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(id);
            setTasks(prev => prev.filter(t => t._id !== id));
          } catch (e) {
            setError(extractErrorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.title}>TaskFlow Pro</Text>
            <Text style={typography.secondary}>
              Welcome back, {user?.name || 'User'}!
            </Text>
          </View>
          <Pressable onPress={() => logout()} hitSlop={10}>
            <Text style={styles.logout}>Logout</Text>
          </Pressable>
        </View>

        {/* Visual Summary Stat Cards */}
        <View style={styles.statsRow}>
          <StatCard
            label="Total"
            count={counts.total}
            color={colors.primary}
            bgColor={colors.primaryLight}
            active={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
          />
          <StatCard
            label="Pending"
            count={counts.pending}
            color={colors.warning}
            bgColor={colors.warningLight}
            active={statusFilter === 'pending'}
            onPress={() => setStatusFilter('pending')}
          />
          <StatCard
            label="Completed"
            count={counts.completed}
            color={colors.success}
            bgColor={colors.successLight}
            active={statusFilter === 'completed'}
            onPress={() => setStatusFilter('completed')}
          />
          <StatCard
            label="Overdue"
            count={counts.overdue}
            color={colors.error}
            bgColor={colors.errorLight}
            active={statusFilter === 'overdue'}
            onPress={() => setStatusFilter('overdue')}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search tasks, categories, or tags..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Category Horizontal Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}>
          {CATEGORY_CHIPS.map(cat => {
            const active = categoryFilter === cat;
            const label = cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1);
            return (
              <Pressable
                key={cat}
                onPress={() => setCategoryFilter(cat)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Priority Filter & Sorting Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}>
          {PRIORITY_FILTERS.map(pf => {
            const active = priorityFilter === pf.value;
            return (
              <Pressable
                key={pf.value}
                onPress={() => setPriorityFilter(pf.value)}
                style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {pf.label}
                </Text>
              </Pressable>
            );
          })}

          <View style={styles.divider} />

          {SORTS.map(s => {
            const active = sortBy === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setSortBy(s.value)}
                style={[styles.chip, active && styles.chipSortActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  ↕ {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ErrorBanner message={error} />

      {/* Task List */}
      {loading ? (
        <ActivityIndicator style={styles.center} size="large" color={colors.primary} />
      ) : visibleTasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={typography.heading}>No Tasks Found</Text>
          <Text style={[typography.secondary, { textAlign: 'center', marginTop: 4 }]}>
            {tasks.length === 0
              ? 'Tap "+ New Task" below to create your first task.'
              : 'No tasks match your selected filters or search query.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleTasks}
          keyExtractor={t => t._id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onPress={() => navigation.navigate('TaskDetails', { taskId: item._id })}
              onToggleComplete={() => toggleComplete(item)}
              onLongPress={() => confirmDelete(item._id)}
            />
          )}
        />
      )}

      {/* Floating Action Button (+ New Task) */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => navigation.navigate('TaskForm', {})}>
        <Text style={styles.fabText}>+ New Task</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.xs, backgroundColor: colors.surface },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logout: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  searchWrap: { marginTop: spacing.xs, marginBottom: spacing.xs },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  chipScroll: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs, alignItems: 'center' },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipSortActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  divider: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 4 },
  listContainer: { padding: spacing.lg, paddingBottom: 90 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
