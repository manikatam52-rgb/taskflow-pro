import { useMemo, useState } from 'react';
import { isOverdue } from '../components/TaskCard';
import type { Priority, Task, TaskStatus } from '../types';

export type StatusFilter = 'all' | TaskStatus | 'overdue';
export type PriorityFilter = 'all' | Priority;
export type SortOption = 'smart' | 'deadline' | 'priority' | 'newest';

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

/** Deadline timestamp; invalid or missing deadlines sort last. */
const deadlineOf = (t: Task): number => {
  if (!t.deadline) return Infinity;
  const ts = new Date(t.deadline).getTime();
  return Number.isNaN(ts) ? Infinity : ts;
};

const createdOf = (t: Task): number => new Date(t.createdAt).getTime();

/** High priority first, then earliest deadline. */
function byPriority(a: Task, b: Task): number {
  return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || deadlineOf(a) - deadlineOf(b);
}

/** Earliest deadline first, then newest created. */
function byDeadline(a: Task, b: Task): number {
  return deadlineOf(a) - deadlineOf(b) || createdOf(b) - createdOf(a);
}

/** Newest created first. */
function byNewest(a: Task, b: Task): number {
  return createdOf(b) - createdOf(a);
}

/**
 * Mix algorithm for smart sorting:
 * 1. Overdue pending tasks appear at top.
 * 2. Pending tasks sorted by Priority Weight × Time remaining to deadline.
 * 3. Completed tasks move to the bottom.
 */
function smartMix(a: Task, b: Task): number {
  const overdueA = isOverdue(a);
  const overdueB = isOverdue(b);
  if (overdueA !== overdueB) return overdueA ? -1 : 1;

  const prioDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (prioDiff !== 0) return prioDiff;

  return deadlineOf(a) - deadlineOf(b) || createdOf(b) - createdOf(a);
}

const SORT_COMPARATORS: Record<SortOption, (a: Task, b: Task) => number> = {
  smart: smartMix,
  priority: byPriority,
  deadline: byDeadline,
  newest: byNewest,
};

export function sortTasks(tasks: Task[], sortBy: SortOption): Task[] {
  const compare = SORT_COMPARATORS[sortBy];
  return [...tasks].sort((a, b) => {
    // Completed tasks always placed at the bottom
    if ((a.status === 'completed') !== (b.status === 'completed')) {
      return a.status === 'completed' ? 1 : -1;
    }
    return compare(a, b);
  });
}

/**
 * Encapsulates all dashboard filtering and sorting state:
 * status / priority / category filters, free-text search, and sort mode.
 */
export function useTaskFilters(tasks: Task[]) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('smart');
  const resetFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
  };

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

  return {
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
  };
}
