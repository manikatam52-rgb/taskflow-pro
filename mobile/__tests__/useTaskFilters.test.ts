import { sortTasks } from '../src/hooks/useTaskFilters';
import type { Task } from '../src/types';

// isOverdue compares deadline against "now"; use fixed dates around a fixed
// reference so tests stay deterministic regardless of when they run.
const NOW = new Date('2026-01-15T12:00:00Z');
const past = '2026-01-10T00:00:00Z';
const future = '2026-01-20T00:00:00Z';

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    _id: overrides.id,
    title: `Task ${overrides.id}`,
    status: 'pending',
    priority: 'medium',
    category: 'general',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Task;
}

describe('sortTasks', () => {
  it('sorts by priority (high first) then deadline', () => {
    const tasks = [
      makeTask({ id: 'a', priority: 'low' }),
      makeTask({ id: 'b', priority: 'high' }),
      makeTask({ id: 'c', priority: 'medium' }),
    ];
    const sorted = sortTasks(tasks, 'priority');
    expect(sorted.map(t => t._id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by deadline (earliest first) breaking ties by newest created', () => {
    const tasks = [
      makeTask({ id: 'late', deadline: future }),
      makeTask({ id: 'soon', deadline: past }),
      makeTask({ id: 'none' }),
      makeTask({ id: 'none-newer', createdAt: '2026-01-02T00:00:00Z' }),
    ];
    const sorted = sortTasks(tasks, 'deadline');
    expect(sorted.map(t => t._id)).toEqual(['soon', 'late', 'none-newer', 'none']);
  });

  it('sorts by newest created first', () => {
    const tasks = [
      makeTask({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
      makeTask({ id: 'new', createdAt: '2026-01-05T00:00:00Z' }),
      makeTask({ id: 'mid', createdAt: '2026-01-03T00:00:00Z' }),
    ];
    const sorted = sortTasks(tasks, 'newest');
    expect(sorted.map(t => t._id)).toEqual(['new', 'mid', 'old']);
  });

  it('smart mode puts overdue first, then higher priority', () => {
    const tasks = [
      makeTask({ id: 'ok-high', priority: 'high', deadline: future }),
      makeTask({ id: 'overdue-low', priority: 'low', deadline: past }),
      makeTask({ id: 'ok-low', priority: 'low', deadline: future }),
    ];
    const sorted = sortTasks(tasks, 'smart');
    expect(sorted.map(t => t._id)).toEqual(['overdue-low', 'ok-high', 'ok-low']);
  });

  it('always places completed tasks at the bottom in every sort mode', () => {
    const tasks = [
      makeTask({ id: 'done-high', status: 'completed', priority: 'high', deadline: past }),
      makeTask({ id: 'pending-low', priority: 'low' }),
    ];
    for (const sortBy of ['smart', 'deadline', 'priority', 'newest'] as const) {
      const sorted = sortTasks(tasks, sortBy);
      expect(sorted[sorted.length - 1]._id).toBe('done-high');
    }
  });

  it('treats tasks without deadlines as last within their priority tier', () => {
    const tasks = [
      makeTask({ id: 'no-deadline' }),
      makeTask({ id: 'with-deadline', deadline: future }),
    ];
    const sorted = sortTasks(tasks, 'deadline');
    expect(sorted[0]._id).toBe('with-deadline');
    expect(sorted[1]._id).toBe('no-deadline');
  });

  it('treats invalid deadline strings the same as missing deadlines', () => {
    const tasks = [
      makeTask({ id: 'bad-deadline', deadline: 'not-a-date' }),
      makeTask({ id: 'no-deadline' }),
      makeTask({ id: 'real-deadline', deadline: future }),
    ];
    const sorted = sortTasks(tasks, 'deadline');
    expect(sorted.map(t => t._id)).toEqual(['real-deadline', 'bad-deadline', 'no-deadline']);
  });

  it('does not mutate the input array', () => {
    const tasks = [makeTask({ id: 'b' }), makeTask({ id: 'a', createdAt: '2026-01-05T00:00:00Z' })];
    const copy = [...tasks];
    sortTasks(tasks, 'newest');
    expect(tasks).toEqual(copy);
  });
});
