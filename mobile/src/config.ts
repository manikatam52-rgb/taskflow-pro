import {Platform} from 'react-native';

/**
 * Central app configuration.
 * Defaults to `localhost` (works for physical Android devices with `adb reverse tcp:5000 tcp:5000` and iOS simulator).
 */
export const API_BASE_URL = 'http://localhost:5000/api';
