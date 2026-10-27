import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Animated circular completion gauge built with a rotating half-disc trick
 * (no SVG dependency — works everywhere RN runs, including Android/iOS/web).
 * Animates smoothly whenever `progress` changes.
 */
export function ProgressRing({
  progress,
  size = 120,
  stroke = 12,
  accent = colors.primary,
}: {
  progress: number; // 0..1
  size?: number;
  stroke?: number;
  accent?: string;
}) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const rotation = useRef(new Animated.Value(0)).current;
  const flipRef = useRef(false);

  useEffect(() => {
    const target = clamped <= 0.5 ? clamped * 180 : (clamped - 0.5) * 180;
    flipRef.current = clamped > 0.5;
    Animated.timing(rotation, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [clamped, rotation]);

  const half = size / 2;
  const inner = size - stroke * 2;

  return (
    <View style={{ width: size, height: size }}>
      {/* Track ring */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: stroke,
          borderColor: colors.border,
        }}
      />
      {/* First half (right side): a half-circle that rotates 0..180deg from top */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [
            { rotate: '-90deg' },
            {
              rotate: rotation.interpolate({
                inputRange: [0, 180],
                outputRange: ['0deg', '180deg'],
              }),
            },
          ],
          opacity: clamped > 0 ? 1 : 0,
        }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: stroke,
            borderColor: 'transparent',
            borderRightColor: accent,
            borderTopColor: accent,
          }}
        />
      </Animated.View>
      {/* Second half shown only when progress > 50%: overlay disc trick */}
      {clamped > 0.5 ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            transform: [{ rotate: '90deg' }],
          }}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: half,
              borderWidth: stroke,
              borderColor: 'transparent',
              borderRightColor: accent,
              borderTopColor: accent,
            }}
          />
        </View>
      ) : null}
      {/* Center */}
      <View
        style={{
          position: 'absolute',
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: colors.surface,
          top: stroke,
          left: stroke,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <CountUp to={clamped * 100} suffix="%" style={styles.percent} />
        <Text style={styles.centerSub}>completed</Text>
      </View>
    </View>
  );
}

/** Animated count-up number (e.g. 0 -> 87 with optional suffix). */
export function CountUp({
  to,
  duration = 800,
  suffix = '',
  style,
}: {
  to: number;
  duration?: number;
  suffix?: string;
  style?: object;
}) {
  const [display, setDisplay] = React.useState(0);
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listenerId = value.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(value, {
      toValue: to,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => value.removeListener(listenerId);
  }, [to, duration, suffix, value]);

  return (
    <Text style={style}>
      {display}
      {suffix}
    </Text>
  );
}

/**
 * Animated horizontal progress bar (used for weekly goals, category share).
 */
export function AnimatedBar({
  progress,
  color = colors.primary,
  height = 10,
  backgroundColor = colors.border,
}: {
  progress: number; // 0..1
  color?: string;
  height?: number;
  backgroundColor?: string;
}) {
  const width = useRef(new Animated.Value(0)).current;
  const clamped = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    Animated.timing(width, {
      toValue: clamped,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, width]);

  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: width.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}

/** Pulsing "live" dot — shown when realtime sync is connected. */
export function PulseDot({ color = colors.success }: { color?: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseHalo,
          { backgroundColor: color, transform: [{ scale: pulse }], opacity: pulse.interpolate({ inputRange: [1, 1.6], outputRange: [0.4, 0] }) },
        ]}
      />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Weekly completion bar chart: 7 bars (Mon..Sun) that grow in on mount.
 */
export function WeekBarChart({ data }: { data: { label: string; done: number; total: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.done));
  const animations = useRef(
    data.map(() => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const anims = data.map((_, i) =>
      Animated.timing(animations[i], {
        toValue: 1,
        duration: 500,
        delay: i * 60,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: false,
      }),
    );
    Animated.stagger(0, anims).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  return (
    <View style={styles.chartRow}>
      {data.map((d, i) => (
        <View key={d.label} style={styles.chartCol}>
          <View style={styles.chartBarArea}>
            <Animated.View
              style={[
                styles.chartBar,
                {
                  backgroundColor: d.done > 0 ? colors.primary : colors.border,
                  height: animations[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [4, Math.max(8, (d.done / max) * 72)],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.chartLabel}>{d.label}</Text>
          <Text style={styles.chartValue}>{d.done}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  percent: { fontSize: 22, fontWeight: '800', color: colors.text },
  centerSub: { fontSize: 10, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  pulseWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  pulseHalo: { position: 'absolute', width: 12, height: 12, borderRadius: 6 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartCol: { alignItems: 'center', flex: 1 },
  chartBarArea: { height: 76, justifyContent: 'flex-end', width: '60%' },
  chartBar: { borderRadius: 4, width: '100%' },
  chartLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', marginTop: 6 },
  chartValue: { fontSize: 11, color: colors.text, fontWeight: '800' },
});
