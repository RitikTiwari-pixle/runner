/**
 * Location Service (Web fallback)
 * Provides stub implementations for web since expo-location
 * and expo-task-manager are native-only modules.
 */

import { GPSPoint } from '../types/run';

const BACKGROUND_LOCATION_TASK = 'background-location-task';

type PointCallback = ((point: GPSPoint) => void) | null;
let onPointCallback: PointCallback = null;
let pointBuffer: GPSPoint[] = [];

export function setOnPointCallback(cb: PointCallback): void {
    onPointCallback = cb;
}

export async function startForegroundTracking(
    onPoint: (point: GPSPoint) => void
): Promise<{ remove: () => void }> {
    setOnPointCallback(onPoint);

    // Try to use browser Geolocation API if available
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const point: GPSPoint = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    altitude_m: position.coords.altitude ?? undefined,
                    speed_mps: position.coords.speed ?? undefined,
                    accuracy_m: position.coords.accuracy ?? undefined,
                    timestamp: new Date(position.timestamp).toISOString(),
                };
                pointBuffer.push(point);
                if (onPointCallback) onPointCallback(point);
            },
            (error) => {
                console.warn('[LocationService Web] Geolocation error:', error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );

        return {
            remove: () => {
                navigator.geolocation.clearWatch(watchId);
            },
        };
    }

    console.warn('[LocationService Web] Geolocation not available in this browser');
    return { remove: () => { } };
}

export async function startBackgroundTracking(): Promise<void> {
    // Background tracking not supported on web
    console.log('[LocationService Web] Background tracking not available on web');
}

export async function stopBackgroundTracking(): Promise<void> {
    // No-op on web
}

export function flushBuffer(): GPSPoint[] {
    const flushed = [...pointBuffer];
    pointBuffer = [];
    return flushed;
}

export async function recoverBuffer(): Promise<GPSPoint[]> {
    return [];
}

export async function getCurrentLocation(): Promise<{ coords: { latitude: number; longitude: number } }> {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        coords: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                        },
                    });
                },
                (error) => {
                    // Fallback to New Delhi
                    resolve({ coords: { latitude: 28.6139, longitude: 77.209 } });
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    }

    // Default: New Delhi center
    return { coords: { latitude: 28.6139, longitude: 77.209 } };
}
