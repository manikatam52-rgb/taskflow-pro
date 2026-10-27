import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressRing, AnimatedBar, WeekBarChart, CountUp } from './Animated';
import { colors, spacing, shadows } from '../theme';
import { computeInsights, streakLabel } from '../utils/insights';
import type { Task } from '../types';

export type Insights = ReturnType<typeof computeInsights>;

interface InsightsCardProps {
  insights: Insights;
  onHide: () => void;
  tasks: Task[];
}

/** Productivity insights card: progress ring, streak, weekly chart, categories. */
export function InsightsCard({ insights, onHide, tasks }: InsightsCardProps) {
  return (
    <View style={[styles.insightsCard, shadows.md]}>
      <View style={styles.insightsHeader}>
        <Text style={styles.insightsTitle}>📊 Your Productivity</Text>
        <Pressable onPress={onHide} hitSlop={8}>
          <Text style={styles.insightsHide}>Hide</Text>
        </Pressable>
      </View>

      <View style={styles.insightsTop}>
        <ProgressRing progress={insights.completionRate} size={116} stroke={11} />
        <View style={{ flex: 1, gap: 10 }}>
          <View>
            <Text style={styles.bigStat}>
              <CountUp to={insights.completedToday} /> <Text style={styles.bigStatSub}>done today</Text>
            </Text>
          </View>
          <View>
            <Text style={styles.mediumStat}>📅 {insights.dueToday} scheduled today</Text>
          </View>
          <View>
            <Text style={styles.mediumStat}>{streakLabel(insights.streak)}</Text>
          </View>
          {insights.bestHour !== null ? (
            <Text style={styles.smallStat}>
              🕐 Most productive around{' '}
              {insights.bestHour === 0 ? '12 AM' : insights.bestHour < 12 ? `${insights.bestHour} AM` : insights.bestHour === 12 ? '12 PM' : `${insights.bestHour - 12} PM`}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.chartTitle}>Last 7 days</Text>
      <WeekBarChart data={insights.week} />

      <Text style={styles.chartTitle}>By category</Text>
      {insights.categories.slice(0, 4).map(c => (
        <View key={c.name} style={styles.catRow}>
          <Text style={styles.catLabel}>
            {c.name.charAt(0).toUpperCase() + c.name.slice(1)} ({c.done}/{c.total})
          </Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <AnimatedBar progress={c.total ? c.done / c.total : 0} />
          </View>
        </View>
      ))}
      {tasks.length === 0 ? (
        <Text style={styles.emptyInsights}>Create tasks to unlock insights ✨</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
