import type { Task } from '../types';

/**
 * Client-side productivity analytics.
 * Everything is derived from the task list the user already fetched, so this
 * works offline and updates instantly on every realtime event.
 */

export interface Insights {
  completedToday: number;
  dueToday: number;
  /** 0..1 completion rate over all tasks */
  completionRate: number;
  /** Consecutive days (ending today or yesterday) with >= 1 completion */
  streak: number;
  /** Total completed all-time */
  totalCompleted: number;
  /** Completions per weekday, Monday-first, last 7 days */
  week: { label: string; done: number; total: number }[];
  /** Tasks per category with completion rate */
  categories: { name: string; total: number; done: number }[];
  /** Best hour of day for completions (0-23), or null */
  bestHour: number | null;
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function computeInsights(tasks: Task[], now = new Date()): Insights {
  const today = startOfDay(now).getTime();

  let completedToday = 0;
  let dueToday = 0;
  let totalCompleted = 0;
  const completionDays = new Set<string>();
  const hourBuckets = new Array(24).fill(0) as number[];
  const catMap = new Map<string, { total: number; done: number }>();

  // last 7 days (Monday-first labels filled below)
  const weekCounts = new Array(7).fill(0) as number[];
  const weekTotals = new Array(7).fill(0) as number[];

  for (const t of tasks) {
    const cat = (t.category || 'general').toLowerCase();
    const c = catMap.get(cat) ?? { total: 0, done: 0 };
    c.total++;
    catMap.set(cat, c);

    if (t.status === 'completed') {
      totalCompleted++;
      c.done++;

      if (t.completedAt) {
        const completed = new Date(t.completedAt);
        if (startOfDay(completed).getTime() === today) completedToday++;
        completionDays.add(startOfDay(completed).toDateString());
        hourBuckets[completed.getHours()]++;
        const daysAgo = Math.floor((today - startOfDay(completed).getTime()) / DAY_MS);
        if (daysAgo >= 0 && daysAgo < 7) weekCounts[daysAgo]++;
      }
    }

    if (t.scheduledAt) {
      const sched = new Date(t.scheduledAt);
      if (startOfDay(sched).getTime() === today) {
        dueToday++;
        const daysAgo = Math.floor((today - startOfDay(sched).getTime()) / DAY_MS);
        if (daysAgo >= 0 && daysAgo < 7) weekTotals[daysAgo]++;
      }
    }
  }

  // Streak: walk back from today (or yesterday if nothing yet today).
  let streak = 0;
  let cursor = completionDays.has(new Date(today).toDateString()) ? today : today - DAY_MS;
  while (completionDays.has(new Date(cursor).toDateString())) {
    streak++;
    cursor -= DAY_MS;
  }

  // Weekday labels Monday-first: shift so Monday is index 0.
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dow = now.getDay(); // 0=Sun
  const mondayOffset = (dow + 6) % 7; // days since Monday
  const week = Array.from({ length: 7 }, (_, i) => {
    // index 0 = today, going back (chart shows most recent 7 days)
    const daysAgo = i;
    const d = new Date(today - daysAgo * DAY_MS);
    const label = labels[(d.getDay() + 6) % 7];
    return { label, done: weekCounts[daysAgo], total: weekTotals[daysAgo] };
  });
  void mondayOffset;

  const completed = totalCompleted;
  const bestHour = hourBuckets.some(n => n > 0)
    ? hourBuckets.indexOf(Math.max(...hourBuckets))
    : null;

  return {
    completedToday,
    dueToday,
    completionRate: tasks.length ? completed / tasks.length : 0,
    streak,
    totalCompleted: completed,
    week,
    categories: [...catMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total),
    bestHour,
  };
}

/** Human streak label with a flame for active streaks. */
export function streakLabel(streak: number): string {
  if (streak <= 0) return 'Start a streak today 🔥';
  if (streak === 1) return '1 day streak 🔥';
  return `${streak} day streak 🔥`;
}
