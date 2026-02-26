/**
 * Location Service — foreground + background GPS tracking engine.
 *
 * BACKGROUND STRATEGY:
 * ─────────────────────
 * Android: Uses a foreground service with persistent notification.
 *          The notification keeps the service alive even when the user
 *          opens Spotify, WhatsApp, or locks the screen.
 *
 * iOS:     Uses UIBackgroundModes: location. The blue status bar indicator
 *          signals active GPS tracking. pausesLocationUpdatesAutomatically
 *          is set to false to prevent iOS from auto-pausing.
 *
 * GPS points are buffered locally and batch-synced to the backend every
 * SYNC_INTERVAL_MS to handle network drops gracefully.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GPSPoint } from '../types/run';

// ─── Constants ──────────────────────────────────────────────────
const BACKGROUND_TASK_NAME = 'TERRITORY_RUNNER_BACKGROUND_LOCATION';
const BUFFER_STORAGE_KEY = '@gps_buffer';

// GPS settings tuned for running accuracy
const LOCATION_OPTIONS: Location.LocationOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,     // Update every 5 meters
    timeInterval: 2000,      // Or every 2 seconds
};

const BACKGROUND_OPTIONS: Location.LocationTaskOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true, // iOS: blue status bar
    foregroundService: {
        // Android: persistent notification that keeps the service alive
        notificationTitle: '🏃 Territory Runner',
        notificationBody: 'Tracking your run…',
        notificationColor: '#00FF88',
        killServiceOnDestroy: false,  // Survive app kill
    },
    pausesUpdatesAutomatically: false,   // iOS: never auto-pause
    deferredUpdatesInterval: 0,
    deferredUpdatesDistance: 0,
    activityType: Location.ActivityType.Fitness,
};

// ─── GPS Point Buffer ───────────────────────────────────────────
// Points are held in memory AND persisted to AsyncStorage as a safety net.
// If the app crashes, we can recover un-synced points on next launch.

let pointBuffer: GPSPoint[] = [];
let onPointCallback: ((point: GPSPoint) => void) | null = null;

/**
 * Register the background task handler.
 * MUST be called at module scope (top-level), NOT inside a component.
 */
TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[BG Location] Error:', error.message);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        for (const loc of locations) {
            const point: GPSPoint = {
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                altitude_m: loc.coords.altitude ?? undefined,
                speed_mps: loc.coords.speed != null && loc.coords.speed >= 0
                    ? loc.coords.speed
                    : undefined,
                accuracy_m: loc.coords.accuracy ?? undefined,
                timestamp: new Date(loc.timestamp).toISOString(),
            };
            pointBuffer.push(point);

            // Notify the foreground hook (if app is in foreground)
            if (onPointCallback) {
                onPointCallback(point);
            }
        }

        // Persist buffer to survive crashes
        persistBuffer();
    }
});


// ─── Public API ─────────────────────────────────────────────────

/**
 * Start foreground GPS tracking. Call this when the user taps "Start Run".
 * Returns a Location subscription that emits GPS events.
 */
export async function startForegroundTracking(
    onPoint: (point: GPSPoint) => void
): Promise<Location.LocationSubscription> {
    onPointCallback = onPoint;
    pointBuffer = [];

    const subscription = await Location.watchPositionAsync(
        LOCATION_OPTIONS,
        (loc) => {
            const point: GPSPoint = {
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                altitude_m: loc.coords.altitude ?? undefined,
                speed_mps: loc.coords.speed != null && loc.coords.speed >= 0
                    ? loc.coords.speed
                    : undefined,
                accuracy_m: loc.coords.accuracy ?? undefined,
                timestamp: new Date(loc.timestamp).toISOString(),
            };
            pointBuffer.push(point);
            onPoint(point);
            persistBuffer();
        }
    );

    return subscription;
}

/**
 * Start background GPS tracking. The app will continue to receive
 * location updates even when minimized, switched, or screen-locked.
 *
 * On Android: launches a foreground service with a persistent notification.
 * On iOS: activates background location mode with blue status bar.
 */
export async function startBackgroundTracking(): Promise<void> {
    const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRunning) {
        console.log('[BG Location] Already running, skipping re-register');
        return;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, BACKGROUND_OPTIONS);
    console.log('[BG Location] Background tracking started');
}

/**
 * Stop background GPS tracking and clean up the foreground service.
 */
export async function stopBackgroundTracking(): Promise<void> {
    const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
        console.log('[BG Location] Background tracking stopped');
    }
}

/**
 * Get the current user location (one-shot).
 */
export async function getCurrentLocation(): Promise<Location.LocationObject> {
    return Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
    });
}

/**
 * Flush the buffer: returns all buffered points and clears the buffer.
 * Call this periodically to batch-sync points to the backend.
 */
export function flushBuffer(): GPSPoint[] {
    const flushed = [...pointBuffer];
    pointBuffer = [];
    clearPersistedBuffer();
    return flushed;
}

/**
 * Get buffered points without clearing (for recovery).
 */
export function getBuffer(): GPSPoint[] {
    return [...pointBuffer];
}

/**
 * Set the foreground callback (used when app returns from background).
 */
export function setOnPointCallback(cb: ((point: GPSPoint) => void) | null): void {
    onPointCallback = cb;
}


// ─── Internal: Crash-safe persistence ───────────────────────────

async function persistBuffer(): Promise<void> {
    try {
        await AsyncStorage.setItem(BUFFER_STORAGE_KEY, JSON.stringify(pointBuffer));
    } catch (e) {
        console.error('[GPS Buffer] Persist failed:', e);
    }
}

async function clearPersistedBuffer(): Promise<void> {
    try {
        await AsyncStorage.removeItem(BUFFER_STORAGE_KEY);
    } catch (e) {
        console.error('[GPS Buffer] Clear failed:', e);
    }
}

/**
 * Recover any un-synced GPS points from a previous crash.
 * Call this on app startup.
 */
export async function recoverBuffer(): Promise<GPSPoint[]> {
    try {
        const raw = await AsyncStorage.getItem(BUFFER_STORAGE_KEY);
        if (raw) {
            const recovered: GPSPoint[] = JSON.parse(raw);
            console.log(`[GPS Buffer] Recovered ${recovered.length} points from crash`);
            return recovered;
        }
    } catch (e) {
        console.error('[GPS Buffer] Recovery failed:', e);
    }
    return [];
}
