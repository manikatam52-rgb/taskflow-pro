declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import type React from 'react';
  import type { StyleProp, TextStyle } from 'react-native';

  const MaterialCommunityIcons: React.ComponentType<{
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
  }>;

  export default MaterialCommunityIcons;
}
