import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { fetchTasks, setTaskStatus, deleteTask } from '../services/taskService';
import { extractErrorMessage } from '../services/api';
import {
  subscribeToTaskEvents,
  type RealtimeEvent,
} from '../services/realtime';
import { TaskCard, isOverdue } from '../components/TaskCard';
import { ErrorBanner, StatCard } from '../components/ui';
import { PulseDot } from '../components/Animated';
import { colors, spacing, typography, shadows } from '../theme';
import { computeInsights } from '../utils/insights';
import {
  useTaskFilters,
  type PriorityFilter,
  type SortOption,
} from '../hooks/useTaskFilters';
import { InsightsCard } from '../components/InsightsCard';
import type { Task } from '../types';
import type { AppStackParamList } from '../navigation/types';

const CATEGORY_CHIPS = [
  'all',
  'work',
  'personal',
  'shopping',
  'health',
  'general',
] as const;

const PRIORITY_FILTERS = [
  { label: 'Any Priority', value: 'all' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
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
        Animated.timing(anim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
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
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
        },
      ]}
    >
      <PulseDot />
      <Text style={styles.syncToastText}>{message}</Text>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { logout, user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const hasLoadedTasks = useRef(false);

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
    if (isRefresh) setRefreshing(true);
    else if (!hasLoadedTasks.current) setLoading(true);
    setError(null);
    try {
      setTasks(await fetchTasks());
      hasLoadedTasks.current = true;
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
        setTasks(prev =>
          prev.some(p => p._id === t._id) ? prev : [t, ...prev],
        );
        setSyncMessage(`📱 New: "${t.title}"`);
      } else if (event.type === 'task.updated' && event.task) {
        const t = event.task;
        setTasks(prev => prev.map(p => (p._id === t._id ? t : p)));
        setSyncMessage(
          t.status === 'completed'
            ? `✅ Completed: "${t.title}"`
            : `✏️ Updated: "${t.title}"`,
        );
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
  const selectedFilterCount =
    Number(categoryFilter !== 'all') + Number(priorityFilter !== 'all');

  const toggleComplete = useCallback(async (task: Task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    setTasks(prev =>
      prev.map(t => (t._id === task._id ? { ...t, status: next } : t)),
    );
    try {
      const updated = await setTaskStatus(task._id, next);
      setTasks(prev => prev.map(t => (t._id === updated._id ? updated : t)));
    } catch (e) {
      setTasks(prev => prev.map(t => (t._id === task._id ? task : t)));
      setError(extractErrorMessage(e));
    }
  }, []);

  const confirmDelete = useCallback((id: string) => {
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
  }, []);

  const renderTask = useCallback(
    ({ item }: { item: Task }) => (
      <TaskCard
        task={item}
        onPress={() => navigation.navigate('TaskDetails', { taskId: item._id })}
        onToggleComplete={() => toggleComplete(item)}
        onLongPress={() => confirmDelete(item._id)}
      />
    ),
    [confirmDelete, navigation, toggleComplete],
  );

  return (
    <View style={styles.flex}>
      <SyncToast message={syncMessage} />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={typography.title}>TaskFlow</Text>
              <View style={styles.liveBadge}>
                <PulseDot color={live ? colors.success : colors.textMuted} />
                <Text
                  style={[
                    styles.liveText,
                    { color: live ? colors.success : colors.textMuted },
                  ]}
                >
                  {live ? 'Live sync' : 'Offline'}
                </Text>
              </View>
            </View>
            <Text style={typography.secondary}>
              Welcome back, {user?.name || 'there'}.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={logout}
            hitSlop={10}
            style={styles.logoutButton}
          >
            <MaterialCommunityIcons
              name="logout-variant"
              size={17}
              color={colors.textSecondary}
            />
            <Text style={styles.logout}>Log out</Text>
          </Pressable>
        </View>

        {/* Visual Summary Stat Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statsRow}
        >
          <StatCard
            style={styles.statItem}
            label="Total"
            count={counts.total}
            color={colors.primary}
            bgColor={colors.primaryLight}
            active={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
          />
          <StatCard
            style={styles.statItem}
            label="Pending"
            count={counts.pending}
            color={colors.warning}
            bgColor={colors.warningLight}
            active={statusFilter === 'pending'}
            onPress={() => setStatusFilter('pending')}
          />
          <StatCard
            style={styles.statItem}
            label="Completed"
            count={counts.completed}
            color={colors.success}
            bgColor={colors.successLight}
            active={statusFilter === 'completed'}
            onPress={() => setStatusFilter('completed')}
          />
          <StatCard
            style={styles.statItem}
            label="Overdue"
            count={counts.overdue}
            color={colors.error}
            bgColor={colors.errorLight}
            active={statusFilter === 'overdue'}
            onPress={() => setStatusFilter('overdue')}
          />
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your tasks"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search tasks"
          />
          {searchQuery ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearchQuery('')}
              hitSlop={8}
              style={styles.clearSearch}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={19}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowFilters(true)}
            style={({ pressed }) => [
              styles.filterButton,
              pressed && styles.filterButtonPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={18}
              color={colors.primary}
            />
            <Text style={styles.filterButtonText}>Filters</Text>
            {selectedFilterCount > 0 ? (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>
                  {selectedFilterCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <View style={styles.sortSummary}>
            <MaterialCommunityIcons
              name="sort"
              size={17}
              color={colors.textMuted}
            />
            <Text style={styles.sortSummaryText}>
              {SORTS.find(item => item.value === sortBy)?.label}
            </Text>
          </View>
        </View>
      </View>

      <ErrorBanner message={error} />

      <View style={styles.listSectionHeader}>
        <Text style={styles.listSectionTitle}>Your tasks</Text>
        <Text style={styles.listSectionCount}>
          {visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'}
        </Text>
      </View>

      {/* Task List */}
      {loading ? (
        <ActivityIndicator
          style={styles.center}
          size="large"
          color={colors.primary}
        />
      ) : visibleTasks.length === 0 ? (
        <View style={styles.center}>
          <Text style={typography.heading}>No Tasks Found</Text>
          <Text
            style={[
              typography.secondary,
              { textAlign: 'center', marginTop: 4 },
            ]}
          >
            {tasks.length === 0
              ? 'Tap "+ New Task" below to create your first task.'
              : 'No tasks match your selected filters or search query.'}
          </Text>
          {tasks.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={resetFilters}
              style={styles.clearFiltersButton}
            >
              <Text style={styles.clearFiltersText}>
                Clear filters and search
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={visibleTasks}
          keyExtractor={t => t._id}
          renderItem={renderTask}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
            />
          }
          ListHeaderComponent={
            showInsights ? (
              <InsightsCard
                insights={insights}
                onHide={() => setShowInsights(false)}
                tasks={tasks}
              />
            ) : (
              <Pressable
                onPress={() => setShowInsights(true)}
                style={styles.showInsightsBtn}
              >
                <View style={styles.showInsightsRow}>
                  <MaterialCommunityIcons
                    name="chart-box-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.showInsightsText}>
                    Show productivity insights
                  </Text>
                </View>
              </Pressable>
            )
          }
        />
      )}

      {/* Floating Action Button (+ New Task) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a new task"
        style={({ pressed }) => [
          styles.fab,
          { transform: [{ scale: pressed ? 0.93 : 1 }] },
        ]}
        onPress={() => navigation.navigate('TaskForm', {})}
      >
        <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
        <Text style={styles.fabText}>New task</Text>
      </Pressable>

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalScrim}
            onPress={() => setShowFilters(false)}
            accessibilityLabel="Close filters"
          />
          <View style={styles.filterSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View>
                <Text style={styles.sheetTitle}>Refine your list</Text>
                <Text style={styles.sheetSubtitle}>
                  Choose a category, priority, and order.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={() => setShowFilters(false)}
                hitSlop={10}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={styles.sheetLabel}>CATEGORY</Text>
              <View style={styles.sheetOptions}>
                {CATEGORY_CHIPS.map(category => {
                  const active = categoryFilter === category;
                  return (
                    <Pressable
                      key={category}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setCategoryFilter(category)}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {category === 'all'
                          ? 'All categories'
                          : category[0].toUpperCase() + category.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.sheetLabel}>PRIORITY</Text>
              <View style={styles.sheetOptions}>
                {PRIORITY_FILTERS.map(option => {
                  const active = priorityFilter === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setPriorityFilter(option.value)}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.sheetLabel}>SORT BY</Text>
              <View style={styles.sheetOptions}>
                {SORTS.map(option => {
                  const active = sortBy === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSortBy(option.value)}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          active && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.sheetFooter}>
              <Pressable
                accessibilityRole="button"
                onPress={resetFilters}
                style={styles.resetButton}
              >
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowFilters(false)}
                style={styles.applyButton}
              >
                <Text style={styles.applyText}>
                  Show {visibleTasks.length} tasks
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoutButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
  },
  logout: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  listSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  listSectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: 1,
  },
  statItem: { width: 76, flex: 0 },
  searchWrap: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    position: 'relative',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingLeft: 44,
    paddingRight: spacing.lg,
    paddingVertical: 13,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#F8FAFC',
    minHeight: 50,
  },
  searchIcon: { position: 'absolute', left: spacing.md, top: 15, zIndex: 1 },
  clearSearch: { position: 'absolute', right: spacing.md, top: 15, zIndex: 1 },
  chipScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  filterButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterButtonPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  filterButtonText: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  filterCount: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  sortSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  sortSummaryText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipSortActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 104,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
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
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  filterSheet: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  sheetSubtitle: { marginTop: 4, fontSize: 13, color: colors.textSecondary },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: { paddingBottom: spacing.md },
  sheetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sheetOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  optionChip: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  optionTextActive: { color: '#FFFFFF', fontWeight: '700' },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  resetText: { color: colors.textSecondary, fontWeight: '700', fontSize: 14 },
  applyButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.primary,
  },
  applyText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
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
  insightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  insightsTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  insightsHide: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  insightsTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bigStat: { fontSize: 28, fontWeight: '800', color: colors.text },
  bigStatSub: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  mediumStat: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  smallStat: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  chartTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  catLabel: {
    width: 110,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptyInsights: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  showInsightsBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  showInsightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  showInsightsText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
