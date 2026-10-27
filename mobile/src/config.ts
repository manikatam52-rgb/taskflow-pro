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
const DEV_LAN_IP = '10.12.216.198'; // Change to your active Wi-Fi IPv4 address for physical devices.
const PRODUCTION_API_URL = 'https://taskflow-pro-api.onrender.com/api';

// Optional explicit override for the WebSocket base (defaults derive from API base).

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
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }
  if (Platform.OS === 'android') {
    const isEmulator =
      (Platform.constants as {isEmulator?: boolean} | undefined)?.isEmulator ===
      true;
    return isEmulator ? ANDROID_EMULATOR_URL : ANDROID_DEVICE_URL;
  }
  return IOS_SIMULATOR_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

/** WebSocket base for realtime sync: http://host:port/api -> ws://host:port */
export const WS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '').replace(/^http/, 'ws');
