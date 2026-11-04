import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../theme';

/** Small task-list glyph used as the TaskFlow app mark. */
export function TaskFlowMark({
  size = 60,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = size / 60;
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.32 },
        style,
      ]}
      accessibilityLabel="TaskFlow logo"
    >
      <View style={styles.markRows}>
        {[0, 1, 2].map((row, index) => (
          <View key={row} style={styles.markRow}>
            <View
              style={[
                styles.markCheck,
                {
                  width: 11 * scale,
                  height: 11 * scale,
                  borderRadius: 3 * scale,
                },
                index === 0 && styles.markCheckActive,
              ]}
            >
              {index === 0 ? (
                <MaterialCommunityIcons
                  name="check"
                  size={8 * scale}
                  color={colors.primaryDark}
                />
              ) : null}
            </View>
            <View
              style={[
                styles.markLine,
                {
                  width: (index === 1 ? 19 : 25) * scale,
                  height: 4 * scale,
                  borderRadius: 3 * scale,
                },
                index === 0 && styles.markLineActive,
              ]}
            />
          </View>
        ))}
      </View>
      <View
        style={[
          styles.markAccent,
          { width: 8 * scale, height: 8 * scale, borderRadius: 4 * scale },
        ]}
      />
    </View>
  );
}

/** Quiet animated color and task-detail accents behind the auth form. */
export function AuthAtmosphere() {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 3600,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 3600,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift]);

  const float = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.orbTopLeft} />
      <Animated.View
        style={[styles.orbTopRight, { transform: [{ translateY: float }] }]}
      />
      <Animated.View
        style={[
          styles.floatTile,
          styles.tileLeft,
          { transform: [{ translateY: float }] },
        ]}
      >
        <MaterialCommunityIcons
          name="calendar-check-outline"
          size={19}
          color={colors.primary}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.floatTile,
          styles.tileRight,
          { transform: [{ translateY: Animated.multiply(float, -0.7) }] },
        ]}
      >
        <MaterialCommunityIcons
          name="progress-check"
          size={20}
          color="#0F9F8F"
        />
      </Animated.View>
      <View style={styles.sparkleOne} />
      <View style={styles.sparkleTwo} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  markRows: { gap: 4, transform: [{ translateX: -2 }] },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  markCheck: {
    backgroundColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCheckActive: { backgroundColor: '#FFFFFF' },
  markLine: { backgroundColor: 'rgba(255,255,255,0.68)' },
  markLineActive: { backgroundColor: '#FFFFFF' },
  markAccent: {
    position: 'absolute',
    right: 11,
    bottom: 11,
    backgroundColor: '#57E2C2',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  orbTopLeft: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -120,
    left: -105,
    backgroundColor: '#E4E8FF',
    opacity: 0.82,
  },
  orbTopRight: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: 78,
    right: -112,
    backgroundColor: '#DDF6F0',
    opacity: 0.72,
  },
  floatTile: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    shadowColor: '#172554',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  tileLeft: { top: 158, left: '13%' },
  tileRight: { top: 128, right: '13%' },
  sparkleOne: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    top: 112,
    left: '27%',
    backgroundColor: '#57E2C2',
  },
  sparkleTwo: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
    top: 195,
    right: '25%',
    backgroundColor: '#A7B0FF',
  },
});
