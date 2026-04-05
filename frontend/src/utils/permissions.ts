/**
 * Permission helpers for Location & Notifications.
 *
 * Location flow:
 *   1. Request foreground ("when in use")
 *   2. Request background ("always") — required for run survival
 *
 * Notifications:
 *   Needed for territory-stolen alerts and run summaries.
 */

import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';

let notificationsModuleLoadFailed = false;

function isExpoGoAndroid(): boolean {
    return Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
}

async function getNotificationsModule() {
    if (isExpoGoAndroid()) {
        return null;
    }

    try {
        const notifications = await import('expo-notifications');
        return notifications;
    } catch (error) {
        if (!notificationsModuleLoadFailed) {
            notificationsModuleLoadFailed = true;
            console.warn('[Permissions] Notifications module unavailable:', error);
        }
        return null;
    }
}

// ─── Location ────────────────────────────────────────────────────

export async function requestLocationPermissions(): Promise<boolean> {
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    if (foreground !== 'granted') {
        Alert.alert(
            'Location Required',
            'Territory Runner needs access to your location to track your run. Please enable it in Settings.',
            [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
        return false;
    }

    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    if (background !== 'granted') {
        Alert.alert(
            'Background Location Needed',
            'To keep tracking your run when you switch apps or lock your screen, Territory Runner needs "Always Allow" location access.',
            [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Run Anyway (Limited)', style: 'cancel' },
            ]
        );
        return true; // foreground-only is still usable
    }

    return true;
}

export async function checkLocationPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
}> {
    const fg = await Location.getForegroundPermissionsAsync();
    const bg = await Location.getBackgroundPermissionsAsync();
    return {
        foreground: fg.status === 'granted',
        background: bg.status === 'granted',
    };
}

// ─── Notifications ───────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
    const notifications = await getNotificationsModule();
    if (!notifications) {
        return false;
    }

    const { status: existing } = await notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await notifications.requestPermissionsAsync();
    return status === 'granted';
}

export async function checkNotificationPermissions(): Promise<boolean> {
    const notifications = await getNotificationsModule();
    if (!notifications) {
        return false;
    }

    const { status } = await notifications.getPermissionsAsync();
    return status === 'granted';
}

// ─── Combined check ──────────────────────────────────────────────

export interface PermissionStatus {
    locationForeground: boolean;
    locationBackground: boolean;
    notifications: boolean;
}

export async function checkAllPermissions(): Promise<PermissionStatus> {
    const loc = await checkLocationPermissions();
    const notif = await checkNotificationPermissions();
    return {
        locationForeground: loc.foreground,
        locationBackground: loc.background,
        notifications: notif,
    };
}
