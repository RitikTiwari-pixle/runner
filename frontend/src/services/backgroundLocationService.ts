/**
 * Background GPS Tracking Service
 * Tracks user location in background while running
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const LOCATION_TASK_NAME = 'territory-runner-location-tracking';

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error('[BGLocation] Task error:', error);
        return;
    }

    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        if (locations && locations.length > 0) {
            const location = locations[0];
            console.log('[BGLocation] Tracked:', {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                accuracy: location.coords.accuracy,
                timestamp: new Date(location.timestamp).toISOString(),
            });

            // Here you could:
            // - Store in local database
            // - Send to backend via batched API call
            // - Calculate approximate distance traveled
        }
    }
});

export async function startBackgroundLocationTracking(): Promise<boolean> {
    try {
        // Check permissions
        const foreground = await Location.getForegroundPermissionsAsync();
        if (foreground.status !== 'granted') {
            console.warn('[BGLocation] Foreground permission not granted');
            return false;
        }

        const background = await Location.getBackgroundPermissionsAsync();
        if (background.status !== 'granted') {
            console.warn('[BGLocation] Background permission not granted');
            return false;
        }

        // Check if task is already running
        const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
        if (!isTaskDefined) {
            console.warn('[BGLocation] Task not defined');
            return false;
        }

        // Start task (Android) or request background execution (iOS)
        if (Platform.OS === 'android') {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.High,
                distanceInterval: 10, // Update every 10 meters
                timeInterval: 5000, // Or every 5 seconds
                showsBackgroundLocationIndicator: true,
            });
        } else if (Platform.OS === 'ios') {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.High,
                distanceInterval: 10,
                timeInterval: 5000,
            });
        }

        console.log('[BGLocation] Tracking started');
        return true;
    } catch (e) {
        console.error('[BGLocation] Failed to start:', e);
        return false;
    }
}

export async function stopBackgroundLocationTracking(): Promise<boolean> {
    try {
        const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isTaskRunning) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log('[BGLocation] Tracking stopped');
            return true;
        }
        return false;
    } catch (e) {
        console.error('[BGLocation] Failed to stop:', e);
        return false;
    }
}

export async function isBackgroundTrackingActive(): Promise<boolean> {
    try {
        return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (e) {
        console.error('[BGLocation] Failed to check status:', e);
        return false;
    }
}

/**
 * Request background location permission
 */
export async function requestBackgroundLocationPermission(): Promise<boolean> {
    try {
        // First request foreground
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
            console.warn('[BGLocation] Foreground permission denied');
            return false;
        }

        // Then request background
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
            console.warn('[BGLocation] Background permission denied - user may need to set "Always Allow" in settings');
            return false;
        }

        return true;
    } catch (e) {
        console.error('[BGLocation] Permission request failed:', e);
        return false;
    }
}
