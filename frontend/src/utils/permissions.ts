/**
 * Location permission helpers for iOS and Android.
 * Handles the progressive permission flow:
 *   1. Request foreground ("when in use")
 *   2. Request background ("always") — required for run survival
 */

import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

export async function requestLocationPermissions(): Promise<boolean> {
    // Step 1: Foreground permission
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

    // Step 2: Background permission (critical for surviving app switch / lock)
    const { status: background } = await Location.requestBackgroundPermissionsAsync();
    if (background !== 'granted') {
        Alert.alert(
            'Background Location Needed',
            'To keep tracking your run when you switch to Spotify, WhatsApp, or lock your screen, Territory Runner needs "Always Allow" location access.',
            [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Run Anyway (Limited)', style: 'cancel' },
            ]
        );
        // We can still run in foreground — just warn the user
        return true;
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
