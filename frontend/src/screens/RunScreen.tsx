/**
 * RunScreen — The main run screen composing MapView, RunMetrics, and RunControls.
 * This is the primary screen users interact with during a run.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView from '../components/MapView';
import RunMetricsDisplay from '../components/RunMetrics';
import RunControls from '../components/RunControls';
import { useRunTracker } from '../hooks/useRunTracker';
import { requestLocationPermissions } from '../utils/permissions';
import { getCurrentLocation } from '../services/locationService';
import { Coordinate } from '../types/run';

interface RunScreenProps {
    userId: string;
}

export default function RunScreen({ userId }: RunScreenProps) {
    const {
        status,
        route,
        metrics,
        currentLocation,
        startRun,
        pauseRun,
        resumeRun,
        stopRun,
    } = useRunTracker(userId);

    const [initialLocation, setInitialLocation] = useState<Coordinate | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // Request permissions and get initial location on mount
    useEffect(() => {
        (async () => {
            const granted = await requestLocationPermissions();
            setPermissionGranted(granted);

            if (granted) {
                try {
                    const loc = await getCurrentLocation();
                    setInitialLocation({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    });
                } catch (e) {
                    console.error('[RunScreen] Failed to get initial location:', e);
                }
            }
        })();
    }, []);

    const displayLocation = currentLocation || initialLocation;

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

            {/* Map fills the entire screen behind the overlays */}
            <MapView
                route={route}
                currentLocation={displayLocation}
                isTracking={status === 'running'}
            />

            {/* Overlays on top of the map */}
            <SafeAreaView style={styles.overlay} pointerEvents="box-none">
                {/* Top: App title bar */}
                <View style={styles.header}>
                    <Text style={styles.logo}>🏃 TERRITORY</Text>
                    <Text style={styles.logoSub}>RUNNER</Text>
                </View>

                {/* Metrics HUD (only visible during/after run) */}
                {status !== 'idle' && (
                    <RunMetricsDisplay metrics={metrics} />
                )}

                {/* Spacer pushes controls to bottom */}
                <View style={styles.spacer} />

                {/* Status indicator */}
                {status === 'running' && (
                    <View style={styles.statusBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.statusText}>TRACKING ACTIVE</Text>
                    </View>
                )}
                {status === 'paused' && (
                    <View style={[styles.statusBadge, styles.pausedBadge]}>
                        <Text style={styles.statusText}>⏸ PAUSED</Text>
                    </View>
                )}

                {/* Bottom: Controls */}
                <RunControls
                    status={status}
                    onStart={startRun}
                    onPause={pauseRun}
                    onResume={resumeRun}
                    onStop={() => stopRun()}
                />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-start',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 6,
    },
    logo: {
        fontSize: 20,
        fontWeight: '900',
        color: '#00FF88',
        letterSpacing: 3,
    },
    logoSub: {
        fontSize: 20,
        fontWeight: '300',
        color: '#FFFFFF',
        letterSpacing: 3,
    },
    spacer: {
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 255, 136, 0.15)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 136, 0.3)',
    },
    pausedBadge: {
        backgroundColor: 'rgba(255, 186, 0, 0.15)',
        borderColor: 'rgba(255, 186, 0, 0.3)',
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00FF88',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 2,
    },
});
