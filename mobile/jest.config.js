module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^react-native-vector-icons/MaterialCommunityIcons$':
      '<rootDir>/__mocks__/MaterialCommunityIcons.tsx',
  },
  // Transpile navigation/screen packages that ship untranspiled ESM.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-encrypted-storage|@react-native-community/datetimepicker)/)',
  ],
};
