import { urgencyScore } from "../services/taskService";
import type { Priority, TaskStatus } from "../models/Task";

/**
 * Urgency score rules (documented in docs/ARCHITECTURE.md):
 * - completed tasks: -1000 (always last)
 * - overdue pending: 1000 + priorityWeight  (always first)
 * - with deadline:   100 - clamp(hoursLeft, 0..100) + priorityWeight
 * - no deadline:     10 + priorityWeight
 * priorityWeight: high=30, medium=20, low=10
 */
const now = Date.now();
const H = 3_600_000;

function make(status: TaskStatus, priority: Priority, deadline: Date | null) {
  return { status, priority, deadline };
}

describe("urgencyScore", () => {
  it("ranks overdue pending tasks above everything pending", () => {
    const overdue = urgencyScore(make("pending", "low", new Date(now - 24 * H)));
    const futureHigh = urgencyScore(make("pending", "high", new Date(now + 30 * H)));
    expect(overdue).toBeGreaterThan(futureHigh);
  });

  it("never classifies completed tasks as overdue", () => {
    // A completed task with a long-past deadline still scores -1000.
    expect(urgencyScore(make("completed", "high", new Date(now - 30 * 24 * H)))).toBe(-1000);
    expect(urgencyScore(make("completed", "high", null))).toBe(-1000);
  });

  it("ranks higher priority above lower priority for identical deadlines", () => {
    const dl = new Date(now + 10 * H);
    expect(urgencyScore(make("pending", "high", dl))).toBeGreaterThan(
      urgencyScore(make("pending", "medium", dl))
    );
    expect(urgencyScore(make("pending", "medium", dl))).toBeGreaterThan(
      urgencyScore(make("pending", "low", dl))
    );
  });

  it("ranks nearer deadlines above farther ones within the same priority", () => {
    expect(urgencyScore(make("pending", "medium", new Date(now + 2 * H)))).toBeGreaterThan(
      urgencyScore(make("pending", "medium", new Date(now + 50 * H)))
    );
  });

  it("handles tasks without deadlines without crashing", () => {
    const score = urgencyScore(make("pending", "high", null));
    expect(score).toBe(40); // 10 + 30
    expect(urgencyScore(make("pending", "low", null))).toBe(20); // 10 + 10
  });

  it("places no-deadline tasks below deadline tasks at equal priority", () => {
    // high + no deadline = 40; any non-overdue deadline task scores >= 100 + 10 > 40.
    expect(urgencyScore(make("pending", "low", new Date(now + 1 * H)))).toBeGreaterThan(
      urgencyScore(make("pending", "high", null))
    );
  });

  it("clamps very distant deadlines so overdue still outranks them", () => {
    const distant = urgencyScore(make("pending", "high", new Date(now + 500 * H)));
    const overdue = urgencyScore(make("pending", "low", new Date(now - 1 * H)));
    expect(overdue).toBeGreaterThan(distant);
  });
});

describe("task ordering (realistic set)", () => {
  const tasks = [
    make("completed", "high", new Date(now + 1 * H)), // completed
    make("pending", "low", new Date(now + 40 * H)), // future low
    make("pending", "high", new Date(now + 2 * H)), // soon high
    make("pending", "medium", new Date(now - 1 * H)), // overdue medium
    make("pending", "high", null), // no deadline
  ];

  it("orders overdue > soon-high > future-low > no-deadline > completed", () => {
    const sorted = [...tasks].sort((a, b) => urgencyScore(b) - urgencyScore(a));
    expect(sorted.map((t) => t.status)).toEqual([
      "pending", // overdue medium
      "pending", // soon high
      "pending", // future low
      "pending", // no deadline high (40)
      "completed",
    ]);
    expect(sorted[0].priority).toBe("medium");
    expect(sorted[1].priority).toBe("high");
    expect(sorted[sorted.length - 1].status).toBe("completed");
  });
});
