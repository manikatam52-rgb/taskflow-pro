import {Platform} from 'react-native';

/**
 * Central app configuration.
 *
 * The API base URL is resolved per platform so the app works everywhere:
 * 1. ANDROID_API_BASE_URL / IOS_API_BASE_URL env override (set with
 *    `ANDROID_API_BASE_URL=http://192.168.1.20:5000/api npm run android` or via
 *    .env + react-native-config style tooling) always wins.
 * 2. Android emulator -> `http://10.0.2.2:5000` (host loopback alias).
 * 3. iOS simulator -> `http://localhost:5000` (same machine as backend).
 * 4. Physical device (default) -> the LAN IP of your dev machine, which you can
 *    also override at build time. `adb reverse tcp:5000 tcp:5000` also works if
 *    you keep the localhost fallback.
 */
const DEV_LAN_IP = '192.168.1.5'; // <-- change to your PC's LAN IP (ipconfig) for physical devices

const ANDROID_EMULATOR_URL = 'http://10.0.2.2:5000/api';
const IOS_SIMULATOR_URL = 'http://localhost:5000/api';
const ANDROID_DEVICE_URL = `http://${DEV_LAN_IP}:5000/api`;
const IOS_DEVICE_URL = `http://${DEV_LAN_IP}:5000/api`;

function resolveApiBaseUrl(): string {
  const override =
    (process.env.ANDROID_API_BASE_URL as string | undefined) ||
    (process.env.API_BASE_URL as string | undefined);
  if (override) {
    return override;
  }
  if (Platform.OS === 'android') {
    return Platform.constants?.isEmulator === true
      ? ANDROID_EMULATOR_URL
      : ANDROID_DEVICE_URL;
  }
  return __DEV__ ? IOS_SIMULATOR_URL : IOS_DEVICE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();
