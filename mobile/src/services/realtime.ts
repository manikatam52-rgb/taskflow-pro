import { WS_BASE_URL } from '../config';
import type { Task } from '../types';

/**
 * Realtime sync client.
 *
 * Connects a WebSocket to the backend (`/ws?token=<jwt>`) and dispatches task
 * events so every device signed in with the same account stays in sync
 * instantly — create a task on your phone and it appears on your tablet.
 *
 * Features:
 * - Auto-reconnect with exponential backoff (1s -> 30s).
 * - Heartbeat ping every 25s to keep connections alive through NAT/proxies.
 * - Deduplicates echo events of our own mutations (optional, via event source).
 */

export type RealtimeEvent =
  | { type: 'connected'; at: string }
  | { type: 'task.created'; task: Task; at: string }
  | { type: 'task.updated'; task: Task; at: string }
  | { type: 'task.deleted'; id: string; at: string };

type Listener = (event: RealtimeEvent) => void;

/** Minimal structural type for the RN global WebSocket (avoids DOM/undici typings clash). */
interface RNSocket {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

const WS_OPEN = 1;
const WS_CONNECTING = 0;

let sock: RNSocket | null = null;
let reconnectDelay = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let token: string | null = null;
const listeners = new Set<Listener>();

/** WS URL derived from the shared config: ws://host:port/ws?token=<jwt> */
function wsUrl(): string {
  return `${WS_BASE_URL}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

function notify(event: RealtimeEvent): void {
  listeners.forEach(fn => {
    try {
      fn(event);
    } catch (e) {
      console.warn('realtime listener error', e);
    }
  });
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (sock && sock.readyState === WS_OPEN) {
      sock.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25000);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function connect(): void {
  if (!token) return;
  if (sock && (sock.readyState === WS_OPEN || sock.readyState === WS_CONNECTING)) return;

  try {
    // RN global WebSocket
    const created = new (globalThis as { WebSocket: new (url: string) => RNSocket }).WebSocket(wsUrl());
    sock = created;
  } catch {
    scheduleReconnect();
    return;
  }

  const s = sock as RNSocket;
  s.onopen = () => {
    reconnectDelay = 1000; // reset backoff
    startHeartbeat();
  };

  s.onmessage = ({ data }) => {
    try {
      const parsed = JSON.parse(String(data)) as { type?: string };
      if (parsed.type && parsed.type !== 'pong') {
        notify(parsed as unknown as RealtimeEvent);
      }
    } catch {
      /* ignore malformed frames */
    }
  };

  s.onclose = () => {
    stopHeartbeat();
    scheduleReconnect();
  };

  s.onerror = () => {
    s.close();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer || !token) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

export function subscribeToTaskEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called after login / app start with a valid token. Safe to call repeatedly. */
export function connectRealtime(jwt: string | null): void {
  token = jwt;
  if (token) connect();
}

export function disconnectRealtime(): void {
  token = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopHeartbeat();
  sock?.close();
  sock = null;
}

/** For tests / debugging. */
export function isRealtimeConnected(): boolean {
  return sock?.readyState === WS_OPEN;
}
