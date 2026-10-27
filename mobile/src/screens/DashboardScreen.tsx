import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { subscribeToTaskEvents, type RealtimeEvent } from '../services/realtime';
import { TaskCard, isOverdue } from '../components/TaskCard';
import { ErrorBanner, StatCard } from '../components/ui';
import { PulseDot } from '../components/Animated';
import { colors, spacing, typography, shadows } from '../theme';
import { computeInsights } from '../utils/insights';
import { useTaskFilters, type PriorityFilter, type SortOption } from '../hooks/useTaskFilters';
import { InsightsCard } from '../components/InsightsCard';
import type { Task } from '../types';
import type { AppStackParamList } from '../navigation/types';

const CATEGORY_CHIPS = ['all', 'work', 'personal', 'shopping', 'health', 'general'] as const;

const PRIORITY_FILTERS = [
  { label: 'Any Priority', value: 'all' },
  { label: '🔥 High', value: 'high' },
  { label: '⚡ Medium', value: 'medium' },
  { label: '🌱 Low', value: 'low' },
] as const satisfies ReadonlyArray<{ label: string; value: PriorityFilter }>;

const SORTS = [
  { label: 'Smart Mix', value: 'smart' },
  { label: 'Deadline', value: 'deadline' },
  { label: 'Priority', value: 'priority' },
  { label: 'Newest', value: 'newest' },
] as const satisfies ReadonlyArray<{ label: string; value: SortOption }>;

/** Toast that fades/scales in when another device changes a task. */
function SyncToast({ message }: { message: string | null }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (message) {
      const animation = Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 250, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]);
      animation.start();
      return () => {
        animation.stop();
        anim.setValue(0);
      };
    }
  }, [message, anim]);
  if (!message) return null;
  return (
    <Animated.View
      style={[
        styles.syncToast,
        shadows.md,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}>
      <PulseDot />
      <Text style={styles.syncToastText}>{message}</Text>
    </Animated.View>
  );
}

/** Card that fades + slides in when the list renders. */
function AnimatedTaskItem({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
        ],
      }}>
      {children}
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);

  const {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    resetFilters,
    visibleTasks,
  } = useTaskFilters(tasks);

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

  /* ---- Realtime sync: other devices' mutations arrive over WebSocket ---- */
  useEffect(() => {
    const unsubscribe = subscribeToTaskEvents((event: RealtimeEvent) => {
      if (event.type === 'connected') {
        setLive(true);
        return;
      }
      if (event.type === 'task.created' && event.task) {
        const t = event.task;
        setTasks(prev => (prev.some(p => p._id === t._id) ? prev : [t, ...prev]));
        setSyncMessage(`📱 New: "${t.title}"`);
      } else if (event.type === 'task.updated' && event.task) {
        const t = event.task;
        setTasks(prev => prev.map(p => (p._id === t._id ? t : p)));
        setSyncMessage(t.status === 'completed' ? `✅ Completed: "${t.title}"` : `✏️ Updated: "${t.title}"`);
      } else if (event.type === 'task.deleted' && event.id) {
        setTasks(prev => prev.filter(p => p._id !== event.id));
        setSyncMessage('🗑️ A task was deleted');
      }
    });
    return () => {
      unsubscribe();
      setLive(false);
    };
  }, []);

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

  const insights = useMemo(() => computeInsights(tasks), [tasks]);

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
      <SyncToast message={syncMessage} />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={typography.title}>TaskFlow Pro</Text>
              <View style={styles.liveBadge}>
                <PulseDot color={live ? colors.success : colors.textMuted} />
                <Text style={[styles.liveText, { color: live ? colors.success : colors.textMuted }]}>
                  {live ? 'Live sync' : 'Offline'}
                </Text>
              </View>
            </View>
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
                style={({ pressed }) => [styles.chip, active && styles.chipActive, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}>
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
          {tasks.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={resetFilters}
              style={styles.clearFiltersButton}>
              <Text style={styles.clearFiltersText}>Clear filters and search</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={visibleTasks}
          keyExtractor={t => t._id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={
            showInsights ? (
              <InsightsCard
                insights={insights}
                onHide={() => setShowInsights(false)}
                tasks={tasks}
              />
            ) : (
              <Pressable onPress={() => setShowInsights(true)} style={styles.showInsightsBtn}>
                <Text style={styles.showInsightsText}>📊 Show productivity insights</Text>
              </Pressable>
            )
          }
          renderItem={({ item }) => (
            <AnimatedTaskItem>
              <TaskCard
                task={item}
                onPress={() => navigation.navigate('TaskDetails', { taskId: item._id })}
                onToggleComplete={() => toggleComplete(item)}
                onLongPress={() => confirmDelete(item._id)}
              />
            </AnimatedTaskItem>
          )}
        />
      )}

      {/* Floating Action Button (+ New Task) */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { transform: [{ scale: pressed ? 0.93 : 1 }] },
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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveText: { fontSize: 10, fontWeight: '800' },
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
  clearFiltersButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  clearFiltersText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
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
  syncToast: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  syncToastText: { fontSize: 12, fontWeight: '700', color: colors.text },
  insightsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  insightsTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  insightsHide: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  insightsTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bigStat: { fontSize: 28, fontWeight: '800', color: colors.text },
  bigStatSub: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  mediumStat: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  smallStat: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  chartTitle: { fontSize: 12, fontWeight: '800', color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  catLabel: { width: 110, fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  emptyInsights: { marginTop: spacing.md, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  showInsightsBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  showInsightsText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
