import React from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

export default function MaterialCommunityIcons({
  name,
  size = 16,
  color = '#000000',
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessibilityLabel={name}
      style={[{ fontSize: size, color }, style]}
    />
  );
}
